// Übersicht aller Monate seit dem Startmonat: Budget, Ausgaben, Übrig je Monat.

import { computeOverview, isMonthString, monthAdd, recurringSum } from '../../shared/month.js';
import { json } from '../../shared/http.js';

const MAX_MONTHS = 120;

export async function onRequestGet({ env, data }) {
  const userId = data.user.id;
  const now = new Date().toISOString().slice(0, 7);

  const [settingsRow, recurringRows, entrySumsRows, shareSumsRows] = await env.DB.batch([
    env.DB.prepare('SELECT budget_start_month, carryover_enabled FROM user_settings WHERE user_id = ?').bind(
      userId
    ),
    env.DB.prepare(
      'SELECT kind, amount_cents, start_month, end_month FROM recurring_items WHERE user_id = ?'
    ).bind(userId),
    env.DB.prepare(
      `SELECT substr(e.spent_on, 1, 7) AS month, SUM(e.amount_cents) AS cents
       FROM personal_entries e
       JOIN personal_categories c ON c.id = e.category_id
       WHERE e.user_id = ? AND c.counts_toward_month = 1
       GROUP BY month`
    ).bind(userId),
    env.DB.prepare(
      `SELECT substr(e.spent_on, 1, 7) AS month, SUM(s.share_cents) AS cents
       FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       WHERE s.user_id = ? AND e.deleted_at IS NULL AND e.is_einzug = 0
       GROUP BY month`
    ).bind(userId),
  ]);

  const settings = {
    startMonth: settingsRow.results[0]?.budget_start_month ?? null,
    carryoverEnabled: (settingsRow.results[0]?.carryover_enabled ?? 1) === 1,
  };
  const recurring = recurringRows.results.map((r) => ({
    kind: r.kind,
    amountCents: r.amount_cents,
    startMonth: r.start_month,
    endMonth: r.end_month,
  }));

  const variableByMonth = new Map();
  for (const rows of [entrySumsRows.results, shareSumsRows.results]) {
    for (const row of rows) {
      variableByMonth.set(row.month, (variableByMonth.get(row.month) ?? 0) + (row.cents ?? 0));
    }
  }

  const dataMonths = [...variableByMonth.keys()].filter(isMonthString).sort();
  let start = settings.startMonth ?? dataMonths[0] ?? now;
  if (start > now) start = now;

  const lookup = {
    income: (m) => recurringSum(recurring, 'income', m),
    fixed: (m) => recurringSum(recurring, 'fixed', m),
    variable: (m) => variableByMonth.get(m) ?? 0,
  };

  const months = [];
  let m = now;
  for (let i = 0; m >= start && i < MAX_MONTHS; i++) {
    const overview = computeOverview(m, settings, lookup);
    months.push({
      month: m,
      budgetCents: overview.budgetCents,
      ausgabenCents: overview.ausgabenCents,
      uebrigCents: overview.uebrigCents,
    });
    m = monthAdd(m, -1);
  }

  return json({ months });
}
