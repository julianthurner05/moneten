// Persönliche Monatsübersicht: Kennzahlen, Kategorien, Einträge, Gruppen-Anteile.
// Einzugs-Ausgaben zählen nicht ins Monatsbudget. Gruppen-Anteile mit eigener
// Kategorie-Zuordnung erscheinen in der jeweiligen Kategorie.

import { ensureDefaultCategories } from '../../../shared/categories.js';
import { computeOverview, isMonthString, monthCount, recurringSum } from '../../../shared/month.js';
import { error, json } from '../../../shared/http.js';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function onRequestGet({ env, data, params }) {
  const month = params.month;
  if (!isMonthString(month)) return error('Ungültiger Monat.');
  const userId = data.user.id;

  await ensureDefaultCategories(env, userId);

  const [
    settingsRow,
    recurringRows,
    categoryRows,
    entryRows,
    entrySumsRows,
    shareSumsRows,
    mappedSumsRows,
    shareItemRows,
  ] = await env.DB.batch([
    env.DB.prepare('SELECT budget_start_month, carryover_enabled FROM user_settings WHERE user_id = ?').bind(
      userId
    ),
    env.DB.prepare(
      'SELECT id, kind, name, amount_cents, start_month, end_month FROM recurring_items WHERE user_id = ? ORDER BY name'
    ).bind(userId),
    env.DB.prepare(
      'SELECT id, name, counts_toward_month, sort_order, archived FROM personal_categories WHERE user_id = ? ORDER BY sort_order, name'
    ).bind(userId),
    env.DB.prepare(
      `SELECT id, category_id, spent_on, description, amount_cents FROM personal_entries
       WHERE user_id = ? AND substr(spent_on, 1, 7) = ?
       ORDER BY spent_on DESC, created_at DESC`
    ).bind(userId, month),
    // Monatssummen der Kategorien (für Übertrag und Durchschnitt).
    env.DB.prepare(
      `SELECT substr(e.spent_on, 1, 7) AS month, e.category_id, SUM(e.amount_cents) AS cents
       FROM personal_entries e
       WHERE e.user_id = ?
       GROUP BY month, e.category_id`
    ).bind(userId),
    // Alle eigenen Gruppen-Anteile pro Monat (ohne Einzug).
    env.DB.prepare(
      `SELECT substr(e.spent_on, 1, 7) AS month, SUM(s.share_cents) AS cents
       FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       WHERE s.user_id = ? AND e.deleted_at IS NULL AND e.is_einzug = 0
       GROUP BY month`
    ).bind(userId),
    // Anteile mit eigener Kategorie-Zuordnung pro Monat und Kategorie.
    env.DB.prepare(
      `SELECT substr(e.spent_on, 1, 7) AS month, m.category_id, SUM(s.share_cents) AS cents
       FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       JOIN personal_expense_categories m ON m.expense_id = e.id AND m.user_id = s.user_id
       WHERE s.user_id = ? AND e.deleted_at IS NULL AND e.is_einzug = 0
       GROUP BY month, m.category_id`
    ).bind(userId),
    // Einzelne Anteile im angefragten Monat, mit Gruppe und ggf. Kategorie.
    env.DB.prepare(
      `SELECT g.id AS group_id, g.name AS group_name, e.id AS expense_id, e.description, e.spent_on,
              s.share_cents, m.category_id
       FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       JOIN groups g ON g.id = e.group_id
       LEFT JOIN personal_expense_categories m ON m.expense_id = e.id AND m.user_id = s.user_id
       WHERE s.user_id = ? AND e.deleted_at IS NULL AND e.is_einzug = 0 AND substr(e.spent_on, 1, 7) = ?
       ORDER BY g.name, e.spent_on DESC`
    ).bind(userId, month),
  ]);

  const settings = {
    startMonth: settingsRow.results[0]?.budget_start_month ?? null,
    carryoverEnabled: (settingsRow.results[0]?.carryover_enabled ?? 1) === 1,
  };
  const recurring = recurringRows.results.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    amountCents: r.amount_cents,
    startMonth: r.start_month,
    endMonth: r.end_month,
  }));

  const countingIds = new Set(
    categoryRows.results.filter((c) => c.counts_toward_month === 1).map((c) => c.id)
  );

  // Variable Ausgaben pro Monat = zählende Kategorien plus alle Gruppen-Anteile (ohne Einzug).
  const variableByMonth = new Map();
  const categorySumsByMonth = new Map(); // "month|categoryId" → Cent
  const addCategorySum = (month_, categoryId, cents) => {
    const key = `${month_}|${categoryId}`;
    categorySumsByMonth.set(key, (categorySumsByMonth.get(key) ?? 0) + cents);
  };
  for (const row of entrySumsRows.results) {
    addCategorySum(row.month, row.category_id, row.cents ?? 0);
    if (countingIds.has(row.category_id)) {
      variableByMonth.set(row.month, (variableByMonth.get(row.month) ?? 0) + (row.cents ?? 0));
    }
  }
  for (const row of shareSumsRows.results) {
    variableByMonth.set(row.month, (variableByMonth.get(row.month) ?? 0) + (row.cents ?? 0));
  }
  for (const row of mappedSumsRows.results) {
    addCategorySum(row.month, row.category_id, row.cents ?? 0);
  }

  const overview = computeOverview(month, settings, {
    income: (m) => recurringSum(recurring, 'income', m),
    fixed: (m) => recurringSum(recurring, 'fixed', m),
    variable: (m) => variableByMonth.get(m) ?? 0,
  });

  // Durchschnitt pro Kategorie seit Startmonat bis zum aktuellen Monat
  // (persönliche Einträge plus zugeordnete Gruppen-Anteile).
  const now = currentMonth();
  const avgStart = settings.startMonth && settings.startMonth <= now ? settings.startMonth : now;
  const avgMonths = monthCount(avgStart, now);
  const avgSums = new Map();
  const addAvg = (row) => {
    if (row.month >= avgStart && row.month <= now) {
      avgSums.set(row.category_id, (avgSums.get(row.category_id) ?? 0) + (row.cents ?? 0));
    }
  };
  entrySumsRows.results.forEach(addAvg);
  mappedSumsRows.results.forEach(addAvg);

  const categories = categoryRows.results.map((c) => ({
    id: c.id,
    name: c.name,
    countsTowardMonth: c.counts_toward_month === 1,
    sortOrder: c.sort_order,
    archived: c.archived === 1,
    monthSumCents: categorySumsByMonth.get(`${month}|${c.id}`) ?? 0,
    avgCents: Math.round((avgSums.get(c.id) ?? 0) / avgMonths),
  }));

  const groupShares = [];
  const mappedShares = [];
  for (const row of shareItemRows.results) {
    if (row.category_id) {
      mappedShares.push({
        expenseId: row.expense_id,
        categoryId: row.category_id,
        groupId: row.group_id,
        groupName: row.group_name,
        description: row.description,
        spentOn: row.spent_on,
        shareCents: row.share_cents,
      });
      continue;
    }
    let group = groupShares.find((g) => g.groupId === row.group_id);
    if (!group) {
      group = { groupId: row.group_id, groupName: row.group_name, sumCents: 0, items: [] };
      groupShares.push(group);
    }
    group.sumCents += row.share_cents;
    group.items.push({
      expenseId: row.expense_id,
      description: row.description,
      spentOn: row.spent_on,
      shareCents: row.share_cents,
    });
  }

  return json({
    month,
    settings: { budgetStartMonth: settings.startMonth, carryoverEnabled: settings.carryoverEnabled },
    ...overview,
    categories,
    entries: entryRows.results.map((e) => ({
      id: e.id,
      categoryId: e.category_id,
      spentOn: e.spent_on,
      description: e.description,
      amountCents: e.amount_cents,
    })),
    groupShares,
    mappedShares,
    recurring,
  });
}
