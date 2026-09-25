// Einstellungen der Monatsübersicht: Kategorien, wiederkehrende Posten, Optionen.

import { api } from '../api.js';
import { createMonthPicker } from '../controls.js';
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
      el('div', { className: 'month-title' }, 'Budgetplanung')
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
  const carryover = el('input', {
    id: 'settings-carryover',
    type: 'checkbox',
    checked: data.settings.carryoverEnabled,
  });
  const optionsError = el('p', { className: 'form-error', role: 'alert' });

  // Der Schalter speichert sich selbst – ohne eigenen Speichern-Button.
  carryover.addEventListener('change', async () => {
    try {
      await api('/api/personal/settings', {
        method: 'PUT',
        body: { budgetStartMonth: data.settings.budgetStartMonth ?? null, carryoverEnabled: carryover.checked },
      });
    } catch (err) {
      carryover.checked = !carryover.checked;
      optionsError.textContent = err.message;
      optionsError.classList.add('is-visible');
    }
  });
  const options = el(
    'div',
    { className: 'settings-options' },
    el('div', { className: 'check-row' }, carryover, el('label', { for: 'settings-carryover' }, 'Übrig des Vormonats übertragen')),
    optionsError
  );

  const logout = el(
    'div',
    { className: 'konto-link' },
    el('a', { className: 'textlink', href: '#/konto/passwort' }, 'Passwort ändern'),
    el(
      'button',
      {
        className: 'textlink',
        type: 'button',
        onClick: async () => {
          await api('/api/logout', { method: 'POST' });
          ctx.onLogout();
        },
      },
      'Abmelden'
    )
  );

  return el(
    'div',
    { className: 'view' },
    head,
    recurringBlock('income', 'Wiederkehrende Einnahmen', '+ Einnahme'),
    recurringBlock('fixed', 'Fixkosten', '+ Fixkosten'),
    el('div', { className: 'section-label' }, 'Optionen'),
    options,
    logout
  );
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
    const start = createMonthPicker({ id: 'rec-start', value: item?.startMonth ?? currentMonth() });
    const end = createMonthPicker({ id: 'rec-end', value: item?.endMonth ?? '', allowEmpty: true, emptyLabel: 'Ohne Ende' });
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
      wrap('Von', start.root, 'rec-start'),
      wrap('Bis (optional)', end.root, 'rec-end'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        isEdit ? el('button', { className: 'textlink textlink-danger', type: 'button', onClick: remove }, 'Löschen') : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
