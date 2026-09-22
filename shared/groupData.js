// Datenbankzugriffe für Gruppen, die mehrere Endpunkte brauchen.

import { computeBalances } from './split.js';

/** Gruppe laden und Mitgliedschaft prüfen. Gibt null zurück, wenn kein Zugriff. */
export async function loadGroupForMember(env, groupId, userId) {
  const group = await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first();
  if (!group) return null;
  const member = await env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(groupId, userId)
    .first();
  return member ? group : null;
}

/** Salden aller Mitglieder einer Gruppe. */
export async function loadBalances(env, groupId) {
  const [members, expenses, shares, settlements] = await env.DB.batch([
    env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(groupId),
    env.DB.prepare(
      'SELECT id, paid_by, amount_cents FROM group_expenses WHERE group_id = ? AND deleted_at IS NULL'
    ).bind(groupId),
    env.DB.prepare(
      `SELECT s.expense_id, s.user_id, s.share_cents FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       WHERE e.group_id = ? AND e.deleted_at IS NULL`
    ).bind(groupId),
    // Nur bestätigte Ausgleichszahlungen zählen in die Salden.
    env.DB.prepare(
      'SELECT from_user, to_user, amount_cents FROM settlements WHERE group_id = ? AND confirmed_at IS NOT NULL'
    ).bind(groupId),
  ]);

  const sharesByExpense = new Map();
  for (const s of shares.results) {
    if (!sharesByExpense.has(s.expense_id)) sharesByExpense.set(s.expense_id, []);
    sharesByExpense.get(s.expense_id).push({ userId: s.user_id, shareCents: s.share_cents });
  }

  return computeBalances(
    members.results.map((m) => m.user_id),
    expenses.results.map((e) => ({
      paidBy: e.paid_by,
      amountCents: e.amount_cents,
      shares: sharesByExpense.get(e.id) ?? [],
    })),
    settlements.results.map((s) => ({
      fromUser: s.from_user,
      toUser: s.to_user,
      amountCents: s.amount_cents,
    }))
  );
}
