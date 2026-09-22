// Kategorie bearbeiten: Name, Zählverhalten, Reihenfolge, Archivieren.

import { error, isNonEmptyString, json, readJson } from '../../../../shared/http.js';

export async function onRequestPut({ request, env, data, params }) {
  const existing = await env.DB.prepare(
    'SELECT * FROM personal_categories WHERE id = ? AND user_id = ?'
  )
    .bind(params.id, data.user.id)
    .first();
  if (!existing) return error('Kategorie nicht gefunden.', 404);

  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const name = body.name !== undefined ? body.name : existing.name;
  if (!isNonEmptyString(name, 64)) return error('Name fehlt.');
  const counts =
    body.countsTowardMonth !== undefined ? (body.countsTowardMonth ? 1 : 0) : existing.counts_toward_month;
  const sortOrder = body.sortOrder !== undefined ? body.sortOrder : existing.sort_order;
  if (!Number.isInteger(sortOrder)) return error('Ungültige Reihenfolge.');
  const archived = body.archived !== undefined ? (body.archived ? 1 : 0) : existing.archived;

  await env.DB.prepare(
    'UPDATE personal_categories SET name = ?, counts_toward_month = ?, sort_order = ?, archived = ? WHERE id = ?'
  )
    .bind(name.trim(), counts, sortOrder, archived, existing.id)
    .run();

  return json({ ok: true });
}
