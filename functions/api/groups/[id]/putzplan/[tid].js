// Putzplan-Aufgabe umbenennen, abhaken oder löschen.

import { loadGroupForMember } from '../../../../../shared/groupData.js';
import { error, isDateString, json, nowIso, readJson } from '../../../../../shared/http.js';

async function loadTask(env, data, params) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return { error: error('Gruppe nicht gefunden.', 404) };
  if (group.archived) return { error: error('Die Gruppe ist archiviert.', 400) };
  const task = await env.DB.prepare('SELECT id FROM cleaning_tasks WHERE id = ? AND group_id = ?')
    .bind(params.tid, group.id)
    .first();
  if (!task) return { error: error('Aufgabe nicht gefunden.', 404) };
  return { group };
}

export async function onRequestPut({ request, env, data, params }) {
  const loaded = await loadTask(env, data, params);
  if (loaded.error) return loaded.error;
  const body = await readJson(request);
  if (!body) return error('Ungültige Anfrage.');

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return error('Bitte eine Aufgabe eingeben.');
    await env.DB.prepare('UPDATE cleaning_tasks SET name = ? WHERE id = ?').bind(name, params.tid).run();
  }
  if (body.intervalWeeks !== undefined) {
    const interval = body.intervalWeeks;
    if (!Number.isInteger(interval) || interval < 1 || interval > 8) return error('Ungültiger Rhythmus.');
    await env.DB.prepare('UPDATE cleaning_tasks SET interval_weeks = ? WHERE id = ?')
      .bind(interval, params.tid)
      .run();
  }
  if (body.weekStart !== undefined) {
    if (!isDateString(body.weekStart)) return error('Ungültige Woche.');
    if (body.done) {
      await env.DB.prepare(
        `INSERT INTO cleaning_done (task_id, week_start, done_by, done_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (task_id, week_start) DO NOTHING`
      )
        .bind(params.tid, body.weekStart, data.user.id, nowIso())
        .run();
    } else {
      await env.DB.prepare('DELETE FROM cleaning_done WHERE task_id = ? AND week_start = ?')
        .bind(params.tid, body.weekStart)
        .run();
    }
  }
  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const loaded = await loadTask(env, data, params);
  if (loaded.error) return loaded.error;
  await env.DB.prepare('DELETE FROM cleaning_done WHERE task_id = ?').bind(params.tid).run();
  await env.DB.prepare('DELETE FROM cleaning_notified WHERE task_id = ?').bind(params.tid).run();
  await env.DB.prepare('DELETE FROM cleaning_tasks WHERE id = ?').bind(params.tid).run();
  return json({ ok: true });
}
