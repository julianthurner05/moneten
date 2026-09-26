// Empfangene Ausgleichszahlung bestätigen – nur durch die empfangende Person.

import { loadGroupForMember } from '../../../../../../shared/groupData.js';
import { error, json, nowIso } from '../../../../../../shared/http.js';
import { displayName, euro, notifyUsers } from '../../../../../../shared/notify.js';

export async function onRequestPost(context) {
  const { env, data, params, waitUntil } = context;
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

  waitUntil(
    (async () => {
      const to = await displayName(env, settlement.to_user);
      await notifyUsers(env, [settlement.from_user], {
        title: 'Begleichung bestätigt',
        body: `${to} hat deine Zahlung über ${euro(settlement.amount_cents)} erhalten.`,
        url: settlement.is_einzug ? '/#/einzug' : '/',
      });
    })()
  );

  return json({ ok: true });
}
