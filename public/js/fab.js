// Schwebender Plus-Button rechts unten mit optionalem Minimenü.

import { el } from './dom.js';

/**
 * @param {Array<{label: string, onClick: () => void, badge?: number}>} items
 *   Ein Eintrag: direkter Klick. Mehrere: Minimenü zur Auswahl.
 * @param {{badge?: number}} options – Zahl am Plus-Button (z. B. Begleichungs-Erinnerung)
 */
export function buildFab(items, { badge = 0 } = {}) {
  // Plus als SVG, damit es exakt in der Kreismitte sitzt.
  const plus = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  plus.setAttribute('viewBox', '0 0 16 16');
  plus.setAttribute('width', '18');
  plus.setAttribute('height', '18');
  plus.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M8 1.5 V14.5 M1.5 8 H14.5');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('fill', 'none');
  plus.append(path);

  const button = el(
    'button',
    { className: 'fab', type: 'button', 'aria-label': 'Hinzufügen' },
    plus,
    badge > 0 ? el('span', { className: 'fab-badge' }, String(badge)) : null
  );

  if (items.length === 1) {
    button.addEventListener('click', items[0].onClick);
    return el('div', { className: 'fab-wrap' }, button);
  }

  const menu = el(
    'div',
    { className: 'fab-menu', role: 'menu' },
    items.map((item) =>
      el(
        'button',
        {
          className: 'fab-menu-item',
          type: 'button',
          role: 'menuitem',
          onClick: () => {
            close();
            item.onClick();
          },
        },
        el('span', {}, item.label),
        item.badge > 0 ? el('span', { className: 'fab-badge' }, String(item.badge)) : null
      )
    )
  );

  const wrap = el('div', { className: 'fab-wrap' }, menu, button);

  const close = () => {
    wrap.classList.remove('is-open');
    document.removeEventListener('pointerdown', onOutside, true);
  };
  const onOutside = (event) => {
    if (!wrap.contains(event.target)) close();
  };
  button.addEventListener('click', () => {
    const open = wrap.classList.toggle('is-open');
    if (open) document.addEventListener('pointerdown', onOutside, true);
    else close();
  });

  return wrap;
}
