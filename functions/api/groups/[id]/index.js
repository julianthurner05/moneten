// Gruppendetail: Mitglieder mit Salden, Ausgaben, Ausgleichszahlungen, Vorschläge,
// eigene Kategorien und private Einzugsposten.

import { ensureDefaultCategories } from '../../../../shared/categories.js';
import { loadGroupForMember } from '../../../../shared/groupData.js';
import { computeBalances, suggestSettlements } from '../../../../shared/split.js';
import { error, json } from '../../../../shared/http.js';

export async function onRequestGet({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  await ensureDefaultCategories(env, data.user.id);

  const [members, expenses, shares, settlements, myMappings, myCategories, einzugPersonal, einzugTransfers] =
    await env.DB.batch([
      env.DB.prepare(
        `SELECT u.id, u.display_name FROM group_members m
         JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY u.display_name`
      ).bind(group.id),
      env.DB.prepare(
        `SELECT id, paid_by, amount_cents, description, spent_on, split_mode, created_by, is_einzug, is_deposit
         FROM group_expenses WHERE group_id = ? AND deleted_at IS NULL
         ORDER BY spent_on DESC, created_at DESC`
      ).bind(group.id),
      env.DB.prepare(
        `SELECT s.expense_id, s.user_id, s.share_cents FROM expense_shares s
         JOIN group_expenses e ON e.id = s.expense_id
         WHERE e.group_id = ? AND e.deleted_at IS NULL`
      ).bind(group.id),
      env.DB.prepare(
        `SELECT id, from_user, to_user, amount_cents, settled_on, created_by, confirmed_at, is_einzug
         FROM settlements WHERE group_id = ? ORDER BY settled_on DESC, created_at DESC`
      ).bind(group.id),
      env.DB.prepare(
        `SELECT c.expense_id, c.category_id FROM personal_expense_categories c
         JOIN group_expenses e ON e.id = c.expense_id
         WHERE c.user_id = ? AND e.group_id = ?`
      ).bind(data.user.id, group.id),
      env.DB.prepare(
        'SELECT id, name FROM personal_categories WHERE user_id = ? AND archived = 0 ORDER BY sort_order, name'
      ).bind(data.user.id),
      env.DB.prepare(
        `SELECT id, description, amount_cents, spent_on FROM einzug_personal
         WHERE group_id = ? AND user_id = ? ORDER BY spent_on DESC, created_at DESC`
      ).bind(group.id, data.user.id),
      env.DB.prepare(
        `SELECT t.expense_id, t.user_id FROM einzug_transfers t
         JOIN group_expenses e ON e.id = t.expense_id
         WHERE e.group_id = ?`
      ).bind(group.id),
    ]);

  const sharesByExpense = new Map();
  for (const s of shares.results) {
    if (!sharesByExpense.has(s.expense_id)) sharesByExpense.set(s.expense_id, []);
    sharesByExpense.get(s.expense_id).push({ userId: s.user_id, shareCents: s.share_cents });
  }
  const mappingByExpense = new Map(myMappings.results.map((m) => [m.expense_id, m.category_id]));

  // Salden direkt aus den schon geladenen Daten – spart einen zweiten DB-Roundtrip.
  const balances = computeBalances(
    members.results.map((m) => m.id),
    expenses.results.map((e) => ({
      paidBy: e.paid_by,
      amountCents: e.amount_cents,
      shares: sharesByExpense.get(e.id) ?? [],
    })),
    settlements.results
      .filter((s) => s.confirmed_at)
      .map((s) => ({ fromUser: s.from_user, toUser: s.to_user, amountCents: s.amount_cents }))
  );

  return json({
    group: {
      id: group.id,
      name: group.name,
      kind: group.kind,
      currency: group.currency,
      archived: !!group.archived,
    },
    members: members.results.map((m) => ({
      id: m.id,
      displayName: m.display_name,
      balanceCents: balances.get(m.id) ?? 0,
    })),
    expenses: expenses.results.map((e) => ({
      id: e.id,
      paidBy: e.paid_by,
      amountCents: e.amount_cents,
      description: e.description,
      spentOn: e.spent_on,
      splitMode: e.split_mode,
      createdBy: e.created_by,
      isEinzug: !!e.is_einzug,
      isDeposit: !!e.is_deposit,
      myCategoryId: mappingByExpense.get(e.id) ?? null,
      shares: sharesByExpense.get(e.id) ?? [],
    })),
    settlements: settlements.results.map((s) => ({
      id: s.id,
      fromUser: s.from_user,
      toUser: s.to_user,
      amountCents: s.amount_cents,
      settledOn: s.settled_on,
      createdBy: s.created_by,
      confirmed: !!s.confirmed_at,
      isEinzug: !!s.is_einzug,
    })),
    suggestions: suggestSettlements(balances),
    myCategories: myCategories.results.map((c) => ({ id: c.id, name: c.name })),
    einzugPersonal: einzugPersonal.results.map((e) => ({
      id: e.id,
      description: e.description,
      amountCents: e.amount_cents,
      spentOn: e.spent_on,
    })),
    einzugTransfers: einzugTransfers.results.map((t) => ({ expenseId: t.expense_id, userId: t.user_id })),
  });
}
