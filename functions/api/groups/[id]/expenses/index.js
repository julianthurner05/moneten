// Ausgabe in einer Gruppe anlegen.

import { validateExpenseInput } from '../../../../../shared/expenseInput.js';
import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';
import { displayName, euro, notifyUsers } from '../../../../../shared/notify.js';

export async function onRequestPost(context) {
  const { request, env, data, params, waitUntil } = context;
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
  const statements = [
    env.DB.prepare(
      `INSERT INTO group_expenses (id, group_id, paid_by, amount_cents, description, spent_on, split_mode, created_by, created_at, deleted_at, is_einzug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).bind(
      id,
      group.id,
      expense.paidBy,
      expense.amountCents,
      expense.description,
      expense.spentOn,
      expense.splitMode,
      data.user.id,
      nowIso(),
      body.isEinzug ? 1 : 0
    ),
    ...expense.shares.map((s) =>
      env.DB.prepare(
        'INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)'
      ).bind(id, s.userId, s.shareCents)
    ),
  ];

  // Eigene Kategorie für die Monatsübersicht (optional).
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
      ).bind(data.user.id, id, category.id)
    );
  }

  await env.DB.batch(statements);
  // Mitteilung an alle Gruppenmitglieder außer der eintragenden Person.
  waitUntil(
    (async () => {
      const creator = await displayName(env, data.user.id);
      const shareByUser = new Map(expense.shares.map((s) => [s.userId, s.shareCents]));
      for (const member of members) {
        if (member.user_id === data.user.id) continue;
        const share = shareByUser.get(member.user_id);
        await notifyUsers(env, [member.user_id], {
          title: body.isEinzug ? 'Neue Einzug-Ausgabe' : 'Neue Ausgabe',
          body: share
            ? `${creator} hat „${expense.description}" eingetragen – dein Anteil ${euro(share)}.`
            : `${creator} hat „${expense.description}" eingetragen (${euro(expense.amountCents)}).`,
          url: body.isEinzug ? '/#/einzug' : '/',
        });
      }
    })()
  );

  return json({ id });
}
