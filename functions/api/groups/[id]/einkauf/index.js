// Einkaufsliste einer Gruppe: lesen und Artikel anlegen.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';

export async function onRequestGet({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const { results } = await env.DB.prepare(
    'SELECT id, name, done, created_by, created_at FROM shopping_items WHERE group_id = ? ORDER BY done, created_at DESC'
  )
    .bind(group.id)
    .all();
  return json({
    items: results.map((r) => ({ id: r.id, name: r.name, done: !!r.done, createdBy: r.created_by })),
  });
}

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  const name = body?.name?.trim();
  if (!name) return error('Bitte einen Artikel eingeben.');

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO shopping_items (id, group_id, name, done, created_by, created_at) VALUES (?, ?, ?, 0, ?, ?)'
  )
    .bind(id, group.id, name, data.user.id, nowIso())
    .run();
  return json({ id });
}
