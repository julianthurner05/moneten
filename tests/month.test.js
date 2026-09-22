// Tests für die Monatsrechnung, inklusive der Excel-Testwerte aus der Spezifikation.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOverview,
  isRecurringActive,
  monthAdd,
  monthCount,
  recurringSum,
} from '../shared/month.js';

test('monthAdd über Jahresgrenzen', () => {
  assert.equal(monthAdd('2026-01', 1), '2026-02');
  assert.equal(monthAdd('2026-12', 1), '2027-01');
  assert.equal(monthAdd('2026-01', -1), '2025-12');
  assert.equal(monthAdd('2026-06', 12), '2027-06');
});

test('monthCount einschließlich beider Monate', () => {
  assert.equal(monthCount('2026-01', '2026-01'), 1);
  assert.equal(monthCount('2026-01', '2026-12'), 12);
  assert.equal(monthCount('2025-11', '2026-02'), 4);
});

test('isRecurringActive respektiert Start- und Endmonat', () => {
  const item = { startMonth: '2026-02', endMonth: '2026-04' };
  assert.equal(isRecurringActive(item, '2026-01'), false);
  assert.equal(isRecurringActive(item, '2026-02'), true);
  assert.equal(isRecurringActive(item, '2026-04'), true);
  assert.equal(isRecurringActive(item, '2026-05'), false);
  assert.equal(isRecurringActive({ startMonth: '2026-02', endMonth: null }, '2030-01'), true);
});

test('recurringSum summiert nur die passende Art', () => {
  const items = [
    { kind: 'income', amountCents: 175400, startMonth: '2026-01', endMonth: null },
    { kind: 'fixed', amountCents: 72400, startMonth: '2026-01', endMonth: null },
    { kind: 'income', amountCents: 10000, startMonth: '2026-03', endMonth: null },
  ];
  assert.equal(recurringSum(items, 'income', '2026-01'), 175400);
  assert.equal(recurringSum(items, 'income', '2026-03'), 185400);
  assert.equal(recurringSum(items, 'fixed', '2026-01'), 72400);
});

// Excel-Testwerte: Einnahmen 1.754,00 €, Fixkosten 724,00 €, variable Ausgaben
// im Startmonat 954,65 € → Ausgaben 1.678,65 €, Übrig 75,35 €,
// Budget im Folgemonat 1.829,35 €.
const excelLookup = {
  income: () => 175400,
  fixed: () => 72400,
  variable: (m) => (m === '2026-01' ? 95465 : 0),
};
const excelSettings = { startMonth: '2026-01', carryoverEnabled: true };

test('Excel-Werte: Startmonat', () => {
  const o = computeOverview('2026-01', excelSettings, excelLookup);
  assert.equal(o.uebertragCents, 0);
  assert.equal(o.budgetCents, 175400);
  assert.equal(o.ausgabenCents, 167865);
  assert.equal(o.uebrigCents, 7535);
});

test('Excel-Werte: Budget des Folgemonats = Einnahmen + Übrig des Vormonats', () => {
  const o = computeOverview('2026-02', excelSettings, excelLookup);
  assert.equal(o.uebertragCents, 7535);
  assert.equal(o.budgetCents, 182935);
});

test('Übertrag läuft über mehrere Monate weiter', () => {
  const o = computeOverview('2026-03', excelSettings, excelLookup);
  // Februar: Budget 1.829,35 − 724,00 = Übrig 1.105,35 → Übertrag im März.
  assert.equal(o.uebertragCents, 110535);
});

test('Ohne Übertrag ist das Budget nur die Einnahmen', () => {
  const o = computeOverview('2026-02', { startMonth: '2026-01', carryoverEnabled: false }, excelLookup);
  assert.equal(o.uebertragCents, 0);
  assert.equal(o.budgetCents, 175400);
});

test('Vor dem Startmonat gibt es keinen Übertrag', () => {
  const o = computeOverview('2025-12', excelSettings, excelLookup);
  assert.equal(o.uebertragCents, 0);
});

test('Negative Einträge (Rückerstattungen) erhöhen das Übrig', () => {
  const o = computeOverview(
    '2026-01',
    excelSettings,
    { income: () => 100000, fixed: () => 0, variable: () => -5000 }
  );
  assert.equal(o.ausgabenCents, -5000);
  assert.equal(o.uebrigCents, 105000);
});
