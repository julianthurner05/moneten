// Kopfzeile mit zwei Modi:
// Gruppe  – links Gruppen-Dropdown, Tabs Gruppe/Einzug, rechts der Privat-Umschalter.
// Privat  – links zurück zur Gruppe, Tabs Monat/Konto, Privat-Umschalter eingebettet.

import { el } from './dom.js';

/** Geometrisch gezeichnetes Zahnrad für den Einstellungen-Link. */
function gearIcon() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('gear-icon');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '5');
  svg.append(circle);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(12 + 7 * Math.cos(angle)));
    line.setAttribute('y1', String(12 + 7 * Math.sin(angle)));
    line.setAttribute('x2', String(12 + 10 * Math.cos(angle)));
    line.setAttribute('y2', String(12 + 10 * Math.sin(angle)));
    svg.append(line);
  }
  return svg;
}

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

  if (!state.user || state.active === 'passwort') {
    header.replaceChildren();
    return;
  }

  const privat = state.active === 'monat' || state.active === 'konto';
  const hasEinzug = state.selectedGroup?.kind === 'wg';

  const tabNew = state.selectedGroup?.tabNew ?? {};
  const navItems = privat
    ? []
    : [
        state.selectedGroup ? { key: 'gruppe', label: 'Allgemein', href: '#/', badge: tabNew.gruppe } : null,
        hasEinzug ? { key: 'einkauf', label: 'Einkaufsliste', href: '#/einkaufsliste', badge: tabNew.einkauf } : null,
        hasEinzug
          ? { key: 'putzplan', label: 'Putzplan', href: '#/putzplan', badge: state.selectedGroup?.myCleaningCount }
          : null,
        hasEinzug ? { key: 'einzug', label: 'Einzug', href: '#/einzug', badge: tabNew.einzug } : null,
      ].filter(Boolean);

  const nav = el(
    'nav',
    { className: 'header-nav', 'aria-label': 'Hauptnavigation' },
    navItems.map((item) =>
      el(
        'a',
        { className: `nav-cell${state.active === item.key ? ' is-active' : ''}`, href: item.href },
        item.label,
        item.badge > 0 ? el('span', { className: 'nav-badge' }, String(item.badge)) : null
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

  // Einstellungen (Zahnrad) links neben der Privat-Pille, nur im Privat-Modus.
  const gear = privat
    ? el('a', { className: 'gear-link', href: '#/konto', 'aria-label': 'Einstellungen' }, gearIcon())
    : null;

  const tabContent = privat
    ? [
        el('a', { className: 'textlink', href: '#/monat/uebersicht' }, 'Übersicht'),
        el('a', { className: 'textlink', href: '#/monat/einstellungen' }, 'Budgetplanung'),
      ]
    : navItems.length > 0
      ? [nav]
      : [];

  // Am Handy sitzen die Tabs unter der Linie, am Desktop in der Kopfzeile.
  const mobile = matchMedia('(max-width: 767px)').matches;
  if (mobile) {
    header.replaceChildren(
      el('div', { className: 'header-inner' }, left, el('div', { className: 'header-spacer' }), gear, privatToggle),
      ...(tabContent.length > 0 ? [el('div', { className: 'header-tabs' }, tabContent)] : [])
    );
  } else if (privat) {
    header.replaceChildren(
      el('div', { className: 'header-inner' }, left, el('div', { className: 'header-spacer' }), tabContent, gear, privatToggle)
    );
  } else {
    header.replaceChildren(
      el('div', { className: 'header-inner' }, left, tabContent, el('div', { className: 'header-spacer' }), privatToggle)
    );
  }
}
