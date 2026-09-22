// Ausgleichszahlung erfassen (auch aus einem Vorschlag heraus).

import { api } from '../api.js';
import { el, openPanel } from '../dom.js';
import { centsToInput, parseEuroInput, todayIso } from '../format.js';

export function openSettlementForm(ctx, group, members, prefill) {
  openPanel((close) => {
    const memberOptions = (selectedId) =>
      members.map((member) => el('option', { value: member.id, selected: member.id === selectedId }, member.displayName));

    const fromUser = el('select', { id: 'set-from' }, memberOptions(prefill?.fromUser ?? ctx.state.user.id));
    const toUser = el(
      'select',
      { id: 'set-to' },
      memberOptions(prefill?.toUser ?? members.find((m) => m.id !== (prefill?.fromUser ?? ctx.state.user.id))?.id)
    );
    const amount = el('input', {
      id: 'set-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: prefill ? centsToInput(prefill.amountCents) : '',
    });
    const date = el('input', { id: 'set-date', type: 'date', required: true, value: todayIso() });
    const error = el('p', { className: 'form-error', role: 'alert' });

    const wrap = (label, input, forId) =>
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: forId }, label), input);
    const selectWrap = (select) =>
      el('span', { className: 'select-wrap' }, select, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾'));

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          const amountCents = parseEuroInput(amount.value);
          if (amountCents === null || amountCents <= 0) {
            error.textContent = 'Bitte einen Betrag größer 0 eingeben, z. B. 12,50.';
            error.classList.add('is-visible');
            return;
          }
          try {
            await api(`/api/groups/${group.id}/settlements`, {
              method: 'POST',
              body: { fromUser: fromUser.value, toUser: toUser.value, amountCents, settledOn: date.value },
            });
            close();
            ctx.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Ausgleichszahlung'),
      wrap('Von', selectWrap(fromUser), 'set-from'),
      wrap('An', selectWrap(toUser), 'set-to'),
      wrap('Betrag', amount, 'set-amount'),
      wrap('Datum', date, 'set-date'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'textlink strong', type: 'submit' }, 'Eintragen')
      )
    );
  });
}
