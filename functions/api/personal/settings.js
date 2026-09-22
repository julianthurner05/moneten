// Einstellungen der Monatsübersicht: Startmonat und Übertrag.

import { isMonthString } from '../../../shared/month.js';
import { error, json, readJson } from '../../../shared/http.js';

export async function onRequestPut({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  const startMonth = body.budgetStartMonth ? body.budgetStartMonth : null;
  if (startMonth !== null && !isMonthString(startMonth)) return error('Ungültiger Startmonat.');
  const carryover = body.carryoverEnabled ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, budget_start_month, carryover_enabled) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET budget_start_month = ?, carryover_enabled = ?`
  )
    .bind(data.user.id, startMonth, carryover, startMonth, carryover)
    .run();

  return json({ ok: true });
}
