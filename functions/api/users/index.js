// Userliste (für Gruppen-Mitgliederauswahl) und Anlegen neuer Accounts (nur Admin).

import { generateSaltHex, hashPassword } from '../../../shared/auth.js';
import { error, isNonEmptyString, json, nowIso, readJson } from '../../../shared/http.js';

export async function onRequestGet({ env, data }) {
  const { results } = await env.DB.prepare(
    'SELECT id, username, display_name, is_admin, must_change_password FROM users ORDER BY display_name'
  ).all();
  const users = results.map((u) =>
    data.user.isAdmin
      ? {
          id: u.id,
          username: u.username,
          displayName: u.display_name,
          isAdmin: !!u.is_admin,
          mustChangePassword: !!u.must_change_password,
        }
      : { id: u.id, displayName: u.display_name }
  );
  return json({ users });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.user.isAdmin) return error('Nur für Admins.', 403);
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
    return error('Benutzername: 2–32 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Minus, Unterstrich.');
  }
  if (!isNonEmptyString(displayName, 64)) return error('Anzeigename fehlt.');
  if (password.length < 8) return error('Das Startpasswort braucht mindestens 8 Zeichen.');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first();
  if (existing) return error('Diesen Benutzernamen gibt es schon.');

  const salt = generateSaltHex();
  const hash = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, password_salt, is_admin, must_change_password, created_at)
     VALUES (?, ?, ?, ?, ?, 0, 1, ?)`
  )
    .bind(id, username, displayName, hash, salt, nowIso())
    .run();

  return json({ user: { id, username, displayName, isAdmin: false, mustChangePassword: true } });
}
