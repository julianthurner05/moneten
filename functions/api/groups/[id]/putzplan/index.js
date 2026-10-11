// Putzplan: Aufgaben lesen/anlegen, Erledigt-Markierungen pro Woche.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, json, nowIso, readJson } from '../../../../../shared/http.js';

export async function onRequestGet({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);

  const [tasks, done, members] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, sort_order FROM cleaning_tasks WHERE group_id = ? ORDER BY sort_order, name').bind(
      group.id
    ),
    env.DB.prepare(
      `SELECT d.task_id, d.week_start, d.done_by FROM cleaning_done d
       JOIN cleaning_tasks t ON t.id = d.task_id WHERE t.group_id = ?`
    ).bind(group.id),
    env.DB.prepare(
      `SELECT u.id, u.display_name FROM group_members m JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? ORDER BY u.id`
    ).bind(group.id),
  ]);

  return json({
    archived: !!group.archived,
    tasks: tasks.results.map((t) => ({ id: t.id, name: t.name })),
    done: done.results.map((d) => ({ taskId: d.task_id, weekStart: d.week_start, doneBy: d.done_by })),
    members: members.results.map((m) => ({ id: m.id, displayName: m.display_name })),
  });
}

export async function onRequestPost({ request, env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist archiviert.', 400);

  const body = await readJson(request);
  const name = body?.name?.trim();
  if (!name) return error('Bitte eine Aufgabe eingeben.');

  const max = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM cleaning_tasks WHERE group_id = ?')
    .bind(group.id)
    .first();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO cleaning_tasks (id, group_id, name, sort_order, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, group.id, name, (max?.m ?? 0) + 1, data.user.id, nowIso())
    .run();
  return json({ id });
}
