// Merkt, dass die Person einen Tab der Gruppe gerade ansieht – setzt den
// roten Zähler für diesen Tab zurück.

import { loadGroupForMember } from '../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../shared/http.js';

const TABS = new Set(['gruppe', 'einzug', 'einkauf']);

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const body = await readJson(request);
  if (!TABS.has(body?.tab)) return error('Ungültiger Tab.');

  await env.DB.prepare(
    `INSERT INTO tab_seen (user_id, group_id, tab, seen_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, group_id, tab) DO UPDATE SET seen_at = ?`
  )
    .bind(data.user.id, group.id, body.tab, nowIso(), nowIso())
    .run();
  return json({ ok: true });
}
