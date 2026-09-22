// Überweisungs-Vermerk für eine gemeinsame Einzugs-Ausgabe setzen oder entfernen.

import { loadGroupForMember } from '../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../shared/http.js';

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  if (!body || typeof body.expenseId !== 'string' || typeof body.userId !== 'string') {
    return error('Ungültige Anfrage.');
  }

  const expense = await env.DB.prepare(
    'SELECT id FROM group_expenses WHERE id = ? AND group_id = ? AND is_einzug = 1 AND deleted_at IS NULL'
  )
    .bind(body.expenseId, group.id)
    .first();
  if (!expense) return error('Ausgabe nicht gefunden.', 404);

  const member = await env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(group.id, body.userId)
    .first();
  if (!member) return error('Person ist kein Mitglied.', 400);

  if (body.transferred) {
    await env.DB.prepare(
      `INSERT INTO einzug_transfers (expense_id, user_id, transferred_at) VALUES (?, ?, ?)
       ON CONFLICT (expense_id, user_id) DO NOTHING`
    )
      .bind(expense.id, body.userId, nowIso())
      .run();
  } else {
    await env.DB.prepare('DELETE FROM einzug_transfers WHERE expense_id = ? AND user_id = ?')
      .bind(expense.id, body.userId)
      .run();
  }

  return json({ ok: true });
}
