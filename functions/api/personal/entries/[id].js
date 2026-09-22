// Persönlichen Eintrag bearbeiten oder löschen.

import { error, json, readJson } from '../../../../shared/http.js';
import { validateEntry } from './index.js';

async function loadEntry(env, userId, id) {
  return env.DB.prepare('SELECT id FROM personal_entries WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first();
}

export async function onRequestPut({ request, env, data, params }) {
  const existing = await loadEntry(env, data.user.id, params.id);
  if (!existing) return error('Eintrag nicht gefunden.', 404);

  const body = await readJson(request);
  const validated = await validateEntry(env, data.user.id, body);
  if (validated.error) return error(validated.error);

  const e = validated.entry;
  await env.DB.prepare(
    'UPDATE personal_entries SET category_id = ?, spent_on = ?, description = ?, amount_cents = ? WHERE id = ?'
  )
    .bind(e.categoryId, e.spentOn, e.description, e.amountCents, existing.id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const existing = await loadEntry(env, data.user.id, params.id);
  if (!existing) return error('Eintrag nicht gefunden.', 404);

  await env.DB.prepare('DELETE FROM personal_entries WHERE id = ?').bind(existing.id).run();
  return json({ ok: true });
}
