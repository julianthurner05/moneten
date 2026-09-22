// Anmeldung mit Benutzername und Passwort.

import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  timingSafeEqualHex,
} from '../../shared/auth.js';
import { error, json, readJson, SESSION_DAYS, sessionCookie } from '../../shared/http.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) return error('Benutzername und Passwort angeben.');

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  // Auch bei unbekanntem Benutzer hashen, damit die Antwortzeit nichts verrät.
  const salt = user ? user.password_salt : '00000000000000000000000000000000';
  const hash = await hashPassword(password, salt);
  if (!user || !timingSafeEqualHex(hash, user.password_hash)) {
    return error('Benutzername oder Passwort stimmt nicht.', 401);
  }

  const token = generateSessionToken();
  const sessionId = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, expiresAt)
    .run();

  return json(
    {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isAdmin: !!user.is_admin,
        mustChangePassword: !!user.must_change_password,
      },
    },
    200,
    { 'Set-Cookie': sessionCookie(token) }
  );
}
