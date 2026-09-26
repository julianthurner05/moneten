// Ausgleichszahlung anlegen. Zählt erst, wenn die empfangende Person bestätigt hat –
// trägt sie die Zahlung selbst ein, gilt das als Bestätigung.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, isDateString, json, nowIso, readJson } from '../../../../../shared/http.js';
import { displayName, euro, notifyUsers } from '../../../../../shared/notify.js';

export async function onRequestPost(context) {
  const { request, env, data, params, waitUntil } = context;
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
  const now = nowIso();
  const confirmedAt = data.user.id === body.toUser ? now : null;
  await env.DB.prepare(
    `INSERT INTO settlements (id, group_id, from_user, to_user, amount_cents, settled_on, created_by, created_at, confirmed_at, is_einzug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, group.id, body.fromUser, body.toUser, body.amountCents, body.settledOn, data.user.id, now, confirmedAt, body.isEinzug ? 1 : 0)
    .run();

  if (!confirmedAt) {
    waitUntil(
      (async () => {
        const from = await displayName(env, body.fromUser);
        await notifyUsers(env, [body.toUser], {
          title: 'Wartet auf Bestätigung',
          body: `${from} hat dir ${euro(body.amountCents)} überwiesen – bitte bestätigen.`,
          url: body.isEinzug ? '/#/einzug' : '/',
        });
      })()
    );
  }

  return json({ id, confirmed: !!confirmedAt });
}
