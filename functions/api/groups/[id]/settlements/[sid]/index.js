// Ausgleichszahlung nachträglich bearbeiten oder löschen.
// Bearbeitet jemand anderes als die empfangende Person, muss neu bestätigt werden.

import { loadGroupForMember } from '../../../../../../shared/groupData.js';
import { error, isDateString, json, nowIso, readJson } from '../../../../../../shared/http.js';

async function loadSettlement(env, data, params) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return { error: error('Gruppe nicht gefunden.', 404) };
  if (group.archived) return { error: error('Die Gruppe ist archiviert.', 400) };

  const settlement = await env.DB.prepare('SELECT * FROM settlements WHERE id = ? AND group_id = ?')
    .bind(params.sid, group.id)
    .first();
  if (!settlement) return { error: error('Zahlung nicht gefunden.', 404) };
  return { group, settlement };
}

export async function onRequestPut({ request, env, data, params }) {
  const loaded = await loadSettlement(env, data, params);
  if (loaded.error) return loaded.error;
  const { group } = loaded;

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

  const confirmedAt = data.user.id === body.toUser ? nowIso() : null;
  await env.DB.prepare(
    `UPDATE settlements SET from_user = ?, to_user = ?, amount_cents = ?, settled_on = ?, confirmed_at = ?
     WHERE id = ?`
  )
    .bind(body.fromUser, body.toUser, body.amountCents, body.settledOn, confirmedAt, params.sid)
    .run();

  return json({ ok: true, confirmed: !!confirmedAt });
}

export async function onRequestDelete({ env, data, params }) {
  const loaded = await loadSettlement(env, data, params);
  if (loaded.error) return loaded.error;

  await env.DB.prepare('DELETE FROM settlements WHERE id = ?').bind(params.sid).run();
  return json({ ok: true });
}
