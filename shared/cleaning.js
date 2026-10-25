// Putzplan-Rotation: Aufgaben sind alle n Wochen fällig (Rhythmus) und rücken
// bei jeder fälligen Runde eine Person weiter. Alles deterministisch aus dem
// Wochenindex – kein gespeicherter Zustand nötig.

/** Heutiges Datum in Wien als YYYY-MM-DD (Workers rechnen sonst in UTC). */
export function viennaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date());
}

/** Heutiger Wochentag in Wien als Index (Montag = 0 … Sonntag = 6). */
export function viennaWeekdayIndex() {
  return (new Date(viennaToday() + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

/** Aktuelle Stunde in Wien (0–23). */
export function viennaHour() {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', hour12: false }).format(new Date())
  );
}

/**
 * Erinnerungs-Stufe für eine offene Aufgabe: 0 am Stichtag, danach pro
 * Folgetag zwei Stufen (vormittags/ab 14 Uhr). Null, solange der Stichtag
 * noch nicht erreicht ist. Jede Stufe wird nur einmal verschickt.
 */
export function reminderStage(dueDay, todayIndex, hour) {
  if (todayIndex < dueDay) return null;
  if (todayIndex === dueDay) return 0;
  return (todayIndex - dueDay) * 2 - (hour < 14 ? 1 : 0);
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

// Vor dieser Woche läuft der Putzplan nicht (Start des Systems am 26.10.2026).
export const FIRST_WEEK = '2026-10-26';

/** Ist die Aufgabe in dieser Woche fällig? */
export function isDueWeek(weekStart, intervalWeeks) {
  if (weekStart < FIRST_WEEK) return false;
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
 * Jede fällige Aufgabe läuft – die Aufgabe hat Vorrang. Verteilt wird so
 * gleichmäßig wie möglich: Kollidieren zwei Aufgaben bei derselben Person,
 * rückt die zweite auf die nächste freie Person weiter, und niemand bekommt
 * eine zweite Aufgabe, bevor nicht alle eine haben. Sind mehr Aufgaben
 * fällig als Personen da sind, hat also jemand zwei – wer, rotiert mit.
 *
 * Jeder Durchgang bekommt einen Wochentag (`day`, Montag = 0), gleichmäßig
 * über die Woche gestreut: die Aufgaben der Woche untereinander, und bei
 * 2x/3x die Woche die eigenen Durchgänge (Mo/Do bzw. Mo/Mi/Fr).
 * @param {{id: string, interval_weeks?: number, times_per_week?: number}[]} tasks – sortiert (sort_order, name)
 * @param {string[]} memberIds – sortiert (user_id)
 * @param {Set<string>} doneSet – `${taskId}|${weekStart}|${slot}` der erledigten Durchgänge
 * @returns {{taskId: string, slot: number, assigneeId: string, done: boolean, day: number}[]}
 */
export function weekAssignments(tasks, memberIds, weekStart, doneSet) {
  const n = memberIds.length;
  if (n === 0) return [];

  const due = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => isDueWeek(weekStart, task.interval_weeks));

  const used = new Set();
  const result = [];
  due.forEach(({ task, index }, position) => {
    // Erst wenn alle eine Aufgabe haben, beginnt die zweite Runde.
    if (used.size === n) used.clear();
    let member = assigneeIndex(weekStart, task.interval_weeks, index, n);
    while (used.has(member)) member = (member + 1) % n;
    used.add(member);
    const times = Math.max(1, task.times_per_week ?? 1);
    for (let slot = 0; slot < times; slot++) {
      const day = times > 1 ? Math.floor((slot * 7) / times) : Math.floor((position * 7) / due.length);
      result.push({
        taskId: task.id,
        slot,
        assigneeId: memberIds[member],
        done: doneSet.has(`${task.id}|${weekStart}|${slot}`),
        day,
      });
    }
  });
  return result;
}
