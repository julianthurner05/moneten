// Gruppenliste mit eigenem Saldo pro Gruppe sowie Gruppe anlegen. Nebenbei:
// Putzplan-Zähler pro WG und „Du bist dran"-Mitteilungen für fällige Wochen.

import { error, isNonEmptyString, json, nowIso, readJson } from '../../../shared/http.js';
import {
  reminderStage,
  viennaHour,
  viennaToday,
  viennaWeekdayIndex,
  weekAssignments,
  weekStartOf,
} from '../../../shared/cleaning.js';
import { notifyUsers } from '../../../shared/notify.js';

export async function onRequestGet({ env, data, waitUntil }) {
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
      'SELECT group_id, SUM(amount_cents) AS c FROM settlements WHERE from_user = ? AND confirmed_at IS NOT NULL GROUP BY group_id'
    ).bind(userId),
    env.DB.prepare(
      'SELECT group_id, SUM(amount_cents) AS c FROM settlements WHERE to_user = ? AND confirmed_at IS NOT NULL GROUP BY group_id'
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

  await addCleaningStatus(env, result, userId, waitUntil);

  return json({ groups: result, totalBalanceCents });
}

/**
 * Putzplan-Stand der Woche: zählt die eigenen offenen Aufgaben pro WG-Gruppe
 * (myCleaningCount) und schickt – einmal pro Aufgabe und Woche – die
 * „Du bist dran"-Mitteilung an die Person, die an der Reihe ist. Läuft beim
 * Laden der Gruppenliste, weil Pages im Gratis-Tarif keinen Zeitplan hat.
 */
