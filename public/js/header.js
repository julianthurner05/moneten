// Kopfzeile mit zwei Modi:
// Gruppe  – links Gruppen-Dropdown, Tabs Gruppe/Einzug, rechts der Privat-Umschalter.
// Privat  – links zurück zur Gruppe, Tabs Monat/Konto, Privat-Umschalter eingebettet.

import { el } from './dom.js';

/** Zahnrad für den Einstellungen-Link („settings" von lucide.dev, ISC-Lizenz). */
function gearIcon() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('gear-icon');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'
  );
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '3');
  svg.append(path, circle);
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
  const hash = location.hash;
  const navItems = privat
    ? [
        {
          label: 'Monat',
          href: '#/monat',
          active:
            state.active === 'monat' && !hash.startsWith('#/monat/uebersicht') && !hash.startsWith('#/monat/einstellungen'),
        },
        { label: 'Übersicht', href: '#/monat/uebersicht', active: hash.startsWith('#/monat/uebersicht') },
        { label: 'Budgetplanung', href: '#/monat/einstellungen', active: hash.startsWith('#/monat/einstellungen') },
      ]
    : [
        state.selectedGroup
          ? { label: 'Allgemein', href: '#/', active: state.active === 'gruppe', badge: tabNew.gruppe }
          : null,
        hasEinzug
          ? { label: 'Einkaufsliste', href: '#/einkaufsliste', active: state.active === 'einkauf', badge: tabNew.einkauf }
          : null,
        hasEinzug
          ? {
              label: 'Putzplan',
              href: '#/putzplan',
              active: state.active === 'putzplan',
              badge: state.selectedGroup?.myCleaningCount,
            }
          : null,
        hasEinzug ? { label: 'Einzug', href: '#/einzug', active: state.active === 'einzug', badge: tabNew.einzug } : null,
      ].filter(Boolean);

  const nav = el(
    'nav',
    { className: 'header-nav', 'aria-label': 'Hauptnavigation' },
    navItems.map((item) =>
      el(
        'a',
        { className: `nav-cell${item.active ? ' is-active' : ''}`, href: item.href },
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
    ? el(
        'a',
        { className: `gear-link${state.active === 'konto' ? ' is-active' : ''}`, href: '#/konto', 'aria-label': 'Einstellungen' },
        gearIcon()
      )
    : null;

  const tabContent = navItems.length > 0 ? [nav] : [];

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
