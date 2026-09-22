// Persönliche Monatsübersicht: Kennzahlen, Kategorien, Anteile aus Gruppen.

import { api } from '../api.js';
import { el, openPanel } from '../dom.js';
import { currentMonth, formatDate, formatEuro, formatMonth, monthAdd } from '../format.js';
import { openEntryForm } from './entryForm.js';

export async function renderMonth(ctx, month) {
  const m = month ?? currentMonth();
  const data = await api(`/api/month/${m}`);
  ctx.show('monat', () => build(ctx, data));
}

function build(ctx, data) {
  const month = data.month;
  const visibleCategories = data.categories.filter((c) => !c.archived || c.monthSumCents !== 0);
  const counting = visibleCategories.filter((c) => c.countsTowardMonth);
  const nonCounting = visibleCategories.filter((c) => !c.countsTowardMonth);

  const monthLink = (label, target, isActive = false) =>
    el(
      'a',
      { className: `textlink${isActive ? ' is-active' : ''}`, href: `#/monat/${target}` },
      label
    );

  const toolbar = el(
    'div',
    { className: 'toolbar' },
    el(
      'div',
      { className: 'toolbar-group' },
      monthLink('←', monthAdd(month, -1)),
      monthLink('Heute', currentMonth(), month === currentMonth()),
      monthLink('→', monthAdd(month, 1))
    ),
    el('div', { className: 'toolbar-spacer' }),
    el('a', { className: 'textlink', href: '#/monat/einstellungen' }, 'Einstellungen'),
    el(
      'button',
      {
        className: 'button',
        type: 'button',
        onClick: () => openNewEntry(ctx, data),
      },
      '+ Eintrag'
    )
  );

  const head = el(
    'div',
    { className: 'section-head' },
    el('div', { className: 'month-title' }, formatMonth(month)),
    toolbar
  );

  const stats = el(
    'div',
    { className: 'stat-grid', 'data-stagger': '' },
    [
      ['Budget', data.budgetCents],
      ['Ausgaben', data.ausgabenCents],
      ['Übrig', data.uebrigCents],
    ].map(([label, cents]) =>
      el(
        'div',
        { className: 'stat' },
        el('div', { className: 'stat-label' }, label),
        el('div', { className: 'stat-value' }, formatEuro(cents))
      )
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

  return el('div', { className: 'view' }, head, stats, el('div', { className: 'section-label' }, 'Kategorien'), categoryGrid, nonCountingBlock, sharesBlock);
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
  openPanel((close) => {
    const list =
      entries.length === 0
        ? el('p', { className: 'empty-note' }, 'Keine Einträge in diesem Monat.')
        : el(
            'div',
            { className: 'row-list' },
            entries.map((entry) =>
              el(
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
              )
            )
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
