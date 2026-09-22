// Gruppendetail: Mitglieder mit Salden, Ausgaben, Ausgleichszahlungen, Vorschläge.

import { loadBalances, loadGroupForMember } from '../../../../shared/groupData.js';
import { suggestSettlements } from '../../../../shared/split.js';
import { error, json } from '../../../../shared/http.js';

export async function onRequestGet({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const [members, expenses, shares, settlements] = await env.DB.batch([
    env.DB.prepare(
      `SELECT u.id, u.display_name FROM group_members m
       JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY u.display_name`
    ).bind(group.id),
    env.DB.prepare(
      `SELECT id, paid_by, amount_cents, description, spent_on, split_mode, created_by
       FROM group_expenses WHERE group_id = ? AND deleted_at IS NULL
       ORDER BY spent_on DESC, created_at DESC`
    ).bind(group.id),
    env.DB.prepare(
      `SELECT s.expense_id, s.user_id, s.share_cents FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       WHERE e.group_id = ? AND e.deleted_at IS NULL`
    ).bind(group.id),
    env.DB.prepare(
      `SELECT id, from_user, to_user, amount_cents, settled_on, created_by
       FROM settlements WHERE group_id = ? ORDER BY settled_on DESC, created_at DESC`
    ).bind(group.id),
  ]);

  const sharesByExpense = new Map();
  for (const s of shares.results) {
    if (!sharesByExpense.has(s.expense_id)) sharesByExpense.set(s.expense_id, []);
    sharesByExpense.get(s.expense_id).push({ userId: s.user_id, shareCents: s.share_cents });
  }

  const balances = await loadBalances(env, group.id);

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
      shares: sharesByExpense.get(e.id) ?? [],
    })),
    settlements: settlements.results.map((s) => ({
      id: s.id,
      fromUser: s.from_user,
      toUser: s.to_user,
      amountCents: s.amount_cents,
      settledOn: s.settled_on,
      createdBy: s.created_by,
    })),
    suggestions: suggestSettlements(balances),
  });
}
