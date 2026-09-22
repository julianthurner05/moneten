// Übersicht aller Monate: Ergebnis je Monat, Klick führt in die Detailsicht.

import { api } from '../api.js';
import { el } from '../dom.js';
import { formatEuro, formatMonth } from '../format.js';

export async function renderMonthOverview(ctx) {
  const data = await api('/api/months');
  ctx.show('monat', () => build(ctx, data));
}

function build(ctx, data) {
  const hero = el(
    'div',
    { className: 'hero hero-centered' },
    el('div', { className: 'month-title' }, 'Übersicht'),
    (data.categories ?? []).length > 0
      ? el(
          'div',
          { className: 'stat-grid' },
          data.categories.map((category) =>
            el(
              'div',
              { className: 'stat' },
              el('div', { className: 'stat-label' }, category.name),
              el('div', { className: 'stat-value' }, formatEuro(category.avgCents)),
              el('div', { className: 'stat-foot' }, 'Ø pro Monat')
            )
          )
        )
      : null,
    el('a', { className: 'textlink', href: '#/monat' }, 'Zurück zum aktuellen Monat')
  );

  const list =
    data.months.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine Monate.')
      : el(
          'div',
          { className: 'row-list', 'data-stagger': '' },
          data.months.map((m) =>
            el(
              'a',
              { className: 'row', href: `#/monat/${m.month}` },
              el(
                'div',
                { className: 'row-main' },
                el('div', { className: 'row-title' }, formatMonth(m.month)),
                el('div', { className: 'row-label' }, `Ausgaben ${formatEuro(m.ausgabenCents)}`)
              ),
              el(
                'div',
                { className: 'row-side' },
                el(
                  'div',
                  { className: `row-amount${m.uebrigCents > 0 ? ' is-positive' : m.uebrigCents < 0 ? ' is-negative' : ''}` },
                  formatEuro(m.uebrigCents)
                )
              )
            )
          )
        );

  return el('div', { className: 'view' }, hero, list);
}
