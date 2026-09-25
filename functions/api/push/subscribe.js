// Push-Abos verwalten: anlegen beim Aktivieren, löschen beim Deaktivieren.

import { error, json, nowIso, readJson } from '../../../shared/http.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return error('Ungültiges Abo.');
  }
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = ?, p256dh = ?, auth = ?`
  )
    .bind(body.endpoint, data.user.id, body.keys.p256dh, body.keys.auth, nowIso(), data.user.id, body.keys.p256dh, body.keys.auth)
    .run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, data }) {
  const body = await readJson(request);
  if (!body?.endpoint) return error('Ungültige Anfrage.');
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
    .bind(body.endpoint, data.user.id)
    .run();
  return json({ ok: true });
}
