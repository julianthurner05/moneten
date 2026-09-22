// Einmalige Einrichtung: Admin-Account anlegen, solange die users-Tabelle leer ist.

import { generateSaltHex, generateSessionToken, hashPassword, hashSessionToken } from '../../shared/auth.js';
import {
  error,
  isNonEmptyString,
  json,
  nowIso,
  readJson,
  SESSION_DAYS,
  sessionCookie,
} from '../../shared/http.js';

async function usersExist(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  return row.n > 0;
}

export async function onRequestGet({ env }) {
  return json({ needed: !(await usersExist(env)) });
}

export async function onRequestPost({ request, env }) {
  if (await usersExist(env)) {
    return error('Die Einrichtung ist bereits abgeschlossen.', 403);
  }
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
    return error('Benutzername: 2–32 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Minus, Unterstrich.');
  }
  if (!isNonEmptyString(displayName, 64)) return error('Anzeigename fehlt.');
  if (password.length < 8) return error('Das Passwort braucht mindestens 8 Zeichen.');

  const salt = generateSaltHex();
  const hash = await hashPassword(password, salt);
  const userId = crypto.randomUUID();
  const token = generateSessionToken();
  const sessionId = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, password_salt, is_admin, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?)`
    ).bind(userId, username, displayName, hash, salt, nowIso()),
    env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(
      sessionId,
      userId,
      expiresAt
    ),
  ]);

  return json(
    { user: { id: userId, username, displayName, isAdmin: true, mustChangePassword: false } },
    200,
    { 'Set-Cookie': sessionCookie(token) }
  );
}
