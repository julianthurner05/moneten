// Kategorien anlegen.

import { error, isNonEmptyString, json, readJson } from '../../../../shared/http.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body || !isNonEmptyString(body.name, 64)) return error('Name fehlt.');

  const maxRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM personal_categories WHERE user_id = ?'
  )
    .bind(data.user.id)
    .first();

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO personal_categories (id, user_id, name, counts_toward_month, sort_order, archived)
     VALUES (?, ?, ?, ?, ?, 0)`
  )
    .bind(id, data.user.id, body.name.trim(), body.countsTowardMonth === false ? 0 : 1, maxRow.max_order + 1)
    .run();

  return json({ id });
}
