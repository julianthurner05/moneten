// Wiederkehrende Gruppenausgaben verwalten.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { isMonthString } from '../../../../../shared/month.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';

export async function onRequestGet({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  const { results } = await env.DB.prepare(
    'SELECT id, name, amount_cents, paid_by, start_month, end_month FROM group_recurring WHERE group_id = ? ORDER BY name'
  )
    .bind(group.id)
    .all();
  return json({
    items: results.map((r) => ({
      id: r.id,
      name: r.name,
      amountCents: r.amount_cents,
      paidBy: r.paid_by,
      startMonth: r.start_month,
      endMonth: r.end_month,
    })),
  });
}

export function validateRecurring(body, memberSet) {
  if (!body?.name?.trim()) return 'Bitte einen Namen eingeben.';
  if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) return 'Der Betrag muss größer als 0 sein.';
  if (!memberSet.has(body.paidBy)) return 'Wer bezahlt, muss Mitglied der Gruppe sein.';
  if (!isMonthString(body.startMonth)) return 'Ungültiger Startmonat.';
  if (body.endMonth && !isMonthString(body.endMonth)) return 'Ungültiger Endmonat.';
  return null;
}

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  const { results: members } = await env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?')
    .bind(group.id)
    .all();
  const invalid = validateRecurring(body, new Set(members.map((m) => m.user_id)));
  if (invalid) return error(invalid);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO group_recurring (id, group_id, name, amount_cents, paid_by, start_month, end_month, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, group.id, body.name.trim(), body.amountCents, body.paidBy, body.startMonth, body.endMonth || null, data.user.id, nowIso())
    .run();
  return json({ id });
}
