// Privaten Einzugsposten bearbeiten oder löschen – nur die eigenen.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, readJson } from '../../../../../shared/http.js';
import { validateEinzugItem } from './index.js';

async function loadItem(env, groupId, userId, id) {
  return env.DB.prepare(
    'SELECT id FROM einzug_personal WHERE id = ? AND group_id = ? AND user_id = ?'
  )
    .bind(id, groupId, userId)
    .first();
}

export async function onRequestPut({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const existing = await loadItem(env, group.id, data.user.id, params.eid);
  if (!existing) return error('Posten nicht gefunden.', 404);

  const body = await readJson(request);
  const validated = validateEinzugItem(body);
  if (validated.error) return error(validated.error);

  const item = validated.item;
  await env.DB.prepare(
    'UPDATE einzug_personal SET description = ?, amount_cents = ?, spent_on = ? WHERE id = ?'
  )
    .bind(item.description, item.amountCents, item.spentOn, existing.id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const existing = await loadItem(env, group.id, data.user.id, params.eid);
  if (!existing) return error('Posten nicht gefunden.', 404);

  await env.DB.prepare('DELETE FROM einzug_personal WHERE id = ?').bind(existing.id).run();
  return json({ ok: true });
}
