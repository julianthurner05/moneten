// Wiederkehrende Einnahmen und Fixkosten anlegen.

import { isMonthString } from '../../../../shared/month.js';
import { error, isNonEmptyString, json, readJson } from '../../../../shared/http.js';

export function validateRecurring(body) {
  if (!body) return { error: 'Ungültige Anfrage.' };
  if (!['income', 'fixed'].includes(body.kind)) return { error: 'Ungültige Art.' };
  if (!isNonEmptyString(body.name, 64)) return { error: 'Name fehlt.' };
  if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
    return { error: 'Der Betrag muss größer als 0 sein.' };
  }
  if (!isMonthString(body.startMonth)) return { error: 'Ungültiger Startmonat.' };
  if (body.endMonth != null && body.endMonth !== '') {
    if (!isMonthString(body.endMonth)) return { error: 'Ungültiger Endmonat.' };
    if (body.endMonth < body.startMonth) return { error: 'Der Endmonat liegt vor dem Startmonat.' };
  }
  return {
    item: {
      kind: body.kind,
      name: body.name.trim(),
      amountCents: body.amountCents,
      startMonth: body.startMonth,
      endMonth: body.endMonth ? body.endMonth : null,
    },
  };
}

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const validated = validateRecurring(body);
  if (validated.error) return error(validated.error);

  const id = crypto.randomUUID();
  const item = validated.item;
  await env.DB.prepare(
    `INSERT INTO recurring_items (id, user_id, kind, name, amount_cents, start_month, end_month)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, data.user.id, item.kind, item.name, item.amountCents, item.startMonth, item.endMonth)
    .run();

  return json({ id });
}
