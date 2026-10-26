// Putzplan-Erinnerungen verschicken: am Stichtag einmal, danach pro Folgetag
// zweimal, solange offen. Läuft an zwei Stellen mit derselben Sperre
// (`cleaning_notified` mit Stufe): im Cron-Worker (feste Uhrzeiten) und beim
// Laden der Gruppenliste (falls der Worker mal nicht läuft).

import {
  reminderStage,
  viennaHour,
  viennaToday,
  viennaWeekdayIndex,
  weekAssignments,
  weekStartOf,
} from './cleaning.js';
import { notifyUsers } from './notify.js';

export async function checkCleaningReminders(env) {
  try {
    const { results: groups } = await env.DB.prepare(
      "SELECT id, name FROM groups WHERE kind = 'wg' AND archived = 0"
    ).all();
    if (groups.length === 0) return;

    const weekStart = weekStartOf(viennaToday());
    const ids = groups.map((g) => g.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [taskRows, memberRows, doneRows, notifiedRows] = await env.DB.batch([
      env.DB.prepare(
        `SELECT id, group_id, name, interval_weeks, times_per_week FROM cleaning_tasks
         WHERE group_id IN (${placeholders}) ORDER BY sort_order, name`
      ).bind(...ids),
      env.DB.prepare(
        `SELECT group_id, user_id FROM group_members WHERE group_id IN (${placeholders}) ORDER BY user_id`
      ).bind(...ids),
      env.DB.prepare('SELECT task_id, slot FROM cleaning_done WHERE week_start = ?').bind(weekStart),
      env.DB.prepare('SELECT task_id, stage FROM cleaning_notified WHERE week_start = ?').bind(weekStart),
    ]);

    const doneSet = new Set(doneRows.results.map((d) => `${d.task_id}|${weekStart}|${d.slot}`));
    const notified = new Set(notifiedRows.results.map((n) => `${n.task_id}|${n.stage}`));
    const taskNames = new Map(taskRows.results.map((t) => [t.id, t.name]));
    const today = viennaWeekdayIndex();
    const hour = viennaHour();

    for (const group of groups) {
      const tasks = taskRows.results.filter((t) => t.group_id === group.id);
      const memberIds = memberRows.results.filter((m) => m.group_id === group.id).map((m) => m.user_id);
      const assignments = weekAssignments(tasks, memberIds, weekStart, doneSet);

      // Stichtag je Aufgabe = frühester offener Durchgang.
      const openByTask = new Map();
      for (const a of assignments) {
        if (a.done) continue;
        const open = openByTask.get(a.taskId);
        if (!open || a.day < open.day) openByTask.set(a.taskId, a);
      }

      for (const a of openByTask.values()) {
        const stage = reminderStage(a.day, today, hour);
        if (stage === null || notified.has(`${a.taskId}|${stage}`)) continue;
        try {
          // Sperre zuerst: Nur wer die Zeile anlegt, schickt – so gibt es jede
          // Stufe auch bei gleichzeitigen Auslösern nur einmal.
          const res = await env.DB.prepare(
            'INSERT INTO cleaning_notified (task_id, week_start, stage) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
          )
            .bind(a.taskId, weekStart, stage)
            .run();
          if (!res.meta || res.meta.changes === 0) continue;
          const task = taskRows.results.find((t) => t.id === a.taskId);
          const times = Math.max(1, task?.times_per_week ?? 1);
          const name = taskNames.get(a.taskId);
          await notifyUsers(env, [a.assigneeId], {
            title: `Putzplan · ${group.name}`,
            body:
              stage === 0
                ? `Heute bist du mit „${name}" dran${times > 1 ? ` (${times}× diese Woche)` : ''}.`
                : `Noch offen: „${name}" – bitte erledigen.`,
            url: '/#/putzplan',
          });
        } catch {
          // Einzelner Versandfehler ist egal
        }
      }
    }
  } catch {
    // Erinnerungen dürfen nie den Aufrufer stören
  }
}
