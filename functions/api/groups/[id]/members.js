// Mitglied zu einer Gruppe hinzufügen.

import { loadGroupForMember } from '../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../shared/http.js';

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  if (!body || typeof body.userId !== 'string') return error('Ungültige Anfrage.');

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.userId).first();
  if (!user) return error('User nicht gefunden.', 404);

  const existing = await env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(group.id, user.id)
    .first();
  if (existing) return error('Ist schon Mitglied.');

  await env.DB.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)')
    .bind(group.id, user.id, nowIso())
    .run();

  return json({ ok: true });
}
