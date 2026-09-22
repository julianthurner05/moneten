// Gruppen-Übersicht: Karten-Raster oder Liste, Filter, Sortierung, Gruppe anlegen.

import { api } from '../api.js';
import { el, openPanel } from '../dom.js';
import { formatEuro } from '../format.js';

const viewState = {
  mode: 'grid', // 'grid' | 'list'
  sort: 'newest', // 'newest' | 'name'
  showArchived: false,
};

function balanceLabel(cents) {
  if (cents > 0) return 'Du bekommst';
  if (cents < 0) return 'Du schuldest';
  return 'Ausgeglichen';
}

function sortedGroups(groups) {
  const list = groups.filter((g) => viewState.showArchived || !g.archived);
  if (viewState.sort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  return list;
}

function memberLabel(count) {
  return count === 1 ? '1 Mitglied' : `${count} Mitglieder`;
}

function metaLabel(group) {
  return [group.kind === 'wg' ? 'WG' : null, memberLabel(group.memberCount), group.archived ? 'Archiviert' : null]
    .filter(Boolean)
    .join(' · ');
}

export function renderGroups(ctx, data) {
  ctx.show(null, () => build(ctx, data));
}

function build(ctx, data) {
  const groups = sortedGroups(data.groups);

  const toggle = (label, isActive, onClick) =>
    el('button', { className: `textlink${isActive ? ' is-active' : ''}`, type: 'button', onClick }, label);

  const toolbar = el(
    'div',
    { className: 'toolbar' },
    el(
      'div',
      { className: 'toolbar-group' },
      toggle('Raster', viewState.mode === 'grid', () => {
        viewState.mode = 'grid';
        ctx.refresh();
      }),
      toggle('Liste', viewState.mode === 'list', () => {
        viewState.mode = 'list';
        ctx.refresh();
      })
    ),
    el(
      'div',
      { className: 'toolbar-group' },
      toggle('Neueste', viewState.sort === 'newest', () => {
        viewState.sort = 'newest';
        ctx.refresh();
      }),
      toggle('Name', viewState.sort === 'name', () => {
        viewState.sort = 'name';
        ctx.refresh();
      })
    ),
    el(
      'div',
      { className: 'toolbar-group' },
      toggle('Archivierte', viewState.showArchived, () => {
        viewState.showArchived = !viewState.showArchived;
        ctx.refresh();
      })
    ),
    el('div', { className: 'toolbar-spacer' }),
    el(
      'button',
      { className: 'button', type: 'button', onClick: () => openGroupForm(ctx) },
      '+ Gruppe'
    )
  );

  const head = el(
    'div',
    { className: 'section-head' },
    el('div', { className: 'big-count' }, String(groups.length)),
    toolbar
  );

  let content;
  if (groups.length === 0) {
    content = el('p', { className: 'empty-note' }, 'Noch keine Gruppen.');
  } else if (viewState.mode === 'grid') {
    content = el(
      'div',
      { className: 'card-grid', 'data-stagger': '' },
      groups.map((group) =>
        el(
          'a',
          { className: 'card', href: `#/gruppen/${group.id}` },
          el(
            'div',
            { className: 'card-meta' },
            el('span', {}, group.name),
            el('span', {}, metaLabel(group))
          ),
          el('div', { className: 'card-amount' }, formatEuro(group.myBalanceCents)),
          el('div', { className: 'card-foot' }, balanceLabel(group.myBalanceCents))
        )
      )
    );
  } else {
    content = el(
      'div',
      { className: 'row-list', 'data-stagger': '' },
      groups.map((group) =>
        el(
          'a',
          { className: 'row', href: `#/gruppen/${group.id}` },
          el(
            'div',
            { className: 'row-main' },
            el('div', { className: 'row-label' }, metaLabel(group)),
            el('div', { className: 'row-title' }, group.name)
          ),
          el(
            'div',
            { className: 'row-side' },
            el('div', { className: 'row-label' }, balanceLabel(group.myBalanceCents)),
            el('div', { className: 'row-amount' }, formatEuro(group.myBalanceCents))
          )
        )
      )
    );
  }

  return el('div', { className: 'view' }, head, content);
}

async function openGroupForm(ctx) {
  const { users } = await api('/api/users');
  openPanel((close) => {
    const name = el('input', { id: 'group-name', type: 'text', required: true });
    const kind = el(
      'select',
      { id: 'group-kind' },
      el('option', { value: 'standard', selected: true }, 'Standard'),
      el('option', { value: 'wg' }, 'WG')
    );
    const error = el('p', { className: 'form-error', role: 'alert' });

    const checkboxes = users.map((user) => {
      const isSelf = user.id === ctx.state.user.id;
      const input = el('input', {
        type: 'checkbox',
        id: `member-${user.id}`,
        checked: isSelf,
        disabled: isSelf,
        dataset: { userId: user.id },
      });
      return el('div', { className: 'check-row' }, input, el('label', { for: input.id }, user.displayName));
    });

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          const memberIds = checkboxes
            .map((row) => row.querySelector('input'))
            .filter((input) => input.checked)
            .map((input) => input.dataset.userId);
          try {
            const result = await api('/api/groups', {
              method: 'POST',
              body: { name: name.value, kind: kind.value, memberIds },
            });
            close();
            ctx.navigate(`#/gruppen/${result.id}`);
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Neue Gruppe'),
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: 'group-name' }, 'Name'), name),
      el(
        'div',
        { className: 'field' },
        el('label', { className: 'field-label', for: 'group-kind' }, 'Art'),
        el('span', { className: 'select-wrap' }, kind, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾'))
      ),
      el('div', { className: 'field' }, el('span', { className: 'field-label' }, 'Mitglieder'), checkboxes),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Anlegen')
      )
    );
  });
}
