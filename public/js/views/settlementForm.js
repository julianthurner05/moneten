// Begleichung erfassen. Die Lightbox schlägt vor, was an wen zu begleichen wäre.

import { api } from '../api.js';
import { createDatePicker, createSelect } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { centsToInput, parseEuroInput, todayIso } from '../format.js';

export function openSettlementForm(ctx, group, members, { suggestions = [], me, isEinzug = false, settlement = null } = {}) {
  const isEdit = !!settlement;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';

  // Vorbelegung: zuerst was ich selbst schulde, sonst was ich bekomme.
  const initial = settlement ?? suggestions.find((s) => s.fromUser === me) ?? suggestions[0] ?? null;

  openPanel((close) => {
    const memberOptions = members.map((member) => ({ value: member.id, label: member.displayName }));
    const fromUser = createSelect({ id: 'set-from', options: memberOptions, value: initial?.fromUser ?? me });
    const toUser = createSelect({
      id: 'set-to',
      options: memberOptions,
      value: initial?.toUser ?? members.find((m) => m.id !== (initial?.fromUser ?? me))?.id,
    });
    const amount = el('input', {
      id: 'set-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: initial ? centsToInput(initial.amountCents) : '',
    });
    const date = createDatePicker({ id: 'set-date', value: settlement?.settledOn ?? todayIso() });
    const error = el('p', { className: 'form-error', role: 'alert' });

    const applySuggestion = (s) => {
      fromUser.value = s.fromUser;
      toUser.value = s.toUser;
      amount.value = centsToInput(s.amountCents);
    };

    const suggestionBlock =
      isEdit || suggestions.length === 0
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
            const body = { fromUser: fromUser.value, toUser: toUser.value, amountCents, settledOn: date.value, isEinzug };
            if (isEdit) {
              await api(`/api/groups/${group.id}/settlements/${settlement.id}`, { method: 'PUT', body });
            } else {
              await api(`/api/groups/${group.id}/settlements`, { method: 'POST', body });
            }
            close();
            ctx.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, isEdit ? 'Begleichung bearbeiten' : 'Begleichung'),
      suggestionBlock,
      wrap('Von', fromUser.root, 'set-from'),
      wrap('An', toUser.root, 'set-to'),
      wrap('Betrag', amount, 'set-amount'),
      wrap('Datum', date.root, 'set-date'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        isEdit
          ? el(
              'button',
              {
                className: 'textlink textlink-danger',
                type: 'button',
                onClick: async () => {
                  const ok = await confirmPanel('Diese Begleichung wirklich löschen?', 'Löschen');
                  if (!ok) return;
                  try {
                    await api(`/api/groups/${group.id}/settlements/${settlement.id}`, { method: 'DELETE' });
                    close();
                    ctx.refresh();
                  } catch (err) {
                    error.textContent = err.message;
                    error.classList.add('is-visible');
                  }
                },
              },
              'Löschen'
            )
          : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, isEdit ? 'Speichern' : 'Eintragen')
      )
    );
  });
}
