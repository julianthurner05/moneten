// Begleichung erfassen. Die Lightbox schlägt vor, was an wen zu begleichen wäre.

import { api } from '../api.js';
import { el, openPanel } from '../dom.js';
import { centsToInput, parseEuroInput, todayIso } from '../format.js';

export function openSettlementForm(ctx, group, members, { suggestions = [], me } = {}) {
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';

  // Vorbelegung: zuerst was ich selbst schulde, sonst was ich bekomme.
  const initial = suggestions.find((s) => s.fromUser === me) ?? suggestions[0] ?? null;

  openPanel((close) => {
    const memberOptions = (selectedId) =>
      members.map((member) => el('option', { value: member.id, selected: member.id === selectedId }, member.displayName));

    const fromUser = el('select', { id: 'set-from' }, memberOptions(initial?.fromUser ?? me));
    const toUser = el(
      'select',
      { id: 'set-to' },
      memberOptions(initial?.toUser ?? members.find((m) => m.id !== (initial?.fromUser ?? me))?.id)
    );
    const amount = el('input', {
      id: 'set-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: initial ? centsToInput(initial.amountCents) : '',
    });
    const date = el('input', { id: 'set-date', type: 'date', required: true, value: todayIso() });
    const error = el('p', { className: 'form-error', role: 'alert' });

    const applySuggestion = (s) => {
      fromUser.value = s.fromUser;
      toUser.value = s.toUser;
      amount.value = centsToInput(s.amountCents);
    };

    const suggestionBlock =
      suggestions.length === 0
        ? null
        : el(
            'div',
            { className: 'field' },
            el('span', { className: 'field-label' }, 'Vorschlag'),
            el(
              'div',
              { className: 'suggestion-list' },
              suggestions.map((s) =>
                el(
                  'button',
                  { className: 'suggestion-chip', type: 'button', onClick: () => applySuggestion(s) },
                  `${name(s.fromUser)} → ${name(s.toUser)} · ${centsToInput(s.amountCents)} €`
                )
              )
            )
          );

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
      el('h2', { className: 'panel-title' }, 'Begleichung'),
      suggestionBlock,
      wrap('Von', selectWrap(fromUser), 'set-from'),
      wrap('An', selectWrap(toUser), 'set-to'),
      wrap('Betrag', amount, 'set-amount'),
      wrap('Datum', date, 'set-date'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Eintragen')
      )
    );
  });
}
