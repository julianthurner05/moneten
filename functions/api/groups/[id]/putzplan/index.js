// Putzplan: persönliche Sicht (eigene fällige Aufgaben, nächste eigene Runden)
// plus Aufgaben lesen/anlegen. Rotation siehe shared/cleaning.js.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { viennaToday, weekAssignments, weekStartOf } from '../../../../../shared/cleaning.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';

// Standard-Aufgaben, die eine WG typischerweise braucht – werden beim ersten
// Öffnen des Putzplans automatisch angelegt (wie die fixen Kategorien).
const DEFAULT_TASKS = ['Küche putzen', 'Bad & WC putzen', 'Staubsaugen & wischen', 'Müll & Altpapier rausbringen'];

async function ensureDefaultTasks(env, group, userId) {
  const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM cleaning_tasks WHERE group_id = ?')
    .bind(group.id)
    .first();
  if (existing.n > 0 || group.archived) return;
  const now = nowIso();
  await env.DB.batch(
    DEFAULT_TASKS.map((name, i) =>
      env.DB.prepare(
        'INSERT INTO cleaning_tasks (id, group_id, name, sort_order, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), group.id, name, i + 1, userId, now)
    )
  );
}

export async function onRequestGet({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  await ensureDefaultTasks(env, group, data.user.id);
  const weekStart = weekStartOf(viennaToday());

  const [taskRows, doneRows, memberRows] = await env.DB.batch([
    env.DB.prepare(
      'SELECT id, name, interval_weeks, times_per_week FROM cleaning_tasks WHERE group_id = ? ORDER BY sort_order, name'
    ).bind(group.id),
    env.DB.prepare(
      `SELECT d.task_id, d.slot FROM cleaning_done d
       JOIN cleaning_tasks t ON t.id = d.task_id WHERE t.group_id = ? AND d.week_start = ?`
    ).bind(group.id, weekStart),
    env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ? ORDER BY user_id').bind(group.id),
  ]);

  const tasks = taskRows.results;
  const memberIds = memberRows.results.map((m) => m.user_id);
  const doneSet = new Set(doneRows.results.map((d) => `${d.task_id}|${weekStart}|${d.slot}`));
  const names = new Map(tasks.map((t) => [t.id, t.name]));

  const assignments = weekAssignments(tasks, memberIds, weekStart, doneSet);
  const mine = assignments
    .filter((a) => a.assigneeId === data.user.id)
    .map((a) => ({ taskId: a.taskId, slot: a.slot, name: names.get(a.taskId), done: a.done }));

  return json({
    archived: !!group.archived,
    weekStart,
    mine,
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.name,
      intervalWeeks: t.interval_weeks ?? 1,
      timesPerWeek: t.times_per_week ?? 1,
    })),
    myOpenCount: mine.filter((m) => !m.done).length,
  });
}

export async function onRequestPost({ request, env, data, params }) {
  if (!data.user.isAdmin) return error('Nur der Admin kann Aufgaben verwalten.', 403);
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  const name = body?.name?.trim();
  if (!name) return error('Bitte eine Aufgabe eingeben.');
  const interval = body.intervalWeeks ?? 1;
  const times = body.timesPerWeek ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 8) return error('Ungültiger Rhythmus.');
  if (!Number.isInteger(times) || times < 1 || times > 7 || (times > 1 && interval !== 1)) {
    return error('Ungültiger Rhythmus.');
  }

  const max = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM cleaning_tasks WHERE group_id = ?')
    .bind(group.id)
    .first();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO cleaning_tasks (id, group_id, name, sort_order, interval_weeks, times_per_week, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, group.id, name, (max?.m ?? 0) + 1, interval, times, data.user.id, nowIso())
    .run();
  return json({ id });
}
