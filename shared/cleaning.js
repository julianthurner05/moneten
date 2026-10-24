// Putzplan-Rotation: Aufgaben sind alle n Wochen fällig (Rhythmus) und rücken
// bei jeder fälligen Runde eine Person weiter. Alles deterministisch aus dem
// Wochenindex – kein gespeicherter Zustand nötig.

/** Heutiges Datum in Wien als YYYY-MM-DD (Workers rechnen sonst in UTC). */
export function viennaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date());
}

/** Montag der Woche eines YYYY-MM-DD-Datums, wieder als YYYY-MM-DD. */
export function weekStartOf(dateString) {
  const d = new Date(dateString + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Fortlaufender Wochenindex eines Montags (identisch zu js/format.js). */
export function weekIndexOf(weekStart) {
  return Math.floor((Date.parse(weekStart + 'T00:00:00Z') / 86400000 + 3) / 7);
}

/** Montag zum Wochenindex (Umkehrung von weekIndexOf). */
export function weekStartFromIndex(index) {
  return new Date((index * 7 - 3) * 86400000).toISOString().slice(0, 10);
}

/** Ist die Aufgabe in dieser Woche fällig? */
export function isDueWeek(weekStart, intervalWeeks) {
  const interval = Math.max(1, intervalWeeks ?? 1);
  return weekIndexOf(weekStart) % interval === 0;
}

/**
 * Wer ist in einer fälligen Woche dran? Pro fälliger Runde rückt die Aufgabe
 * eine Person weiter; bei Rhythmus 1 entspricht das der bisherigen Rotation.
 * @param {string} weekStart – Montag einer fälligen Woche
 * @param {number} taskIndex – Position der Aufgabe in der sortierten Liste
 * @param {number} memberCount
 * @returns {number} Index in der (nach user_id sortierten) Mitgliederliste
 */
export function assigneeIndex(weekStart, intervalWeeks, taskIndex, memberCount) {
  const interval = Math.max(1, intervalWeeks ?? 1);
  const occurrence = Math.floor(weekIndexOf(weekStart) / interval);
  return (occurrence + taskIndex) % memberCount;
}

/**
 * Putzplan-Stand einer Gruppe für eine Woche: ein Eintrag pro Durchgang
 * (times_per_week > 1 ergibt mehrere Slots derselben Person in der Woche).
 *
 * Niemand bekommt mehr als eine Aufgabe pro Woche: Kollidieren zwei fällige
 * Aufgaben bei derselben Person, rückt die zweite auf die nächste freie
 * Person weiter. Sind mehr Aufgaben fällig als Personen da sind, pausiert
 * der Überhang – rotierend, jede Woche eine andere Aufgabe.
 * @param {{id: string, interval_weeks?: number, times_per_week?: number}[]} tasks – sortiert (sort_order, name)
 * @param {string[]} memberIds – sortiert (user_id)
 * @param {Set<string>} doneSet – `${taskId}|${weekStart}|${slot}` der erledigten Durchgänge
 * @returns {{taskId: string, slot: number, assigneeId: string, done: boolean}[]}
 */
export function weekAssignments(tasks, memberIds, weekStart, doneSet) {
  const n = memberIds.length;
  if (n === 0) return [];
  const weekIdx = weekIndexOf(weekStart);

  const due = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => isDueWeek(weekStart, task.interval_weeks));

  // Überhang pausiert rotierend: Auswahl-Reihenfolge verschiebt sich pro Woche.
  const selected = due
    .map((entry, rank) => ({ ...entry, key: (rank + weekIdx) % due.length }))
    .sort((a, b) => a.key - b.key)
    .slice(0, n)
    .sort((a, b) => a.index - b.index);

  const used = new Set();
  const result = [];
  for (const { task, index } of selected) {
    let member = assigneeIndex(weekStart, task.interval_weeks, index, n);
    while (used.has(member)) member = (member + 1) % n;
    used.add(member);
    const times = Math.max(1, task.times_per_week ?? 1);
    for (let slot = 0; slot < times; slot++) {
      result.push({ taskId: task.id, slot, assigneeId: memberIds[member], done: doneSet.has(`${task.id}|${weekStart}|${slot}`) });
    }
  }
  return result;
}
