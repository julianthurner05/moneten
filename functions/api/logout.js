// Abmelden: Session in der Datenbank löschen, Cookie entfernen.

import { clearSessionCookie, json } from '../../shared/http.js';

export async function onRequestPost({ env, data }) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(data.sessionId).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
