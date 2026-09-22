// Rechenlogik der persönlichen Monatsübersicht (Abschnitt 4 der Spezifikation).

export function isMonthString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** "2026-01" + 2 → "2026-03"; negative Deltas erlaubt. */
export function monthAdd(month, delta) {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const total = year * 12 + (m - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12 + 12) % 12 + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}`;
}

/** Anzahl Monate von `from` bis `to` einschließlich beider. */
export function monthCount(from, to) {
  const diff =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
  return diff + 1;
}

/** Ist ein wiederkehrender Posten (startMonth, endMonth optional) im Monat aktiv? */
export function isRecurringActive(item, month) {
  return item.startMonth <= month && (!item.endMonth || month <= item.endMonth);
}

/** Summe der aktiven wiederkehrenden Posten einer Art im Monat. */
export function recurringSum(items, kind, month) {
  return items
    .filter((item) => item.kind === kind && isRecurringActive(item, month))
    .reduce((sum, item) => sum + item.amountCents, 0);
}

const MAX_MONTHS = 1200;

/**
 * Kennzahlen eines Monats.
 * Übertrag(m) = Übrig(m−1), wenn carryover aktiv und m nach dem Startmonat liegt, sonst 0.
 * Budget(m) = Einnahmen(m) + Übertrag(m); Ausgaben(m) = Fixkosten(m) + Variable(m);
 * Übrig(m) = Budget(m) − Ausgaben(m).
 *
 * @param {string} month
 * @param {{startMonth: string|null, carryoverEnabled: boolean}} settings
 * @param {{income: (m: string) => number, fixed: (m: string) => number, variable: (m: string) => number}} lookup – alles in Cent
 */
export function computeOverview(month, settings, lookup) {
  const { startMonth, carryoverEnabled } = settings;
  let uebertrag = 0;
  if (startMonth && carryoverEnabled && month > startMonth) {
    let carry = 0;
    let m = startMonth;
    for (let i = 0; m < month && i < MAX_MONTHS; i++) {
      const budget = lookup.income(m) + carry;
      const ausgaben = lookup.fixed(m) + lookup.variable(m);
      carry = budget - ausgaben;
      m = monthAdd(m, 1);
    }
    uebertrag = carry;
  }
  const einnahmen = lookup.income(month);
  const fixkosten = lookup.fixed(month);
  const variabel = lookup.variable(month);
  const budget = einnahmen + uebertrag;
  const ausgaben = fixkosten + variabel;
  return {
    einnahmenCents: einnahmen,
    fixkostenCents: fixkosten,
    variabelCents: variabel,
    uebertragCents: uebertrag,
    budgetCents: budget,
    ausgabenCents: ausgaben,
    uebrigCents: budget - ausgaben,
  };
}
