// Einstellungen der Monatsübersicht: Kategorien, wiederkehrende Posten, Optionen.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { centsToInput, currentMonth, formatEuro, formatMonth, parseEuroInput } from '../format.js';

export async function renderMonthSettings(ctx) {
  const data = await api(`/api/month/${currentMonth()}`);
  ctx.show('monat', () => build(ctx, data));
}

function build(ctx, data) {
  const head = el(
    'div',
    { className: 'section-head' },
    el(
      'div',
      {},
      el('div', { className: 'detail-meta' }, el('a', { className: 'textlink', href: '#/monat' }, '← Monat')),
      el('div', { className: 'month-title' }, 'Einstellungen')
    )
  );

  // --- Kategorien ---
  const categories = [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const moveCategory = async (index, delta) => {
    const other = index + delta;
    if (other < 0 || other >= categories.length) return;
    await api(`/api/personal/categories/${categories[index].id}`, {
      method: 'PUT',
      body: { sortOrder: categories[other].sortOrder },
    });
    await api(`/api/personal/categories/${categories[other].id}`, {
      method: 'PUT',
      body: { sortOrder: categories[index].sortOrder },
    });
    ctx.refresh();
  };

  const categoryRows =
    categories.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine Kategorien.')
      : el(
          'div',
          { className: 'row-list', 'data-stagger': '' },
          categories.map((category, index) =>
            el(
              'div',
              { className: 'row' },
              el(
                'div',
                { className: 'row-main' },
                el(
                  'div',
                  { className: 'row-label' },
                  [category.countsTowardMonth ? 'Zählt ins Budget' : 'Zählt nicht', category.archived ? 'Archiviert' : null]
                    .filter(Boolean)
                    .join(' · ')
                ),
                el('div', { className: 'row-title' }, category.name)
              ),
              el(
                'div',
                { className: 'row-side' },
                el('button', { className: 'textlink', type: 'button', 'aria-label': `${category.name} nach oben`, onClick: () => moveCategory(index, -1) }, '↑'),
                el('button', { className: 'textlink', type: 'button', 'aria-label': `${category.name} nach unten`, onClick: () => moveCategory(index, 1) }, '↓'),
                el('button', { className: 'textlink', type: 'button', onClick: () => openCategoryForm(ctx, category) }, 'Bearbeiten')
              )
            )
          )
        );

  // --- Wiederkehrende Posten ---
  const recurringBlock = (kind, title, addLabel) => {
    const items = data.recurring.filter((item) => item.kind === kind);
    return [
      el(
        'div',
        { className: 'settings-block-head' },
        el('div', { className: 'section-label' }, title),
        el('button', { className: 'textlink', type: 'button', onClick: () => openRecurringForm(ctx, kind, null) }, addLabel)
      ),
      items.length === 0
        ? el('p', { className: 'empty-note' }, 'Noch nichts angelegt.')
        : el(
            'div',
            { className: 'row-list', 'data-stagger': '' },
            items.map((item) =>
              el(
                'button',
                {
                  className: 'row row-clickable',
                  type: 'button',
                  onClick: () => openRecurringForm(ctx, kind, item),
                },
                el(
                  'div',
                  { className: 'row-main' },
                  el(
                    'div',
                    { className: 'row-label' },
                    item.endMonth ? `${formatMonth(item.startMonth)} – ${formatMonth(item.endMonth)}` : `Ab ${formatMonth(item.startMonth)}`
                  ),
                  el('div', { className: 'row-title' }, item.name)
                ),
                el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(item.amountCents)))
              )
            )
          ),
    ];
  };

  // --- Optionen ---
  const startMonth = el('input', {
    id: 'settings-start',
    type: 'month',
    value: data.settings.budgetStartMonth ?? '',
  });
  const carryover = el('input', {
    id: 'settings-carryover',
    type: 'checkbox',
    checked: data.settings.carryoverEnabled,
  });
  const optionsError = el('p', { className: 'form-error', role: 'alert' });

  const options = el(
    'form',
    {
      className: 'settings-options',
      onSubmit: async (event) => {
        event.preventDefault();
        try {
          await api('/api/personal/settings', {
            method: 'PUT',
            body: { budgetStartMonth: startMonth.value || null, carryoverEnabled: carryover.checked },
          });
          ctx.refresh();
        } catch (err) {
          optionsError.textContent = err.message;
          optionsError.classList.add('is-visible');
        }
      },
    },
    el(
      'div',
      { className: 'field' },
      el('label', { className: 'field-label', for: 'settings-start' }, 'Startmonat des Budgets'),
      startMonth
    ),
    el('div', { className: 'check-row' }, carryover, el('label', { for: 'settings-carryover' }, 'Übrig des Vormonats übertragen')),
    optionsError,
    el('div', { className: 'panel-actions' }, el('button', { className: 'button', type: 'submit' }, 'Speichern'))
  );

  return el(
    'div',
    { className: 'view' },
    head,
    el(
      'div',
      { className: 'settings-block-head' },
      el('div', { className: 'section-label' }, 'Kategorien'),
      el('button', { className: 'textlink', type: 'button', onClick: () => openCategoryForm(ctx, null) }, '+ Kategorie')
    ),
    categoryRows,
    recurringBlock('income', 'Wiederkehrende Einnahmen', '+ Einnahme'),
    recurringBlock('fixed', 'Fixkosten', '+ Fixkosten'),
    el('div', { className: 'section-label' }, 'Optionen'),
    options
  );
}

