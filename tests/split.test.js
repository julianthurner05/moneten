// Tests für Aufteilung, Salden und Ausgleichsvorschläge.
// Ausführen mit: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBalances, splitByShares, splitEqual, suggestSettlements } from '../shared/split.js';

test('splitEqual verteilt Rest-Cent deterministisch nach user_id', () => {
  const result = splitEqual(100, ['c', 'a', 'b']);
  assert.deepEqual(result, [
    { userId: 'a', shareCents: 34 },
    { userId: 'b', shareCents: 33 },
    { userId: 'c', shareCents: 33 },
  ]);
});

test('splitEqual: Summe ergibt immer den Gesamtbetrag', () => {
  for (const amount of [1, 99, 100, 101, 12345, 99999]) {
    for (const count of [1, 2, 3, 4, 7]) {
      const ids = Array.from({ length: count }, (_, i) => `user${i}`);
      const sum = splitEqual(amount, ids).reduce((s, r) => s + r.shareCents, 0);
      assert.equal(sum, amount, `${amount} auf ${count} Personen`);
    }
  }
});

test('splitByShares teilt 2:1:1 korrekt auf', () => {
  const result = splitByShares(1000, [
    { userId: 'a', units: 2 },
    { userId: 'b', units: 1 },
    { userId: 'c', units: 1 },
  ]);
  assert.deepEqual(result, [
    { userId: 'a', shareCents: 500 },
    { userId: 'b', shareCents: 250 },
    { userId: 'c', shareCents: 250 },
  ]);
});

test('splitByShares: Rest-Cent deterministisch, Summe stimmt', () => {
  const result = splitByShares(100, [
    { userId: 'b', units: 1 },
    { userId: 'a', units: 1 },
    { userId: 'c', units: 1 },
  ]);
  assert.equal(result.reduce((s, r) => s + r.shareCents, 0), 100);
  assert.deepEqual(result.map((r) => r.userId), ['a', 'b', 'c']);
  assert.deepEqual(result.map((r) => r.shareCents), [34, 33, 33]);
});

test('computeBalances: Vorstrecken zählt positiv, Anteile negativ', () => {
  // A streckt 120 € vor, hat selbst 30 € Anteil – die anderen schulden A 90 €.
  const balances = computeBalances(
    ['a', 'b', 'c', 'd'],
    [
      {
        paidBy: 'a',
        amountCents: 12000,
        shares: [
          { userId: 'a', shareCents: 3000 },
          { userId: 'b', shareCents: 3000 },
          { userId: 'c', shareCents: 3000 },
          { userId: 'd', shareCents: 3000 },
        ],
      },
    ],
    []
  );
  assert.equal(balances.get('a'), 9000);
  assert.equal(balances.get('b'), -3000);
  assert.equal(balances.get('c'), -3000);
  assert.equal(balances.get('d'), -3000);
});

test('computeBalances: Ausgleichszahlung gleicht Salden aus', () => {
  const balances = computeBalances(
    ['a', 'b'],
    [
      {
        paidBy: 'a',
        amountCents: 5000,
        shares: [
          { userId: 'a', shareCents: 2500 },
          { userId: 'b', shareCents: 2500 },
        ],
      },
    ],
    [{ fromUser: 'b', toUser: 'a', amountCents: 2500 }]
  );
  assert.equal(balances.get('a'), 0);
  assert.equal(balances.get('b'), 0);
});

test('suggestSettlements: gleicht alle Salden mit wenigen Zahlungen aus', () => {
  const balances = new Map([
    ['a', 9000],
    ['b', -3000],
    ['c', -3000],
    ['d', -3000],
  ]);
  const suggestions = suggestSettlements(balances);
  assert.equal(suggestions.length, 3);
  for (const s of suggestions) {
    assert.equal(s.toUser, 'a');
    assert.equal(s.amountCents, 3000);
  }
});

test('suggestSettlements: verrechnet größten Gläubiger mit größtem Schuldner', () => {
  const balances = new Map([
    ['a', 7000],
    ['b', 3000],
    ['c', -10000],
  ]);
  const suggestions = suggestSettlements(balances);
  assert.deepEqual(suggestions, [
    { fromUser: 'c', toUser: 'a', amountCents: 7000 },
    { fromUser: 'c', toUser: 'b', amountCents: 3000 },
  ]);
});

test('suggestSettlements: nach Anwendung der Vorschläge sind alle Salden 0', () => {
  const balances = new Map([
    ['a', 1234],
    ['b', -567],
    ['c', -667],
    ['d', 0],
  ]);
  const suggestions = suggestSettlements(balances);
  const after = new Map(balances);
  for (const s of suggestions) {
    after.set(s.fromUser, after.get(s.fromUser) + s.amountCents);
    after.set(s.toUser, after.get(s.toUser) - s.amountCents);
  }
  for (const cents of after.values()) {
    assert.equal(cents, 0);
  }
});
