// Eigenen Gruppen-Anteil händisch einer Kategorie zuordnen (null = automatisch).

import { error, json, readJson } from '../../../../shared/http.js';

export async function onRequestPut({ request, env, data, params }) {
  const share = await env.DB.prepare(
    `SELECT s.expense_id FROM expense_shares s
     JOIN group_expenses e ON e.id = s.expense_id
     WHERE s.expense_id = ? AND s.user_id = ? AND e.deleted_at IS NULL`
  )
    .bind(params.expenseId, data.user.id)
    .first();
  if (!share) return error('Anteil nicht gefunden.', 404);

  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  if (body.categoryId === null) {
    await env.DB.prepare('DELETE FROM personal_expense_categories WHERE user_id = ? AND expense_id = ?')
      .bind(data.user.id, share.expense_id)
      .run();
    return json({ ok: true });
  }

  if (typeof body.categoryId !== 'string') return error('Kategorie fehlt.');
  const category = await env.DB.prepare('SELECT id FROM personal_categories WHERE id = ? AND user_id = ?')
    .bind(body.categoryId, data.user.id)
    .first();
  if (!category) return error('Kategorie nicht gefunden.');

  await env.DB.prepare(
    `INSERT INTO personal_expense_categories (user_id, expense_id, category_id) VALUES (?, ?, ?)
     ON CONFLICT (user_id, expense_id) DO UPDATE SET category_id = ?`
  )
    .bind(data.user.id, share.expense_id, category.id, category.id)
    .run();
  return json({ ok: true });
}
