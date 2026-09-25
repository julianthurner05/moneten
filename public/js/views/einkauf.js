// Einkaufsliste der WG: schnell ergänzen, antippen zum Abhaken.

import { api } from '../api.js';
import { el } from '../dom.js';

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

  const row = (item) =>
    el(
      'button',
      {
        className: `row row-clickable einkauf-row${item.done ? ' is-done' : ''}`,
        type: 'button',
        onClick: async () => {
          await api(`/api/groups/${groupId}/einkauf/${item.id}`, { method: 'PUT', body: { done: !item.done } });
          ctx.refresh();
        },
      },
      el('span', { className: `einkauf-check${item.done ? ' is-done' : ''}`, 'aria-hidden': 'true' }, item.done ? '✓' : ''),
      el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, item.name))
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
