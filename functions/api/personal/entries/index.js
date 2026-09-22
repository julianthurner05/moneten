// Persönlichen Eintrag anlegen.

import { error, isDateString, isNonEmptyString, json, nowIso, readJson } from '../../../../shared/http.js';

export async function validateEntry(env, userId, body) {
  if (!body) return { error: 'Ungültige Anfrage.' };
  if (!Number.isInteger(body.amountCents) || body.amountCents === 0) {
    return { error: 'Der Betrag darf nicht 0 sein.' };
  }
  if (!isNonEmptyString(body.description)) return { error: 'Beschreibung fehlt.' };
  if (!isDateString(body.spentOn)) return { error: 'Ungültiges Datum.' };
  const category = await env.DB.prepare(
    'SELECT id FROM personal_categories WHERE id = ? AND user_id = ?'
  )
    .bind(body.categoryId ?? '', userId)
    .first();
  if (!category) return { error: 'Kategorie nicht gefunden.' };
  return {
    entry: {
      categoryId: category.id,
      spentOn: body.spentOn,
      description: body.description.trim(),
      amountCents: body.amountCents,
    },
  };
}

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const validated = await validateEntry(env, data.user.id, body);
  if (validated.error) return error(validated.error);

  const id = crypto.randomUUID();
  const e = validated.entry;
  await env.DB.prepare(
    `INSERT INTO personal_entries (id, user_id, category_id, spent_on, description, amount_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, data.user.id, e.categoryId, e.spentOn, e.description, e.amountCents, nowIso())
    .run();

  return json({ id });
}
