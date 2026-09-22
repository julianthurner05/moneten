// Eigenes Passwort ändern (auch beim erzwungenen Wechsel nach dem ersten Login).

import { generateSaltHex, hashPassword, timingSafeEqualHex } from '../../shared/auth.js';
import { error, json, readJson } from '../../shared/http.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (newPassword.length < 8) return error('Das neue Passwort braucht mindestens 8 Zeichen.');

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(data.user.id).first();
  const currentHash = await hashPassword(currentPassword, user.password_salt);
  if (!timingSafeEqualHex(currentHash, user.password_hash)) {
    return error('Das aktuelle Passwort stimmt nicht.', 401);
  }

  const salt = generateSaltHex();
  const hash = await hashPassword(newPassword, salt);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?'
    ).bind(hash, salt, user.id),
    // Alle anderen Sitzungen beenden, die eigene bleibt gültig.
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(
      user.id,
      data.sessionId
    ),
  ]);

  return json({ ok: true });
}
