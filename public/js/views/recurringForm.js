// Wiederkehrende Gruppenausgaben (z. B. Miete): Liste und Formular.
// Materialisiert werden sie serverseitig beim Laden der Gruppe.

import { api } from '../api.js';
import { createMonthPicker, createSelect } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { centsToInput, currentMonth, formatEuro, formatMonth, parseEuroInput } from '../format.js';

export async function openRecurringPanel(ctx, group, members) {
  const data = await api(`/api/groups/${group.id}/wiederkehrend`);
  const names = new Map(members.map((m) => [m.id, m.displayName]));

  openPanel((close) =>
    el(
      'div',
      {},
      el('h2', { className: 'panel-title' }, 'Wiederkehrende Ausgaben'),
      data.items.length === 0
        ? el('p', { className: 'empty-note' }, 'Noch keine wiederkehrenden Ausgaben – z. B. Miete oder Internet.')
        : el(
            'div',
            { className: 'row-list' },
            data.items.map((item) =>
              el(
                'button',
                {
                  className: 'row row-clickable',
                  type: 'button',
                  onClick: () => {
                    close();
                    openRecurringForm(ctx, group, members, item);
                  },
                },
                el(
                  'div',
                  { className: 'row-main' },
                  el(
                    'div',
                    { className: 'row-label' },
                    item.endMonth
                      ? `${formatMonth(item.startMonth)} – ${formatMonth(item.endMonth)} · ${names.get(item.paidBy) ?? '–'}`
                      : `Ab ${formatMonth(item.startMonth)} · ${names.get(item.paidBy) ?? '–'}`
                  ),
                  el('div', { className: 'row-title' }, item.name)
                ),
                el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(item.amountCents)))
              )
            )
          ),
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Schließen'),
        el('div', { className: 'toolbar-spacer' }),
        el(
          'button',
          {
            className: 'button',
            type: 'button',
            onClick: () => {
              close();
              openRecurringForm(ctx, group, members, null);
            },
          },
          '+ Neu'
        )
      )
    )
  );
}

function openRecurringForm(ctx, group, members, item) {
  openPanel((close) => {
    const isEdit = !!item;
    const name = el('input', { id: 'rec-exp-name', type: 'text', required: true, value: item?.name ?? '' });
    const amount = el('input', {
      id: 'rec-exp-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: item ? centsToInput(item.amountCents) : '',
    });
    const paidBy = createSelect({
      id: 'rec-exp-paidby',
      options: members.map((m) => ({ value: m.id, label: m.displayName })),
      value: item?.paidBy ?? ctx.state.user.id,
    });
    const start = createMonthPicker({ id: 'rec-exp-start', value: item?.startMonth ?? currentMonth() });
    const end = createMonthPicker({ id: 'rec-exp-end', value: item?.endMonth ?? '', allowEmpty: true, emptyLabel: 'Ohne Ende' });
    const error = el('p', { className: 'form-error', role: 'alert' });
    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const remove = async () => {
      const ok = await confirmPanel('Diesen Posten wirklich beenden und löschen? Schon angelegte Monate bleiben.', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/groups/${group.id}/wiederkehrend/${item.id}`, { method: 'DELETE' });
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
            showError('Bitte einen Betrag eingeben, z. B. 12,50.');
            return;
          }
          const body = {
            name: name.value,
            amountCents,
            paidBy: paidBy.value,
            startMonth: start.value,
            endMonth: end.value || null,
          };
          try {
            if (isEdit) {
              await api(`/api/groups/${group.id}/wiederkehrend/${item.id}`, { method: 'PUT', body });
            } else {
              await api(`/api/groups/${group.id}/wiederkehrend`, { method: 'POST', body });
            }
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el('h2', { className: 'panel-title' }, isEdit ? 'Wiederkehrende Ausgabe bearbeiten' : 'Neue wiederkehrende Ausgabe'),
      wrap('Name', name, 'rec-exp-name'),
      wrap('Betrag pro Monat', amount, 'rec-exp-amount'),
      wrap('Bezahlt von', paidBy.root, 'rec-exp-paidby'),
      wrap('Von', start.root, 'rec-exp-start'),
      wrap('Bis', end.root, 'rec-exp-end'),
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
