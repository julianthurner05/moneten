// Tests für die Putzplan-Rotation mit Rhythmus.
// Ausführen mit: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assigneeIndex,
  isDueWeek,
  nextTurnWeek,
  weekAssignments,
  weekIndexOf,
  weekStartFromIndex,
  weekStartOf,
} from '../shared/cleaning.js';

test('weekStartOf liefert den Montag, weekStartFromIndex kehrt weekIndexOf um', () => {
  assert.equal(weekStartOf('2026-10-24'), '2026-10-19'); // Samstag → Montag davor
  assert.equal(weekStartOf('2026-10-19'), '2026-10-19'); // Montag bleibt
  for (const monday of ['2026-10-19', '2025-12-29', '1970-01-05']) {
    assert.equal(weekStartFromIndex(weekIndexOf(monday)), monday);
  }
});

test('Rhythmus 1: jede Woche fällig, Rotation wie bisher', () => {
  const monday = '2026-10-19';
  assert.equal(isDueWeek(monday, 1), true);
  const a = assigneeIndex(monday, 1, 0, 3);
  const b = assigneeIndex(weekStartFromIndex(weekIndexOf(monday) + 1), 1, 0, 3);
  assert.equal((a + 1) % 3, b); // nächste Woche rückt eine Person weiter
  // Zwei Aufgaben in derselben Woche: unterschiedliche Personen (Versatz um Index).
  assert.notEqual(assigneeIndex(monday, 1, 0, 3), assigneeIndex(monday, 1, 1, 3));
});

test('Rhythmus 2: nur jede zweite Woche fällig, rückt pro Runde weiter', () => {
  const idx = weekIndexOf('2026-10-19');
  const even = weekStartFromIndex(idx % 2 === 0 ? idx : idx + 1);
  const odd = weekStartFromIndex(weekIndexOf(even) + 1);
  assert.equal(isDueWeek(even, 2), true);
  assert.equal(isDueWeek(odd, 2), false);
  const next = weekStartFromIndex(weekIndexOf(even) + 2);
  assert.equal((assigneeIndex(even, 2, 0, 3) + 1) % 3, assigneeIndex(next, 2, 0, 3));
});

test('nextTurnWeek findet die nächste eigene fällige Woche', () => {
  const monday = '2026-10-19';
  const members = 3;
  for (let me = 0; me < members; me++) {
    const next = nextTurnWeek(monday, 2, 0, members, me);
    assert.ok(next > monday);
    assert.equal(isDueWeek(next, 2), true);
    assert.equal(assigneeIndex(next, 2, 0, members), me);
  }
});

test('weekAssignments: nur fällige Aufgaben, mit Person und Erledigt-Stand', () => {
  const idx = weekIndexOf('2026-10-19');
  const even = weekStartFromIndex(idx % 2 === 0 ? idx : idx + 1);
  const tasks = [
    { id: 't1', interval_weeks: 1 },
    { id: 't2', interval_weeks: 2 },
  ];
  const assignments = weekAssignments(tasks, ['a', 'b', 'c'], even, new Set([`t1|${even}|0`]));
  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].taskId, 't1');
  assert.equal(assignments[0].done, true);
  assert.equal(assignments[1].done, false);
  const oddWeek = weekStartFromIndex(weekIndexOf(even) + 1);
  assert.deepEqual(
    weekAssignments(tasks, ['a', 'b', 'c'], oddWeek, new Set()).map((a) => a.taskId),
    ['t1']
  );
});

test('weekAssignments: 2x die Woche ergibt zwei Durchgänge derselben Person', () => {
  const monday = '2026-10-19';
  const tasks = [{ id: 't1', interval_weeks: 1, times_per_week: 2 }];
  const assignments = weekAssignments(tasks, ['a', 'b', 'c'], monday, new Set([`t1|${monday}|1`]));
  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].assigneeId, assignments[1].assigneeId);
  assert.deepEqual(assignments.map((a) => a.slot), [0, 1]);
  assert.deepEqual(assignments.map((a) => a.done), [false, true]);
});
