// Session-Prüfung für alle API-Endpunkte.

import { hashSessionToken } from '../../shared/auth.js';
import { error, parseCookies, SESSION_COOKIE } from '../../shared/http.js';

const PUBLIC_PATHS = new Set(['/api/setup', '/api/login']);

// Solange das Passwort geändert werden muss, sind nur diese Pfade erlaubt.
const MUST_CHANGE_PATHS = new Set(['/api/me', '/api/password', '/api/logout']);

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/$/, '');

  if (PUBLIC_PATHS.has(path)) {
    return context.next();
  }

  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) {
    return error('Nicht angemeldet.', 401);
  }

  const sessionId = await hashSessionToken(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.username, u.display_name, u.is_admin, u.must_change_password
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  )
    .bind(sessionId)
    .first();

  if (!row) {
    return error('Nicht angemeldet.', 401);
  }
  if (row.expires_at < new Date().toISOString()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return error('Sitzung abgelaufen.', 401);
  }

  if (row.must_change_password && !MUST_CHANGE_PATHS.has(path)) {
    return error('Bitte zuerst das Passwort ändern.', 403);
  }

  context.data.user = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isAdmin: !!row.is_admin,
    mustChangePassword: !!row.must_change_password,
  };
  context.data.sessionId = row.session_id;

  return context.next();
}
