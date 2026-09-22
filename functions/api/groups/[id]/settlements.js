// Ausgleichszahlung in einer Gruppe anlegen.

import { loadGroupForMember } from '../../../../shared/groupData.js';
import { error, isDateString, json, nowIso, readJson } from '../../../../shared/http.js';

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');
  if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
    return error('Der Betrag muss größer als 0 sein.');
  }
  if (!isDateString(body.settledOn)) return error('Ungültiges Datum.');
  if (body.fromUser === body.toUser) return error('Von und an müssen verschieden sein.');

  const { results: members } = await env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ?'
  )
    .bind(group.id)
    .all();
  const memberSet = new Set(members.map((m) => m.user_id));
  if (!memberSet.has(body.fromUser) || !memberSet.has(body.toUser)) {
    return error('Beide müssen Mitglieder der Gruppe sein.');
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO settlements (id, group_id, from_user, to_user, amount_cents, settled_on, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, group.id, body.fromUser, body.toUser, body.amountCents, body.settledOn, data.user.id, nowIso())
    .run();

  return json({ id });
}
