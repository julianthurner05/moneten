// Empfangene Ausgleichszahlung bestätigen – nur durch die empfangende Person.

import { loadGroupForMember } from '../../../../../../shared/groupData.js';
import { error, json, nowIso } from '../../../../../../shared/http.js';

export async function onRequestPost({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const settlement = await env.DB.prepare(
    'SELECT * FROM settlements WHERE id = ? AND group_id = ?'
  )
    .bind(params.sid, group.id)
    .first();
  if (!settlement) return error('Zahlung nicht gefunden.', 404);
  if (settlement.confirmed_at) return error('Schon bestätigt.');
  if (settlement.to_user !== data.user.id) {
    return error('Nur die empfangende Person kann bestätigen.', 403);
  }

  await env.DB.prepare('UPDATE settlements SET confirmed_at = ? WHERE id = ?')
    .bind(nowIso(), settlement.id)
    .run();

  return json({ ok: true });
}
