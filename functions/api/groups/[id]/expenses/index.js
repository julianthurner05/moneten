// Ausgabe in einer Gruppe anlegen.

import { validateExpenseInput } from '../../../../../shared/expenseInput.js';
import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const { results: members } = await env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ?'
  )
    .bind(group.id)
    .all();
  const validated = validateExpenseInput(body, members.map((m) => m.user_id));
  if (validated.error) return error(validated.error);

  const expense = validated.expense;
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO group_expenses (id, group_id, paid_by, amount_cents, description, spent_on, split_mode, created_by, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).bind(
      id,
      group.id,
      expense.paidBy,
      expense.amountCents,
      expense.description,
      expense.spentOn,
      expense.splitMode,
      data.user.id,
      nowIso()
    ),
    ...expense.shares.map((s) =>
      env.DB.prepare(
        'INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)'
      ).bind(id, s.userId, s.shareCents)
    ),
  ]);

  return json({ id });
}
