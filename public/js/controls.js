// Wiederverwendbare Bedienelemente.

import { el } from './dom.js';
import { formatMonth, monthAdd } from './format.js';

const monthShort = new Intl.DateTimeFormat('de-AT', { month: 'short' });

/** Quadratisches Datums-Tag: Tageszahl groß, Monat abgekürzt darüber. */
export function dateChip(isoDate) {
  const date = new Date(isoDate + 'T12:00:00');
  return el(
    'span',
    { className: 'date-chip' },
    el('span', { className: 'date-chip-month' }, monthShort.format(date)),
    el('span', { className: 'date-chip-day' }, String(date.getDate()))
  );
}

/**
 * Wer zahlt an wen: größten Gläubiger mit größtem Schuldner verrechnen.
 * (Client-Variante für monatsgebundene Salden.)
 * @param {Map<string, number>} balances – userId → Cent
 */
export function suggestFromBalances(balances) {
  const creditors = [];
  const debtors = [];
  for (const [userId, cents] of [...balances.entries()].sort()) {
    if (cents > 0) creditors.push({ userId, cents });
    else if (cents < 0) debtors.push({ userId, cents: -cents });
  }
  const suggestions = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.cents - a.cents);
    debtors.sort((a, b) => b.cents - a.cents);
    const amount = Math.min(creditors[0].cents, debtors[0].cents);
    suggestions.push({ fromUser: debtors[0].userId, toUser: creditors[0].userId, amountCents: amount });
    creditors[0].cents -= amount;
    debtors[0].cents -= amount;
    if (creditors[0].cents === 0) creditors.shift();
    if (debtors[0].cents === 0) debtors.shift();
  }
  return suggestions;
}

/** Monatsumschalter: Pfeile links und rechts vom Monat. */
export function monthSwitch(month, onChange, { big = false } = {}) {
  return el(
    'div',
    { className: `month-switch${big ? ' month-switch-big' : ''}` },
    el(
      'button',
      { className: 'month-arrow', type: 'button', 'aria-label': 'Voriger Monat', onClick: () => onChange(monthAdd(month, -1)) },
      '←'
    ),
    el('span', { className: big ? 'month-title' : 'month-switch-label' }, formatMonth(month)),
    el(
      'button',
      { className: 'month-arrow', type: 'button', 'aria-label': 'Nächster Monat', onClick: () => onChange(monthAdd(month, 1)) },
      '→'
    )
  );
}
