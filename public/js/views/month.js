// Persönliche Monatsübersicht: Kennzahlen, Kategorien, Anteile aus Gruppen.

import { api } from '../api.js';
import { monthSwitch } from '../controls.js';
import { el, openPanel } from '../dom.js';
import { buildFab } from '../fab.js';
import { currentMonth, formatDate, formatEuro, formatMonth } from '../format.js';
import { openEntryForm } from './entryForm.js';

export async function renderMonth(ctx, month) {
  const m = month ?? currentMonth();
  const data = await api(`/api/month/${m}`);
  ctx.show('monat', () => build(ctx, data));
}

/** Dünner Anzeigebalken, ratio 0–1. */
function meter(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return el(
    'div',
    { className: 'meter' },
    el('div', { className: 'meter-fill', style: `width: ${(clamped * 100).toFixed(1)}%` })
  );
}

function build(ctx, data) {
  const month = data.month;
  const visibleCategories = data.categories.filter((c) => !c.archived || c.monthSumCents !== 0);
  const counting = visibleCategories.filter((c) => c.countsTowardMonth);
  const nonCounting = visibleCategories.filter((c) => !c.countsTowardMonth);

  const head = el(
    'div',
    { className: 'section-head' },
    monthSwitch(month, (m) => ctx.navigate(`#/monat/${m}`), { big: true }),
    el(
      'div',
      { className: 'toolbar' },
      el('div', { className: 'toolbar-spacer' }),
      el('a', { className: 'textlink', href: '#/monat/einstellungen' }, 'Einstellungen')
    )
  );

  const spentRatio = data.budgetCents > 0 ? data.ausgabenCents / data.budgetCents : 0;
  const stats = el(
    'div',
    { className: 'stat-grid', 'data-stagger': '' },
    el(
      'div',
      { className: 'stat' },
      el('div', { className: 'stat-label' }, 'Budget'),
      el('div', { className: 'stat-value' }, formatEuro(data.budgetCents)),
      data.uebertragCents !== 0
        ? el('div', { className: 'stat-foot' }, `davon ${formatEuro(data.uebertragCents)} Übertrag`)
        : null
    ),
    el(
      'div',
      { className: 'stat' },
      el('div', { className: 'stat-label' }, 'Ausgaben'),
      el('div', { className: 'stat-value' }, formatEuro(data.ausgabenCents)),
      data.budgetCents > 0 ? meter(spentRatio) : null,
      data.budgetCents > 0
        ? el('div', { className: 'stat-foot' }, `${Math.round(spentRatio * 100)} % des Budgets`)
        : null
    ),
    el(
      'div',
      { className: 'stat' },
      el('div', { className: 'stat-label' }, 'Übrig'),
      el('div', { className: 'stat-value' }, formatEuro(data.uebrigCents))
    )
  );

  const categoryCard = (category) =>
    el(
      'button',
      {
        className: 'card',
        type: 'button',
        onClick: () => openCategoryPanel(ctx, data, category),
      },
      el(
        'div',
        { className: 'card-meta' },
        el('span', {}, category.name),
        category.archived ? el('span', {}, 'Archiviert') : null
      ),
      el('div', { className: 'card-amount' }, formatEuro(category.monthSumCents)),
      category.countsTowardMonth && data.variabelCents > 0 && category.monthSumCents > 0
        ? meter(category.monthSumCents / data.variabelCents)
        : null,
      el('div', { className: 'card-foot' }, `Ø ${formatEuro(category.avgCents)} pro Monat`)
    );

  const categoryGrid =
    counting.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine Kategorien – lege sie in den Einstellungen an.')
      : el('div', { className: 'card-grid', 'data-stagger': '' }, counting.map(categoryCard));

  const nonCountingBlock =
    nonCounting.length === 0
      ? null
      : [
          el('div', { className: 'section-label' }, 'Zählt nicht ins Monatsbudget'),
          el('div', { className: 'card-grid', 'data-stagger': '' }, nonCounting.map(categoryCard)),
        ];

  let sharesBlock = null;
  if (data.groupShares.length > 0) {
    sharesBlock = [
      el('div', { className: 'section-label' }, 'Deine Anteile aus Gruppen'),
      data.groupShares.map((group) =>
        el(
          'div',
          { className: 'row-list group-share-list', 'data-stagger': '' },
          el(
            'a',
            { className: 'row', href: `#/gruppen/${group.groupId}` },
            el(
              'div',
              { className: 'row-main' },
              el('div', { className: 'row-label' }, 'Gruppe'),
              el('div', { className: 'row-title' }, group.groupName)
            ),
            el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(group.sumCents)))
          ),
          group.items.map((item) =>
            el(
              'div',
              { className: 'row' },
              el(
                'div',
                { className: 'row-main' },
                el('div', { className: 'row-label' }, formatDate(item.spentOn)),
                el('div', { className: 'row-subtitle' }, item.description)
              ),
              el('div', { className: 'row-side' }, el('div', { className: 'row-amount row-amount-small' }, formatEuro(item.shareCents)))
            )
          )
        )
      ),
    ];
  }

  const fab = buildFab([{ label: 'Eintrag', onClick: () => openNewEntry(ctx, data) }]);

  return el(
    'div',
    { className: 'view' },
    head,
    stats,
    el('div', { className: 'section-label' }, 'Kategorien'),
    categoryGrid,
    nonCountingBlock,
    sharesBlock,
    fab
  );
}

