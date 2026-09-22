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
  if (expense.is_deposit) return error('Die Kaution ist fest vermerkt und nicht bearbeitbar.');

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
  const statements = [
    env.DB.prepare(
      `UPDATE group_expenses SET paid_by = ?, amount_cents = ?, description = ?, spent_on = ?, split_mode = ?, is_einzug = ?
       WHERE id = ?`
    ).bind(
      updated.paidBy,
      updated.amountCents,
      updated.description,
      updated.spentOn,
      updated.splitMode,
      body.isEinzug ? 1 : 0,
      expense.id
    ),
    env.DB.prepare('DELETE FROM expense_shares WHERE expense_id = ?').bind(expense.id),
    ...updated.shares.map((s) =>
      env.DB.prepare(
        'INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)'
      ).bind(expense.id, s.userId, s.shareCents)
    ),
    // Eigene Kategorie-Zuordnung neu setzen (betrifft nur den bearbeitenden User).
    env.DB.prepare('DELETE FROM personal_expense_categories WHERE user_id = ? AND expense_id = ?').bind(
      data.user.id,
      expense.id
    ),
  ];

  if (typeof body.myCategoryId === 'string' && body.myCategoryId) {
    const category = await env.DB.prepare(
      'SELECT id FROM personal_categories WHERE id = ? AND user_id = ?'
    )
      .bind(body.myCategoryId, data.user.id)
      .first();
    if (!category) return error('Kategorie nicht gefunden.');
    statements.push(
      env.DB.prepare(
        'INSERT INTO personal_expense_categories (user_id, expense_id, category_id) VALUES (?, ?, ?)'
      ).bind(data.user.id, expense.id, category.id)
    );
  }

  await env.DB.batch(statements);
  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const expense = await loadExpense(env, group.id, params.eid);
  if (!expense) return error('Ausgabe nicht gefunden.', 404);
  if (expense.is_deposit) return error('Die Kaution ist fest vermerkt und nicht bearbeitbar.');

  await env.DB.prepare('UPDATE group_expenses SET deleted_at = ? WHERE id = ?')
    .bind(nowIso(), expense.id)
    .run();

  return json({ ok: true });
}
