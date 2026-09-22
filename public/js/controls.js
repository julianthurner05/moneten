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

/* ---------- Eigene Formular-Bedienelemente im App-Design ---------- */

function popupBehavior(root, button) {
  const close = () => {
    root.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onOutside = (event) => {
    if (!root.contains(event.target)) close();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };
  button.addEventListener('click', () => {
    const open = root.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    } else {
      close();
    }
  });
  return close;
}

/**
 * Dropdown im App-Design.
 * @param {{id: string, options: Array<{value: string, label: string}>, value?: string, onChange?: (value: string) => void}} opts
 * @returns {{root: HTMLElement, value: string}} – value ist les- und setzbar
 */
export function createSelect({ id, options, value, onChange }) {
  let current = value ?? options[0]?.value ?? '';
  const labelFor = (v) => options.find((o) => o.value === v)?.label ?? '';

  const labelSpan = el('span', { className: 'ui-select-label' }, labelFor(current));
  const button = el(
    'button',
    { className: 'ui-select-button', type: 'button', id, 'aria-haspopup': 'listbox', 'aria-expanded': 'false' },
    labelSpan,
    el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')
  );
  const menu = el(
    'div',
    { className: 'pop-menu', role: 'listbox' },
    options.map((option) =>
      el(
        'button',
        {
          className: `pop-menu-item${option.value === current ? ' is-active' : ''}`,
          type: 'button',
          role: 'option',
          dataset: { value: option.value },
          onClick: () => {
            api.value = option.value;
            close();
            onChange?.(option.value);
          },
        },
        option.label
      )
    )
  );
  const root = el('div', { className: 'ui-select' }, button, menu);
  const close = popupBehavior(root, button);

  const api = {
    root,
    get value() {
      return current;
    },
    set value(v) {
      current = v;
      labelSpan.textContent = labelFor(v);
      for (const item of menu.children) {
        item.classList.toggle('is-active', item.dataset.value === v);
      }
    },
  };
  return api;
}

const weekdayShort = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const displayDate = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Kalender-Datumswahl im App-Design. value als YYYY-MM-DD.
 * @returns {{root: HTMLElement, value: string}}
 */
export function createDatePicker({ id, value }) {
  let current = value;
  let viewMonth = value.slice(0, 7);

  const labelSpan = el('span', { className: 'ui-select-label' }, displayDate.format(new Date(current + 'T12:00:00')));
  const button = el(
    'button',
    { className: 'ui-select-button ui-date-button', type: 'button', id, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
    labelSpan,
    el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')
  );
  const menu = el('div', { className: 'pop-menu pop-calendar' });
  const root = el('div', { className: 'ui-select' }, button, menu);
  const close = popupBehavior(root, button);

  const renderCalendar = () => {
    const year = Number(viewMonth.slice(0, 4));
    const monthIndex = Number(viewMonth.slice(5, 7)) - 1;
    const first = new Date(year, monthIndex, 1);
    const offset = (first.getDay() + 6) % 7; // Woche beginnt Montag
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(el('span', { className: 'cal-cell' }));
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${viewMonth}-${String(day).padStart(2, '0')}`;
      cells.push(
        el(
          'button',
          {
            className: `cal-cell cal-day${iso === current ? ' is-active' : ''}`,
            type: 'button',
            onClick: () => {
              current = iso;
              labelSpan.textContent = displayDate.format(new Date(iso + 'T12:00:00'));
              close();
            },
          },
          String(day)
        )
      );
    }

    menu.replaceChildren(
      el(
        'div',
        { className: 'cal-head' },
        el('button', { className: 'month-arrow', type: 'button', 'aria-label': 'Voriger Monat', onClick: () => { viewMonth = monthAdd(viewMonth, -1); renderCalendar(); } }, '←'),
        el('span', { className: 'cal-title' }, formatMonth(viewMonth)),
        el('button', { className: 'month-arrow', type: 'button', 'aria-label': 'Nächster Monat', onClick: () => { viewMonth = monthAdd(viewMonth, 1); renderCalendar(); } }, '→')
      ),
      el('div', { className: 'cal-grid' }, weekdayShort.map((d) => el('span', { className: 'cal-cell cal-weekday' }, d)), cells)
    );
  };
  renderCalendar();
  button.addEventListener('click', () => {
    if (root.classList.contains('is-open')) {
      viewMonth = current.slice(0, 7);
      renderCalendar();
    }
  });

  return {
    root,
    get value() {
      return current;
    },
  };
}
