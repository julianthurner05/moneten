// Ausgabe erfassen und bearbeiten, inklusive Aufteilung und Soft Delete.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { centsToInput, parseEuroInput, todayIso } from '../format.js';

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/** Aus gespeicherten Cent-Anteilen wieder handliche Anteile machen (z. B. 200:100 → 2:1). */
function unitsFromShares(shares) {
  const divisor = shares.reduce((d, s) => gcd(d, s.shareCents), 0) || 1;
  return new Map(shares.map((s) => [s.userId, s.shareCents / divisor]));
}

export function openExpenseForm(ctx, group, members, expense) {
  openPanel((close) => {
    const isEdit = !!expense;
    const shareMap = new Map((expense?.shares ?? []).map((s) => [s.userId, s.shareCents]));
    const unitMap = expense?.splitMode === 'shares' ? unitsFromShares(expense.shares) : new Map();

    const description = el('input', { id: 'exp-desc', type: 'text', required: true, value: expense?.description ?? '' });
    const amount = el('input', {
      id: 'exp-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: expense ? centsToInput(expense.amountCents) : '',
    });
    const date = el('input', { id: 'exp-date', type: 'date', required: true, value: expense?.spentOn ?? todayIso() });
    const paidBy = el(
      'select',
      { id: 'exp-paidby' },
      members.map((member) =>
        el(
          'option',
          { value: member.id, selected: member.id === (expense?.paidBy ?? ctx.state.user.id) },
          member.displayName
        )
      )
    );
    const splitMode = el(
      'select',
      { id: 'exp-split' },
      el('option', { value: 'equal', selected: (expense?.splitMode ?? 'equal') === 'equal' }, 'Gleich aufteilen'),
      el('option', { value: 'exact', selected: expense?.splitMode === 'exact' }, 'Exakte Beträge'),
      el('option', { value: 'shares', selected: expense?.splitMode === 'shares' }, 'Nach Anteilen')
    );
    const error = el('p', { className: 'form-error', role: 'alert' });

    // Pro Mitglied: Checkbox plus Detail-Eingabe für exakte Beträge bzw. Anteile.
    const participantRows = members.map((member) => {
      const participating = isEdit ? shareMap.has(member.id) : true;
      const checkbox = el('input', {
        type: 'checkbox',
        id: `exp-part-${member.id}`,
        checked: participating,
        dataset: { userId: member.id },
      });
      const detail = el('input', {
        type: 'text',
        inputmode: 'decimal',
        className: 'check-detail',
        'aria-label': `Wert für ${member.displayName}`,
      });
      checkbox.addEventListener('change', updateDetailVisibility);
      const row = el(
        'div',
        { className: 'check-row' },
        checkbox,
        el('label', { for: checkbox.id }, member.displayName),
        detail
      );
      return { member, checkbox, detail, row };
    });

    function updateDetailVisibility() {
      const mode = splitMode.value;
      for (const { checkbox, detail, member } of participantRows) {
        const show = checkbox.checked && mode !== 'equal';
        if (show && detail.style.display === 'none') {
          // Beim Moduswechsel passende Vorbelegung setzen.
          if (mode === 'exact') {
            detail.value = shareMap.has(member.id) ? centsToInput(shareMap.get(member.id)) : '';
            detail.placeholder = '0,00';
          } else {
            detail.value = String(unitMap.get(member.id) ?? 1);
            detail.placeholder = '1';
          }
        }
        detail.style.display = show ? '' : 'none';
      }
    }

    for (const { detail } of participantRows) detail.style.display = 'none';
    updateDetailVisibility();
    splitMode.addEventListener('change', () => {
      for (const { detail } of participantRows) (detail.style.display = 'none');
      updateDetailVisibility();
    });

    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const submit = async (event) => {
      event.preventDefault();
      const amountCents = parseEuroInput(amount.value);
      if (amountCents === null || amountCents <= 0) {
        showError('Bitte einen Betrag größer 0 eingeben, z. B. 12,50.');
        return;
      }
      const mode = splitMode.value;
      const participants = [];
      for (const { member, checkbox, detail } of participantRows) {
        if (!checkbox.checked) continue;
        if (mode === 'equal') {
          participants.push({ userId: member.id });
        } else if (mode === 'exact') {
          const cents = parseEuroInput(detail.value);
          if (cents === null || cents < 0) {
            showError(`Bitte einen Betrag für ${member.displayName} eingeben.`);
            return;
          }
          participants.push({ userId: member.id, shareCents: cents });
        } else {
          const units = parseInt(detail.value, 10);
          if (!Number.isInteger(units) || units < 1 || String(units) !== detail.value.trim()) {
            showError(`Bitte ganze Anteile ab 1 für ${member.displayName} eingeben.`);
            return;
          }
          participants.push({ userId: member.id, units });
        }
      }
      if (participants.length === 0) {
        showError('Mindestens eine Person muss beteiligt sein.');
        return;
      }
      if (mode === 'exact') {
        const sum = participants.reduce((s, p) => s + p.shareCents, 0);
        if (sum !== amountCents) {
          showError('Die exakten Beträge müssen zusammen den Gesamtbetrag ergeben.');
          return;
        }
      }
      const body = {
        amountCents,
        description: description.value,
        spentOn: date.value,
        paidBy: paidBy.value,
        splitMode: mode,
        participants,
      };
      try {
        if (isEdit) {
          await api(`/api/groups/${group.id}/expenses/${expense.id}`, { method: 'PUT', body });
        } else {
          await api(`/api/groups/${group.id}/expenses`, { method: 'POST', body });
        }
        close();
        ctx.refresh();
      } catch (err) {
        showError(err.message);
      }
    };

    const remove = async () => {
      const ok = await confirmPanel('Diese Ausgabe wirklich löschen?', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/groups/${group.id}/expenses/${expense.id}`, { method: 'DELETE' });
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
      { onSubmit: submit },
      el('h2', { className: 'panel-title' }, isEdit ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'),
      wrap('Beschreibung', description, 'exp-desc'),
      wrap('Betrag', amount, 'exp-amount'),
      wrap('Datum', date, 'exp-date'),
      wrap(
        'Bezahlt von',
        el('span', { className: 'select-wrap' }, paidBy, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')),
        'exp-paidby'
      ),
      wrap(
        'Aufteilung',
        el('span', { className: 'select-wrap' }, splitMode, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')),
        'exp-split'
      ),
      el('div', { className: 'field' }, el('span', { className: 'field-label' }, 'Beteiligt'), participantRows.map((r) => r.row)),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        isEdit ? el('button', { className: 'textlink', type: 'button', onClick: remove }, 'Löschen') : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'textlink strong', type: 'submit' }, 'Speichern')
      )
    );
  });
}