function openCategoryForm(ctx, category) {
  openPanel((close) => {
    const isEdit = !!category;
    const name = el('input', { id: 'cat-name', type: 'text', required: true, value: category?.name ?? '' });
    const counts = el('input', {
      id: 'cat-counts',
      type: 'checkbox',
      checked: category ? category.countsTowardMonth : true,
    });
    const archived = el('input', { id: 'cat-archived', type: 'checkbox', checked: category?.archived ?? false });
    const error = el('p', { className: 'form-error', role: 'alert' });

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            if (isEdit) {
              await api(`/api/personal/categories/${category.id}`, {
                method: 'PUT',
                body: { name: name.value, countsTowardMonth: counts.checked, archived: archived.checked },
              });
            } else {
              await api('/api/personal/categories', {
                method: 'POST',
                body: { name: name.value, countsTowardMonth: counts.checked },
              });
            }
            close();
            ctx.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, isEdit ? 'Kategorie bearbeiten' : 'Neue Kategorie'),
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: 'cat-name' }, 'Name'), name),
      el('div', { className: 'check-row' }, counts, el('label', { for: 'cat-counts' }, 'Zählt ins Monatsbudget')),
      isEdit ? el('div', { className: 'check-row' }, archived, el('label', { for: 'cat-archived' }, 'Archiviert')) : null,
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}

function openRecurringForm(ctx, kind, item) {
  openPanel((close) => {
    const isEdit = !!item;
    const name = el('input', { id: 'rec-name', type: 'text', required: true, value: item?.name ?? '' });
    const amount = el('input', {
      id: 'rec-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: item ? centsToInput(item.amountCents) : '',
    });
    const start = el('input', { id: 'rec-start', type: 'month', required: true, value: item?.startMonth ?? currentMonth() });
    const end = el('input', { id: 'rec-end', type: 'month', value: item?.endMonth ?? '' });
    const error = el('p', { className: 'form-error', role: 'alert' });

    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const remove = async () => {
      const ok = await confirmPanel('Diesen Posten wirklich löschen?', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/personal/recurring/${item.id}`, { method: 'DELETE' });
        close();
        ctx.refresh();
      } catch (err) {
        showError(err.message);
      }
    };

    const wrap = (label, input, forId) =>
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: forId }, label), input);

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          const amountCents = parseEuroInput(amount.value);
          if (amountCents === null || amountCents <= 0) {
            showError('Bitte einen Betrag größer 0 eingeben.');
            return;
          }
          const body = {
            kind,
            name: name.value,
            amountCents,
            startMonth: start.value,
            endMonth: end.value || null,
          };
          try {
            if (isEdit) {
              await api(`/api/personal/recurring/${item.id}`, { method: 'PUT', body });
            } else {
              await api('/api/personal/recurring', { method: 'POST', body });
            }
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el(
        'h2',
        { className: 'panel-title' },
        kind === 'income'
          ? isEdit
            ? 'Einnahme bearbeiten'
            : 'Neue Einnahme'
          : isEdit
            ? 'Fixkosten bearbeiten'
            : 'Neue Fixkosten'
      ),
      wrap('Name', name, 'rec-name'),
      wrap('Betrag pro Monat', amount, 'rec-amount'),
      wrap('Von', start, 'rec-start'),
      wrap('Bis (optional)', end, 'rec-end'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        isEdit ? el('button', { className: 'textlink', type: 'button', onClick: remove }, 'Löschen') : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
