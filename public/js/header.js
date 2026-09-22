// Kopfzeile mit zwei Modi:
// Gruppe  – links Gruppen-Dropdown, Tabs Gruppe/Einzug, rechts der Privat-Umschalter.
// Privat  – links zurück zur Gruppe, Tabs Monat/Konto, Privat-Umschalter eingebettet.

import { el } from './dom.js';

const THEME_KEY = 'moneten_theme';

function themeIcon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '8');
  circle.setAttribute('cy', '8');
  circle.setAttribute('r', '6.5');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'currentColor');
  svg.append(circle);
  if (kind === 'dark') {
    const half = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    half.setAttribute('d', 'M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z');
    half.setAttribute('fill', 'currentColor');
    svg.append(half);
  }
  return svg;
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage nicht verfügbar
  }
  document.querySelectorAll('.theme-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.theme === theme);
  });
}

export function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Hell/Dunkel-Umschalter – sitzt im Konto-Bereich. */
export function themeToggle() {
  const theme = currentTheme();
  return el(
    'div',
    { className: 'theme-toggle', role: 'group', 'aria-label': 'Farbschema' },
    ['light', 'dark'].map((kind) =>
      el(
        'button',
        {
          className: `theme-button${theme === kind ? ' is-active' : ''}`,
          type: 'button',
          dataset: { theme: kind },
          'aria-label': kind === 'light' ? 'Helles Schema' : 'Dunkles Schema',
          onClick: () => setTheme(kind),
        },
        themeIcon(kind)
      )
    )
  );
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

  if (!state.user) {
    header.replaceChildren(el('div', { className: 'header-inner' }));
    return;
  }

  const privat = state.active === 'monat' || state.active === 'konto';
  const hasEinzug = state.selectedGroup?.kind === 'wg';

  const navItems = privat
    ? [
        { key: 'monat', label: 'Monat', href: '#/monat' },
        { key: 'konto', label: 'Konto', href: '#/konto' },
      ]
    : [
        state.selectedGroup ? { key: 'gruppe', label: 'Gruppe', href: '#/' } : null,
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

  const left = privat
    ? el(
        'a',
        { className: 'workspace-button', href: '#/' },
        el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '←'),
        el('span', { className: 'workspace-name' }, state.selectedGroup ? state.selectedGroup.name : 'Gruppe')
      )
    : buildWorkspace(state);

  const privatToggle = privat
    ? el('span', { className: 'privat-toggle is-embedded', 'aria-current': 'true' }, 'Privat')
    : el('a', { className: 'privat-toggle', href: '#/monat' }, 'Privat');

  header.replaceChildren(el('div', { className: 'header-inner' }, left, nav, el('div', { className: 'header-spacer' }), privatToggle));
}
