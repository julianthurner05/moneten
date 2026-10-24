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
 * Nächste Woche nach `afterWeek`, in der die Aufgabe fällig ist und die Person
 * dran ist (null, wenn die Person nie drankommt – kommt bei Rotation nicht vor).
 */
export function nextTurnWeek(afterWeek, intervalWeeks, taskIndex, memberCount, memberIndex) {
  const interval = Math.max(1, intervalWeeks ?? 1);
  let occurrence = Math.floor(weekIndexOf(afterWeek) / interval) + 1;
  for (let i = 0; i < memberCount; i++, occurrence++) {
    if ((occurrence + taskIndex) % memberCount === memberIndex) {
      return weekStartFromIndex(occurrence * interval);
    }
  }
  return null;
}

/**
 * Putzplan-Stand einer Gruppe für eine Woche: ein Eintrag pro Durchgang
 * (times_per_week > 1 ergibt mehrere Slots derselben Person in der Woche).
 * @param {{id: string, interval_weeks?: number, times_per_week?: number}[]} tasks – sortiert (sort_order, name)
 * @param {string[]} memberIds – sortiert (user_id)
 * @param {Set<string>} doneSet – `${taskId}|${weekStart}|${slot}` der erledigten Durchgänge
 * @returns {{taskId: string, slot: number, assigneeId: string, done: boolean}[]}
 */
export function weekAssignments(tasks, memberIds, weekStart, doneSet) {
  if (memberIds.length === 0) return [];
  const result = [];
  tasks.forEach((task, index) => {
    if (!isDueWeek(weekStart, task.interval_weeks)) return;
    const assigneeId = memberIds[assigneeIndex(weekStart, task.interval_weeks, index, memberIds.length)];
    const times = Math.max(1, task.times_per_week ?? 1);
    for (let slot = 0; slot < times; slot++) {
      result.push({ taskId: task.id, slot, assigneeId, done: doneSet.has(`${task.id}|${weekStart}|${slot}`) });
    }
  });
  return result;
}
