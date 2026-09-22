// Kopfzeile mit zwei Modi:
// Gruppe  – links Gruppen-Dropdown, Tabs Gruppe/Einzug, rechts der Privat-Umschalter.
// Privat  – links zurück zur Gruppe, Tabs Monat/Konto, Privat-Umschalter eingebettet.

import { el } from './dom.js';

function kindLabel(group) {
  return group.kind === 'wg' ? 'WG' : 'Standard';
}

function buildWorkspace(state) {
  const { groups, selectedGroup } = state;
  const activeGroups = groups.filter((g) => !g.archived);

  const button = el(
    'button',
    {
      className: 'workspace-button',
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
    },
    el('span', { className: 'workspace-name' }, selectedGroup ? selectedGroup.name : 'Gruppen'),
    el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')
  );

  const menu = el(
    'div',
    { className: 'workspace-menu', role: 'menu' },
    activeGroups.map((group) =>
      el(
        'a',
        {
          className: `workspace-item${group.id === selectedGroup?.id ? ' is-active' : ''}`,
          role: 'menuitem',
          href: `#/gruppen/${group.id}`,
        },
        el('span', { className: 'workspace-item-name' }, group.name),
        el('span', { className: 'workspace-item-kind' }, kindLabel(group))
      )
    ),
    el(
      'a',
      { className: 'workspace-item workspace-item-footer', role: 'menuitem', href: '#/gruppen' },
      'Alle Gruppen'
    )
  );

  const wrap = el('div', { className: 'workspace' }, button, menu);

  const closeMenu = () => {
    wrap.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
  };
  const onOutside = (event) => {
    if (!wrap.contains(event.target)) closeMenu();
  };
  button.addEventListener('click', () => {
    const open = wrap.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    if (open) document.addEventListener('pointerdown', onOutside, true);
    else closeMenu();
  });
  menu.addEventListener('click', closeMenu);

  return wrap;
}

/**
 * @param {object} state – {user, active, groups, selectedGroup}
 * active: 'gruppe' | 'einzug' | 'monat' | 'konto' | null
 */
export function renderHeader(state) {
  const header = document.getElementById('header');

  if (!state.user) {
    header.replaceChildren(el('div', { className: 'header-inner' }));
    return;
  }

  const privat = state.active === 'monat' || state.active === 'konto';
  const hasEinzug = state.selectedGroup?.kind === 'wg';

  const navItems = privat
    ? []
    : [
        state.selectedGroup ? { key: 'gruppe', label: 'Allgemein', href: '#/' } : null,
        hasEinzug ? { key: 'einzug', label: 'Einzug', href: '#/einzug' } : null,
      ].filter(Boolean);

  const nav = el(
    'nav',
    { className: 'header-nav', 'aria-label': 'Hauptnavigation' },
    navItems.map((item) =>
      el(
        'a',
        { className: `nav-cell${state.active === item.key ? ' is-active' : ''}`, href: item.href },
        item.label
      )
    )
  );

  // Wer (außer Admin) nur in einer Gruppe ist, braucht kein Dropdown.
  const activeGroups = state.groups.filter((g) => !g.archived);
  const singleGroup = !state.user.isAdmin && activeGroups.length <= 1;
  const left = privat
    ? el(
        'a',
        { className: 'workspace-button', href: '#/' },
        el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '←'),
        el('span', { className: 'workspace-name' }, 'Gruppen')
      )
    : singleGroup
      ? el(
          'div',
          { className: 'workspace-button workspace-static' },
          el('span', { className: 'workspace-name' }, state.selectedGroup ? state.selectedGroup.name : 'moneten')
        )
      : buildWorkspace(state);

  const privatToggle = privat
    ? el('span', { className: 'privat-toggle is-embedded', 'aria-current': 'true' }, 'Privat')
    : el('a', { className: 'privat-toggle', href: '#/monat' }, 'Privat');

  const budget = privat
    ? [
        el('a', { className: 'textlink', href: '#/monat/uebersicht' }, 'Übersicht'),
        el('a', { className: 'textlink', href: '#/monat/einstellungen' }, 'Budgetplanung'),
      ]
    : null;

  header.replaceChildren(
    el('div', { className: 'header-inner' }, left, nav, el('div', { className: 'header-spacer' }), budget, privatToggle)
  );
}
