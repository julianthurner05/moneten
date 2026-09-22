// Wiederkehrenden Posten bearbeiten oder löschen.

import { error, json, readJson } from '../../../../shared/http.js';
import { validateRecurring } from './index.js';

async function loadItem(env, userId, id) {
  return env.DB.prepare('SELECT id FROM recurring_items WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first();
}

export async function onRequestPut({ request, env, data, params }) {
  const existing = await loadItem(env, data.user.id, params.id);
  if (!existing) return error('Posten nicht gefunden.', 404);

  const body = await readJson(request);
  const validated = validateRecurring(body);
  if (validated.error) return error(validated.error);

  const item = validated.item;
  await env.DB.prepare(
    'UPDATE recurring_items SET kind = ?, name = ?, amount_cents = ?, start_month = ?, end_month = ? WHERE id = ?'
  )
    .bind(item.kind, item.name, item.amountCents, item.startMonth, item.endMonth, existing.id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const existing = await loadItem(env, data.user.id, params.id);
  if (!existing) return error('Posten nicht gefunden.', 404);

  await env.DB.prepare('DELETE FROM recurring_items WHERE id = ?').bind(existing.id).run();
  return json({ ok: true });
}
