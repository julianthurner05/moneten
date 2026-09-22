// Privat: Statistik groß oben, darunter die Kategorien als Listen mit Summe.

import { api } from '../api.js';
import { dateChip, monthSwitch } from '../controls.js';
import { el, openPanel } from '../dom.js';
import { buildFab } from '../fab.js';
import { currentMonth, formatDate, formatEuro } from '../format.js';
import { openEntryForm } from './entryForm.js';

export async function renderMonth(ctx, month) {
  const m = month ?? currentMonth();
  const data = await api(`/api/month/${m}`);
  ctx.show('monat', () => build(ctx, data));
}


function build(ctx, data) {
  const month = data.month;
  const mappedByCategory = new Map();
  for (const share of data.mappedShares ?? []) {
    if (!mappedByCategory.has(share.categoryId)) mappedByCategory.set(share.categoryId, []);
    mappedByCategory.get(share.categoryId).push(share);
  }
  const entriesByCategory = new Map();
  for (const entry of data.entries) {
    if (!entriesByCategory.has(entry.categoryId)) entriesByCategory.set(entry.categoryId, []);
    entriesByCategory.get(entry.categoryId).push(entry);
  }

  // Die fixen Kategorien sind immer sichtbar; alte/archivierte nur mit Inhalt.
  const counting = data.categories.filter((c) => !c.archived && c.countsTowardMonth);
  const nonCounting = data.categories.filter(
    (c) =>
      (c.archived || !c.countsTowardMonth) &&
      (c.monthSumCents !== 0 || entriesByCategory.has(c.id) || mappedByCategory.has(c.id))
  );

  // Statistik groß und mittig oben, darunter beim Scrollen die Listen.
  const hero = el(
    'div',
    { className: 'hero hero-centered' },
    monthSwitch(month, (m) => ctx.navigate(`#/monat/${m}`)),
    el(
      'div',
      { className: 'stat-grid' },
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
        el('div', { className: 'stat-value' }, formatEuro(data.ausgabenCents))
      ),
      el(
        'div',
        { className: 'stat' },
        el('div', { className: 'stat-label' }, 'Übrig'),
        el(
          'div',
          { className: `stat-value${data.uebrigCents > 0 ? ' is-positive' : data.uebrigCents < 0 ? ' is-negative' : ''}` },
          formatEuro(data.uebrigCents)
        )
      )
    )
  );

  // Eine Kategorie als Liste: oben Name und Gesamtsumme, darunter die Einträge.
  const categorySection = (category) => {
    const rows = [
      ...(entriesByCategory.get(category.id) ?? []).map((entry) => ({ date: entry.spentOn, entry })),
      ...(mappedByCategory.get(category.id) ?? []).map((share) => ({ date: share.spentOn, share })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    return el(
      'section',
      { className: 'category-section' },
      el(
        'div',
        { className: 'category-head' },
        el('div', { className: 'category-name' }, category.name),
        el('div', { className: 'category-sum' }, formatEuro(category.monthSumCents))
      ),
      rows.length === 0
        ? null
        : el(
            'div',
            { className: 'row-list', 'data-stagger': '' },
            rows.map(({ entry, share }) => {
              if (entry) {
                return el(
                  'button',
                  {
                    className: 'row row-clickable',
                    type: 'button',
                    onClick: () =>
                      openEntryForm(ctx, data.categories.filter((c) => !c.archived || c.id === entry.categoryId), entry, {
                        month,
                      }),
                  },
                  dateChip(entry.spentOn),
                  el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, entry.description)),
                  el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(entry.amountCents)))
                );
              }
              return el(
                'div',
                { className: 'row' },
                dateChip(share.spentOn),
                el(
                  'div',
                  { className: 'row-main' },
                  el('div', { className: 'row-title' }, share.description),
                  el('div', { className: 'row-label' }, `Aus ${share.groupName}`)
                ),
                el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(share.shareCents)))
              );
            })
          )
    );
  };

  const sections = [...counting.map(categorySection)];

  if (nonCounting.length > 0) sections.push(...nonCounting.map(categorySection));

  const sharesSections = data.groupShares.map((group) =>
    el(
      'section',
      { className: 'category-section' },
      el(
        'div',
        { className: 'category-head' },
        el('div', { className: 'category-name' }, group.groupName),
        el('div', { className: 'category-sum' }, formatEuro(group.sumCents))
      ),
      el(
        'div',
        { className: 'row-list', 'data-stagger': '' },
        group.items.map((item) =>
          el(
            'div',
            { className: 'row' },
            dateChip(item.spentOn),
            el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, item.description)),
            el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(item.shareCents)))
          )
        )
      )
    )
  );

  sections.push(...sharesSections);


  const listArea =
    sections.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine Einträge in diesem Monat.')
      : el('div', { className: 'category-grid' }, sections);

  const fab = buildFab([{ label: 'Eintrag', onClick: () => openNewEntry(ctx, data) }]);

  return el('div', { className: 'view' }, hero, listArea, fab);
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
    noticePanel('Lege zuerst in der Budgetplanung eine Kategorie an.');
    return;
  }
  openEntryForm(ctx, categories, null, { defaultCategoryId: categoryId, month: data.month });
}
