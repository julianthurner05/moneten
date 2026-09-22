// Ausgabe bearbeiten oder löschen (Soft Delete).

import { validateExpenseInput } from '../../../../../shared/expenseInput.js';
import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';

async function loadExpense(env, groupId, expenseId) {
  return env.DB.prepare(
    'SELECT * FROM group_expenses WHERE id = ? AND group_id = ? AND deleted_at IS NULL'
  )
    .bind(expenseId, groupId)
    .first();
}

export async function onRequestPut({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const expense = await loadExpense(env, group.id, params.eid);
  if (!expense) return error('Ausgabe nicht gefunden.', 404);

  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const { results: members } = await env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ?'
  )
    .bind(group.id)
    .all();
  const validated = validateExpenseInput(body, members.map((m) => m.user_id));
  if (validated.error) return error(validated.error);

  const updated = validated.expense;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE group_expenses SET paid_by = ?, amount_cents = ?, description = ?, spent_on = ?, split_mode = ?
       WHERE id = ?`
    ).bind(
      updated.paidBy,
      updated.amountCents,
      updated.description,
      updated.spentOn,
      updated.splitMode,
      expense.id
    ),
    env.DB.prepare('DELETE FROM expense_shares WHERE expense_id = ?').bind(expense.id),
    ...updated.shares.map((s) =>
      env.DB.prepare(
        'INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)'
      ).bind(expense.id, s.userId, s.shareCents)
    ),
  ]);

  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const expense = await loadExpense(env, group.id, params.eid);
  if (!expense) return error('Ausgabe nicht gefunden.', 404);

  await env.DB.prepare('UPDATE group_expenses SET deleted_at = ? WHERE id = ?')
    .bind(nowIso(), expense.id)
    .run();

  return json({ ok: true });
}