async function addCleaningStatus(env, groups, userId, waitUntil) {
  const wgGroups = groups.filter((g) => g.kind === 'wg' && !g.archived);
  if (wgGroups.length === 0) return;

  const weekStart = weekStartOf(viennaToday());
  const ids = wgGroups.map((g) => g.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [taskRows, memberRows, doneRows, notifiedRows, seenRows, expenseRows, settlementRows, shoppingRows] =
    await env.DB.batch([
      env.DB.prepare(
        `SELECT id, group_id, name, interval_weeks, times_per_week FROM cleaning_tasks
       WHERE group_id IN (${placeholders}) ORDER BY sort_order, name`
      ).bind(...ids),
      env.DB.prepare(
        `SELECT group_id, user_id FROM group_members WHERE group_id IN (${placeholders}) ORDER BY user_id`
      ).bind(...ids),
      env.DB.prepare('SELECT task_id, slot FROM cleaning_done WHERE week_start = ?').bind(weekStart),
      env.DB.prepare('SELECT task_id, stage FROM cleaning_notified WHERE week_start = ?').bind(weekStart),
      // Für die roten Tab-Zähler: Was haben andere seit dem letzten Ansehen ergänzt?
      env.DB.prepare(
        `SELECT group_id, tab, seen_at FROM tab_seen WHERE user_id = ? AND group_id IN (${placeholders})`
      ).bind(userId, ...ids),
      env.DB.prepare(
        `SELECT group_id, is_einzug, created_by, created_at FROM group_expenses
       WHERE group_id IN (${placeholders}) AND deleted_at IS NULL AND created_by != ?`
      ).bind(...ids, userId),
      env.DB.prepare(
        `SELECT group_id, is_einzug, created_by, created_at FROM settlements
       WHERE group_id IN (${placeholders}) AND created_by != ?`
      ).bind(...ids, userId),
      env.DB.prepare(
        `SELECT group_id, created_by, created_at FROM shopping_items
       WHERE group_id IN (${placeholders}) AND created_by != ?`
      ).bind(...ids, userId),
    ]);

  const doneSet = new Set(doneRows.results.map((d) => `${d.task_id}|${weekStart}|${d.slot}`));
  const notified = new Set(notifiedRows.results.map((n) => `${n.task_id}|${n.stage}`));
  const taskNames = new Map(taskRows.results.map((t) => [t.id, t.name]));
  const today = viennaWeekdayIndex();
  const hour = viennaHour();
  const toNotify = [];

  const seen = new Map(seenRows.results.map((r) => [`${r.group_id}|${r.tab}`, r.seen_at]));

  for (const group of wgGroups) {
    const tasks = taskRows.results.filter((t) => t.group_id === group.id);
    const memberIds = memberRows.results.filter((m) => m.group_id === group.id).map((m) => m.user_id);
    const assignments = weekAssignments(tasks, memberIds, weekStart, doneSet);
    group.myCleaningCount = assignments.filter((a) => a.assigneeId === userId && !a.done && a.day <= today).length;
    // Erinnerung pro Aufgabe: am Stichtag einmal, danach pro Folgetag zweimal,
    // solange noch ein fälliger Durchgang offen ist. Stichtag = frühester
    // offener Durchgang.
    const openByTask = new Map();
    for (const a of assignments) {
      if (a.done) continue;
      const open = openByTask.get(a.taskId);
      if (!open || a.day < open.day) openByTask.set(a.taskId, a);
    }
    for (const a of openByTask.values()) {
      const stage = reminderStage(a.day, today, hour);
      if (stage === null || notified.has(`${a.taskId}|${stage}`)) continue;
      toNotify.push({ ...a, stage, groupName: group.name });
    }

    // Neues von anderen seit dem letzten Ansehen des Tabs. Ohne gemerkten
    // Zeitpunkt (Tab nie geöffnet) bleibt der Zähler leer.
    const countNew = (tab, rows, match) => {
      const since = seen.get(`${group.id}|${tab}`);
      if (!since) return 0;
      return rows.filter((r) => r.group_id === group.id && r.created_at > since && match(r)).length;
    };
    group.tabNew = {
      gruppe:
        countNew('gruppe', expenseRows.results, (r) => r.is_einzug === 0) +
        countNew('gruppe', settlementRows.results, (r) => r.is_einzug === 0),
      einzug:
        countNew('einzug', expenseRows.results, (r) => r.is_einzug === 1) +
        countNew('einzug', settlementRows.results, (r) => r.is_einzug === 1),
      einkauf: countNew('einkauf', shoppingRows.results, () => true),
    };
  }

  if (toNotify.length === 0) return;
  waitUntil(
    (async () => {
      for (const turn of toNotify) {
        try {
          // Sperre zuerst: Nur wer die Zeile anlegt, schickt – so gibt es jede
          // Stufe auch bei gleichzeitigen Aufrufen nur einmal.
          const res = await env.DB.prepare(
            'INSERT INTO cleaning_notified (task_id, week_start, stage) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
          )
            .bind(turn.taskId, weekStart, turn.stage)
            .run();
          if (!res.meta || res.meta.changes === 0) continue;
          const task = taskRows.results.find((t) => t.id === turn.taskId);
          const times = Math.max(1, task?.times_per_week ?? 1);
          const name = taskNames.get(turn.taskId);
          await notifyUsers(env, [turn.assigneeId], {
            title: `Putzplan · ${turn.groupName}`,
            body:
              turn.stage === 0
                ? `Heute bist du mit „${name}" dran${times > 1 ? ` (${times}× diese Woche)` : ''}.`
                : `Noch offen: „${name}" – bitte erledigen.`,
            url: '/#/putzplan',
          });
        } catch {
          // Mitteilungen dürfen die Gruppenliste nie stören
        }
      }
    })()
  );
}

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');
  if (!isNonEmptyString(body.name, 64)) return error('Gruppenname fehlt.');
  const kind = body.kind ?? 'standard';
  if (!['standard', 'wg'].includes(kind)) return error('Ungültige Gruppenart.');

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
       VALUES (?, ?, ?, 'EUR', 0, ?, ?)`
    ).bind(groupId, body.name.trim(), kind, data.user.id, now),
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
