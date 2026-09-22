// Privater Einzugsposten: nur für die eigene Person.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, isDateString, isNonEmptyString, json, nowIso, readJson } from '../../../../../shared/http.js';

export function validateEinzugItem(body) {
  if (!body) return { error: 'Ungültige Anfrage.' };
  if (!Number.isInteger(body.amountCents) || body.amountCents === 0) {
    return { error: 'Der Betrag darf nicht 0 sein.' };
  }
  if (!isNonEmptyString(body.description)) return { error: 'Beschreibung fehlt.' };
  if (!isDateString(body.spentOn)) return { error: 'Ungültiges Datum.' };
  return {
    item: {
      description: body.description.trim(),
      amountCents: body.amountCents,
      spentOn: body.spentOn,
    },
  };
}

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  const validated = validateEinzugItem(body);
  if (validated.error) return error(validated.error);

  const id = crypto.randomUUID();
  const item = validated.item;
  await env.DB.prepare(
    `INSERT INTO einzug_personal (id, group_id, user_id, description, amount_cents, spent_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, group.id, data.user.id, item.description, item.amountCents, item.spentOn, nowIso())
    .run();

  return json({ id });
}
