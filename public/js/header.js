// Kopfzeile: Gruppen-Dropdown (Workspace), Tabs, Gesamtsaldo, Hell/Dunkel.

import { el } from './dom.js';
import { formatEuro } from './format.js';

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

function setTheme(theme) {
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

function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function themeToggle(theme) {
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

function balanceText(totalBalanceCents) {
  if (totalBalanceCents > 0) return `Du bekommst ${formatEuro(totalBalanceCents)}`;
  if (totalBalanceCents < 0) return `Du schuldest ${formatEuro(-totalBalanceCents)}`;
  return 'Alles ausgeglichen';
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
 * @param {object} state – {user, active, groups, selectedGroup, totalBalanceCents}
 */
export function renderHeader(state) {
  const header = document.getElementById('header');
  const theme = currentTheme();

  if (!state.user) {
    header.replaceChildren(
      el('div', { className: 'header-inner' }, el('div', { className: 'header-spacer' }), themeToggle(theme))
    );
    return;
  }

  const hasEinzug = state.selectedGroup?.kind === 'wg';
  const navItems = [
    state.selectedGroup ? { key: 'gruppe', label: 'Gruppe', href: '#/' } : null,
    hasEinzug ? { key: 'einzug', label: 'Einzug', href: '#/einzug' } : null,
    { key: 'monat', label: 'Monat', href: '#/monat' },
    { key: 'konto', label: 'Konto', href: '#/konto' },
  ].filter(Boolean);

  const nav = el(
    'nav',
    { className: 'header-nav', 'aria-label': 'Hauptnavigation' },
    navItems.map((item) =>
      el(
        'a',
        { className: `nav-cell${state.active === item.key ? ' is-active' : ''}`, href: item.href },
        el('span', { className: 'nav-label' }, item.label)
      )
    )
  );

  const status = el('div', { className: 'header-status' }, balanceText(state.totalBalanceCents ?? 0));

  const menuButton = el(
    'button',
    {
      className: 'menu-button',
      type: 'button',
      'aria-label': 'Menü',
      'aria-expanded': 'false',
      onClick: () => {
        const menu = header.querySelector('.mobile-menu');
        const open = menu.classList.toggle('is-open');
        menuButton.setAttribute('aria-expanded', String(open));
        if (open) {
          menu.style.display = 'block';
          requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-visible')));
        } else {
          menu.classList.remove('is-visible');
          menu.addEventListener(
            'transitionend',
            () => {
              if (!menu.classList.contains('is-open')) menu.style.display = 'none';
            },
            { once: true }
          );
        }
      },
    },
    el('span', { className: 'menu-line' }),
    el('span', { className: 'menu-line' })
  );

  const mobileMenu = el(
    'div',
    { className: 'mobile-menu' },
    navItems.map((item) =>
      el(
        'a',
        { className: `mobile-menu-item${state.active === item.key ? ' is-active' : ''}`, href: item.href },
        item.label
      )
    ),
    el('div', { className: 'mobile-menu-status' }, balanceText(state.totalBalanceCents ?? 0)),
    themeToggle(theme)
  );

  header.replaceChildren(
    el('div', { className: 'header-inner' }, buildWorkspace(state), nav, status, themeToggle(theme), menuButton),
    mobileMenu
  );
}
