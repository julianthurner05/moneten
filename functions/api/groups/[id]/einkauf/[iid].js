// Artikel abhaken bzw. zurückholen oder löschen.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, readJson } from '../../../../../shared/http.js';

async function loadItem(env, data, params) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return { error: error('Gruppe nicht gefunden.', 404) };
  if (group.archived) return { error: error('Die Gruppe ist archiviert.', 400) };
  const item = await env.DB.prepare('SELECT id FROM shopping_items WHERE id = ? AND group_id = ?')
    .bind(params.iid, group.id)
    .first();
  if (!item) return { error: error('Artikel nicht gefunden.', 404) };
  return { group, item };
}

export async function onRequestPut({ request, env, data, params }) {
  const loaded = await loadItem(env, data, params);
  if (loaded.error) return loaded.error;
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return error('Bitte einen Artikel eingeben.');
    await env.DB.prepare('UPDATE shopping_items SET name = ? WHERE id = ?').bind(name, params.iid).run();
  }
  if (body.done !== undefined) {
    await env.DB.prepare('UPDATE shopping_items SET done = ? WHERE id = ?')
      .bind(body.done ? 1 : 0, params.iid)
      .run();
  }
  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const loaded = await loadItem(env, data, params);
  if (loaded.error) return loaded.error;
  await env.DB.prepare('DELETE FROM shopping_items WHERE id = ?').bind(params.iid).run();
  return json({ ok: true });
}
