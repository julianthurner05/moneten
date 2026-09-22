// Passwort eines Users zurücksetzen (nur Admin). Erzwingt Änderung beim nächsten Login.

import { generateSaltHex, hashPassword } from '../../../../shared/auth.js';
import { error, json, readJson } from '../../../../shared/http.js';

export async function onRequestPost({ request, env, data, params }) {
  if (!data.user.isAdmin) return error('Nur für Admins.', 403);
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) return error('Das Startpasswort braucht mindestens 8 Zeichen.');

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(params.id).first();
  if (!user) return error('User nicht gefunden.', 404);

  const salt = generateSaltHex();
  const hash = await hashPassword(password, salt);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1 WHERE id = ?'
    ).bind(hash, salt, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
  ]);

  return json({ ok: true });
}
