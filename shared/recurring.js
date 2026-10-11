// Wiederkehrende Gruppenausgaben: fehlende Monate bis heute als echte
// Gruppenausgaben anlegen (gleich aufgeteilt auf alle Mitglieder).

import { monthAdd } from './month.js';
import { splitEqual } from './split.js';

export async function materializeRecurring(env, groupId) {
  const { results: recs } = await env.DB.prepare('SELECT * FROM group_recurring WHERE group_id = ?')
    .bind(groupId)
    .all();
  if (recs.length === 0) return;

  const { results: members } = await env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ? ORDER BY user_id'
  )
    .bind(groupId)
    .all();
  const memberIds = members.map((m) => m.user_id);
  if (memberIds.length === 0) return;

  const { results: existing } = await env.DB.prepare(
    "SELECT recurring_id, substr(spent_on, 1, 7) AS month FROM group_expenses WHERE group_id = ? AND recurring_id IS NOT NULL"
  )
    .bind(groupId)
    .all();
  const have = new Set(existing.map((e) => `${e.recurring_id}|${e.month}`));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const now = new Date().toISOString();
  const statements = [];
  for (const rec of recs) {
    let month = rec.start_month;
    for (let i = 0; month <= currentMonth && i < 120; i++) {
      const active = !rec.end_month || month <= rec.end_month;
      if (active && !have.has(`${rec.id}|${month}`)) {
        const id = crypto.randomUUID();
        statements.push(
          env.DB.prepare(
            `INSERT INTO group_expenses (id, group_id, paid_by, amount_cents, description, spent_on, split_mode, created_by, created_at, deleted_at, is_einzug, is_deposit, recurring_id)
             VALUES (?, ?, ?, ?, ?, ?, 'equal', ?, ?, NULL, 0, 0, ?)`
          ).bind(id, groupId, rec.paid_by, rec.amount_cents, rec.name, `${month}-01`, rec.created_by, now, rec.id)
        );
        for (const share of splitEqual(rec.amount_cents, memberIds)) {
          statements.push(
            env.DB.prepare('INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)').bind(
              id,
              share.userId,
              share.shareCents
            )
          );
        }
      }
      month = monthAdd(month, 1);
    }
  }
  if (statements.length > 0) await env.DB.batch(statements);
}
