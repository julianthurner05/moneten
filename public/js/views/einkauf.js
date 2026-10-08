// Einkaufsliste der WG: schnell ergänzen, antippen zum Abhaken.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';

export async function renderEinkauf(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}/einkauf`);
  ctx.show('einkauf', () => build(ctx, groupId, data.items));
}

function build(ctx, groupId, items) {
  const group = ctx.selectedGroup();
  const openItems = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);

  const input = el('input', {
    id: 'einkauf-input',
    type: 'text',
    placeholder: 'Artikel hinzufügen',
    autocomplete: 'off',
  });
  const addForm = el(
    'form',
    {
      className: 'einkauf-add',
      onSubmit: async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        await api(`/api/groups/${groupId}/einkauf`, { method: 'POST', body: { name } });
        ctx.refresh();
      },
    },
    el('div', { className: 'field' }, input)
  );

  // Zeile (div statt button, damit der Bearbeiten-Knopf hineinpasst):
  // Antippen hakt ab, der kleine Knopf rechts öffnet das Bearbeiten.
  const row = (item) =>
    el(
      'div',
      {
        className: `row row-clickable einkauf-row${item.done ? ' is-done' : ''}`,
        onClick: async () => {
          await api(`/api/groups/${groupId}/einkauf/${item.id}`, { method: 'PUT', body: { done: !item.done } });
          ctx.refresh();
        },
      },
      el('span', { className: `einkauf-check${item.done ? ' is-done' : ''}`, 'aria-hidden': 'true' }, item.done ? '✓' : ''),
      el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, item.name)),
      el(
        'div',
        { className: 'row-side' },
        el(
          'button',
          {
            className: 'textlink',
            type: 'button',
            'aria-label': `${item.name} bearbeiten`,
            onClick: (event) => {
              event.stopPropagation();
              openItemForm(ctx, groupId, item);
            },
          },
          'Bearbeiten'
        )
      )
    );

  const clearDone = el(
    'div',
    { className: 'einkauf-clear' },
    el(
      'button',
      {
        className: 'textlink',
        type: 'button',
        onClick: async () => {
          await Promise.all(doneItems.map((item) => api(`/api/groups/${groupId}/einkauf/${item.id}`, { method: 'DELETE' })));
          ctx.refresh();
        },
      },
      'Erledigte löschen'
    )
  );

  return el(
    'div',
    { className: 'view view-top' },
    group?.archived ? null : addForm,
    openItems.length === 0 && doneItems.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch nichts auf der Liste.')
      : el('div', { className: 'row-list', 'data-stagger': '' }, openItems.map(row)),
    doneItems.length > 0
      ? [
          el('div', { className: 'section-label' }, 'Erledigt'),
          el('div', { className: 'row-list', 'data-stagger': '' }, doneItems.map(row)),
          group?.archived ? null : clearDone,
        ]
      : null
  );
}

function openItemForm(ctx, groupId, item) {
  openPanel((close) => {
    const name = el('input', { id: 'einkauf-edit-name', type: 'text', required: true, value: item.name });
    const error = el('p', { className: 'form-error', role: 'alert' });
    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const remove = async () => {
      const ok = await confirmPanel('Diesen Artikel wirklich löschen?', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/groups/${groupId}/einkauf/${item.id}`, { method: 'DELETE' });
        close();
        ctx.refresh();
      } catch (err) {
        showError(err.message);
      }
    };

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            await api(`/api/groups/${groupId}/einkauf/${item.id}`, { method: 'PUT', body: { name: name.value } });
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Artikel bearbeiten'),
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: 'einkauf-edit-name' }, 'Artikel'), name),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink textlink-danger', type: 'button', onClick: remove }, 'Löschen'),
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