function noticePanel(message) {
  openPanel((close) =>
    el(
      'div',
      {},
      el('p', { className: 'panel-message' }, message),
      el('div', { className: 'panel-actions' }, el('button', { className: 'button', type: 'button', onClick: () => close() }, 'OK'))
    )
  );
}

function openNewEntry(ctx, data, categoryId) {
  const categories = data.categories.filter((c) => !c.archived);
  if (categories.length === 0) {
    noticePanel('Lege zuerst in den Einstellungen eine Kategorie an.');
    return;
  }
  openEntryForm(ctx, categories, null, { defaultCategoryId: categoryId, month: data.month });
}

function openCategoryPanel(ctx, data, category) {
  const entries = data.entries.filter((entry) => entry.categoryId === category.id);
  const mapped = (data.mappedShares ?? []).filter((share) => share.categoryId === category.id);
  openPanel((close) => {
    const rows = [
      ...entries.map((entry) => ({ date: entry.spentOn, entry })),
      ...mapped.map((share) => ({ date: share.spentOn, share })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    const list =
      rows.length === 0
        ? el('p', { className: 'empty-note' }, 'Keine Einträge in diesem Monat.')
        : el(
            'div',
            { className: 'row-list' },
            rows.map(({ entry, share }) => {
              if (entry) {
                return el(
                  'button',
                  {
                    className: 'row row-clickable',
                    type: 'button',
                    onClick: () => {
                      close();
                      openEntryForm(ctx, data.categories.filter((c) => !c.archived || c.id === entry.categoryId), entry, {
                        month: data.month,
                      });
                    },
                  },
                  el(
                    'div',
                    { className: 'row-main' },
                    el('div', { className: 'row-label' }, formatDate(entry.spentOn)),
                    el('div', { className: 'row-title' }, entry.description)
                  ),
                  el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(entry.amountCents)))
                );
              }
              // Zugeordneter Gruppen-Anteil: bearbeiten geht in der Gruppe.
              return el(
                'a',
                { className: 'row', href: `#/gruppen/${share.groupId}`, onClick: () => close() },
                el(
                  'div',
                  { className: 'row-main' },
                  el('div', { className: 'row-label' }, `${formatDate(share.spentOn)} · Aus ${share.groupName}`),
                  el('div', { className: 'row-title' }, share.description)
                ),
                el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(share.shareCents)))
              );
            })
          );

    return el(
      'div',
      {},
      el('h2', { className: 'panel-title' }, `${category.name} · ${formatMonth(data.month)}`),
      list,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Schließen'),
        el(
          'button',
          {
            className: 'button',
            type: 'button',
            onClick: () => {
              close();
              openNewEntry(ctx, data, category.id);
            },
          },
          '+ Eintrag'
        )
      )
    );
  });
}
