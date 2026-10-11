// Wiederkehrende Gruppenausgabe ändern oder beenden. Schon materialisierte
// Monate bleiben unverändert – Änderungen gelten für künftige Monate.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, readJson } from '../../../../../shared/http.js';
import { validateRecurring } from './index.js';

async function loadRec(env, data, params) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return { error: error('Gruppe nicht gefunden.', 404) };
  if (group.archived) return { error: error('Die Gruppe ist archiviert.', 400) };
  const rec = await env.DB.prepare('SELECT id FROM group_recurring WHERE id = ? AND group_id = ?')
    .bind(params.rid, group.id)
    .first();
  if (!rec) return { error: error('Posten nicht gefunden.', 404) };
  return { group };
}

export async function onRequestPut({ request, env, data, params }) {
  const loaded = await loadRec(env, data, params);
  if (loaded.error) return loaded.error;

  const body = await readJson(request);
  const { results: members } = await env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?')
    .bind(loaded.group.id)
    .all();
  const invalid = validateRecurring(body, new Set(members.map((m) => m.user_id)));
  if (invalid) return error(invalid);

  await env.DB.prepare(
    'UPDATE group_recurring SET name = ?, amount_cents = ?, paid_by = ?, start_month = ?, end_month = ? WHERE id = ?'
  )
    .bind(body.name.trim(), body.amountCents, body.paidBy, body.startMonth, body.endMonth || null, params.rid)
    .run();
  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const loaded = await loadRec(env, data, params);
  if (loaded.error) return loaded.error;
  await env.DB.prepare('UPDATE group_expenses SET recurring_id = NULL WHERE recurring_id = ?').bind(params.rid).run();
  await env.DB.prepare('DELETE FROM group_recurring WHERE id = ?').bind(params.rid).run();
  return json({ ok: true });
}
