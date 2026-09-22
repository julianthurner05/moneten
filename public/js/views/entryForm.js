// Persönlichen Eintrag erfassen, bearbeiten und löschen.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { centsToInput, parseEuroInput, todayIso } from '../format.js';

export function openEntryForm(ctx, categories, entry, { defaultCategoryId, month } = {}) {
  openPanel((close) => {
    const isEdit = !!entry;

    const description = el('input', { id: 'entry-desc', type: 'text', required: true, value: entry?.description ?? '' });
    const amount = el('input', {
      id: 'entry-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: entry ? centsToInput(entry.amountCents) : '',
    });
    const date = el('input', { id: 'entry-date', type: 'date', required: true, value: entry?.spentOn ?? todayIso() });
    const selectedCategory = entry?.categoryId ?? defaultCategoryId ?? categories[0]?.id;
    const category = el(
      'select',
      { id: 'entry-category' },
      categories.map((c) => el('option', { value: c.id, selected: c.id === selectedCategory }, c.name))
    );
    const error = el('p', { className: 'form-error', role: 'alert' });

    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const submit = async (event) => {
      event.preventDefault();
      const amountCents = parseEuroInput(amount.value);
      if (amountCents === null || amountCents === 0) {
        showError('Bitte einen Betrag eingeben, z. B. 12,50 (negativ für Rückerstattungen).');
        return;
      }
      const body = {
        categoryId: category.value,
        description: description.value,
        spentOn: date.value,
        amountCents,
      };
      try {
        if (isEdit) {
          await api(`/api/personal/entries/${entry.id}`, { method: 'PUT', body });
        } else {
          await api('/api/personal/entries', { method: 'POST', body });
        }
        close();
        ctx.refresh();
      } catch (err) {
        showError(err.message);
      }
    };

    const remove = async () => {
      const ok = await confirmPanel('Diesen Eintrag wirklich löschen?', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/personal/entries/${entry.id}`, { method: 'DELETE' });
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
      el('h2', { className: 'panel-title' }, isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag'),
      wrap('Beschreibung', description, 'entry-desc'),
      wrap('Betrag', amount, 'entry-amount'),
      wrap('Datum', date, 'entry-date'),
      wrap(
        'Kategorie',
        el('span', { className: 'select-wrap' }, category, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')),
        'entry-category'
      ),
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
