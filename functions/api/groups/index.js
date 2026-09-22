// Gruppenliste mit eigenem Saldo pro Gruppe sowie Gruppe anlegen.

import { error, isNonEmptyString, json, nowIso, readJson } from '../../../shared/http.js';

export async function onRequestGet({ env, data }) {
  const userId = data.user.id;
  const [groups, paid, shares, given, received] = await env.DB.batch([
    env.DB.prepare(
      `SELECT g.id, g.name, g.kind, g.currency, g.archived,
              (SELECT COUNT(*) FROM group_members m2 WHERE m2.group_id = g.id) AS member_count
       FROM groups g JOIN group_members m ON m.group_id = g.id
       WHERE m.user_id = ? ORDER BY g.created_at DESC`
    ).bind(userId),
    env.DB.prepare(
      `SELECT group_id, SUM(amount_cents) AS c FROM group_expenses
       WHERE paid_by = ? AND deleted_at IS NULL GROUP BY group_id`
    ).bind(userId),
    env.DB.prepare(
      `SELECT e.group_id, SUM(s.share_cents) AS c FROM expense_shares s
       JOIN group_expenses e ON e.id = s.expense_id
       WHERE s.user_id = ? AND e.deleted_at IS NULL GROUP BY e.group_id`
    ).bind(userId),
    env.DB.prepare(
      'SELECT group_id, SUM(amount_cents) AS c FROM settlements WHERE from_user = ? GROUP BY group_id'
    ).bind(userId),
    env.DB.prepare(
      'SELECT group_id, SUM(amount_cents) AS c FROM settlements WHERE to_user = ? GROUP BY group_id'
    ).bind(userId),
  ]);

  const toMap = (rows) => new Map(rows.results.map((r) => [r.group_id, r.c ?? 0]));
  const paidMap = toMap(paid);
  const sharesMap = toMap(shares);
  const givenMap = toMap(given);
  const receivedMap = toMap(received);

  let totalBalanceCents = 0;
  const result = groups.results.map((g) => {
    const balance =
      (paidMap.get(g.id) ?? 0) -
      (sharesMap.get(g.id) ?? 0) +
      (givenMap.get(g.id) ?? 0) -
      (receivedMap.get(g.id) ?? 0);
    if (!g.archived) totalBalanceCents += balance;
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      currency: g.currency,
      archived: !!g.archived,
      memberCount: g.member_count,
      myBalanceCents: balance,
    };
  });

  return json({ groups: result, totalBalanceCents });
}

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');
  if (!isNonEmptyString(body.name, 64)) return error('Gruppenname fehlt.');

  const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds)] : [];
  if (!memberIds.includes(data.user.id)) memberIds.push(data.user.id);

  const { results: existing } = await env.DB.prepare(
    `SELECT id FROM users WHERE id IN (${memberIds.map(() => '?').join(',')})`
  )
    .bind(...memberIds)
    .all();
  if (existing.length !== memberIds.length) return error('Unbekanntes Mitglied.');

  const groupId = crypto.randomUUID();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO groups (id, name, kind, currency, archived, created_by, created_at)
       VALUES (?, ?, 'standard', 'EUR', 0, ?, ?)`
    ).bind(groupId, body.name.trim(), data.user.id, now),
    ...memberIds.map((userId) =>
      env.DB.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind(
        groupId,
        userId,
        now
      )
    ),
  ]);

  return json({ id: groupId });
}
