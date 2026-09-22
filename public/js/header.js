// Kopfzeile: Wortmarke, Navigation, Gesamtsaldo, Hell/Dunkel-Umschaltung.

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

function balanceText(totalBalanceCents) {
  if (totalBalanceCents > 0) return `Du bekommst ${formatEuro(totalBalanceCents)}`;
  if (totalBalanceCents < 0) return `Du schuldest ${formatEuro(-totalBalanceCents)}`;
  return 'Alles ausgeglichen';
}

/**
 * @param {object} state – {user, active, groupCount, totalBalanceCents}
 */
export function renderHeader(state) {
  const header = document.getElementById('header');
  const theme = currentTheme();

  const themeToggle = el(
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

  const wordmark = el('a', { className: 'wordmark', href: '#/' }, 'moneten');

  if (!state.user) {
    header.replaceChildren(el('div', { className: 'header-inner' }, wordmark, el('div', { className: 'header-spacer' }), themeToggle));
    return;
  }

  const navItems = [
    { key: 'monat', label: 'Monat', href: '#/monat', disabled: true, number: '' },
    { key: 'gruppen', label: 'Gruppen', href: '#/gruppen', number: String(state.groupCount ?? '') },
    { key: 'konto', label: 'Konto', href: '#/konto', number: '' },
  ];

  const buildNavCell = (item) => {
    const content = [
      el('span', { className: 'nav-label' }, item.label),
      el('span', { className: 'nav-number' }, item.number),
    ];
    if (item.disabled) {
      return el('span', { className: 'nav-cell is-disabled', 'aria-disabled': 'true' }, content);
    }
    return el(
      'a',
      { className: `nav-cell${state.active === item.key ? ' is-active' : ''}`, href: item.href },
      content
    );
  };

  const nav = el('nav', { className: 'header-nav', 'aria-label': 'Hauptnavigation' }, navItems.map(buildNavCell));
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
          menu.addEventListener('transitionend', () => {
            if (!menu.classList.contains('is-open')) menu.style.display = 'none';
          }, { once: true });
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
      item.disabled
        ? el('span', { className: 'mobile-menu-item is-disabled' }, item.label)
        : el(
            'a',
            { className: `mobile-menu-item${state.active === item.key ? ' is-active' : ''}`, href: item.href },
            item.label,
            item.number ? el('span', { className: 'mobile-menu-number' }, item.number) : null
          )
    ),
    el('div', { className: 'mobile-menu-status' }, balanceText(state.totalBalanceCents ?? 0)),
    el(
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
    )
  );

  header.replaceChildren(
    el('div', { className: 'header-inner' }, wordmark, nav, status, themeToggle, menuButton),
    mobileMenu
  );
}
