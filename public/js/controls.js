// Wiederverwendbare Bedienelemente.

import { el } from './dom.js';
import { formatMonth, monthAdd } from './format.js';

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
