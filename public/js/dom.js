// DOM-Helfer: Elemente bauen, weiche Übergänge, Panels.

/**
 * Element bauen. props: Attribute/Properties, className, dataset, on* als Listener.
 * children: Strings werden zu Textknoten (nie innerHTML).
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === 'className') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Kinder eines Containers nacheinander sanft einblenden. */
export function staggerIn(container) {
  const items = [...container.children];
  items.forEach((item, i) => {
    item.classList.add('enter');
    item.style.transitionDelay = `calc(var(--stagger-step) * ${Math.min(i, 12)})`;
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const item of items) {
        item.classList.add('enter-active');
        item.addEventListener(
          'transitionend',
          () => {
            item.classList.remove('enter', 'enter-active');
            item.style.transitionDelay = '';
          },
          { once: true }
        );
      }
    });
  });
}

/** Ansicht wechseln: alte ausblenden, dann neue einblenden. */
export function swapView(container, build) {
  const finish = () => {
    container.replaceChildren(build());
    container.classList.remove('view-hidden');
    for (const stagger of container.querySelectorAll('[data-stagger]')) {
      staggerIn(stagger);
    }
  };
  if (container.childElementCount === 0) {
    finish();
    return;
  }
  container.classList.add('view-hidden');
  const done = (event) => {
    if (event.target !== container || event.propertyName !== 'opacity') return;
    container.removeEventListener('transitionend', done);
    finish();
  };
  container.addEventListener('transitionend', done);
}

/**
 * Panel (Kasten mit Haarlinien-Rahmen) öffnen.
 * buildContent(close) liefert den Inhalt; Esc und Klick außerhalb schließen.
 * Gibt die close-Funktion zurück.
 */
export function openPanel(buildContent, { onClose } = {}) {
  const panel = el('div', { className: 'panel', role: 'dialog', 'aria-modal': 'true' });
  const overlay = el('div', { className: 'panel-overlay' }, panel);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('is-open');
    overlay.addEventListener('transitionend', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  panel.append(buildContent(close));
  document.body.append(overlay);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  });
  panel.querySelector('input, select, button')?.focus();
  return close;
}

/** Bestätigungs-Panel; löst mit true/false auf. */
export function confirmPanel(message, confirmLabel) {
  return new Promise((resolve) => {
    let result = false;
    openPanel(
      (close) =>
        el(
          'div',
          {},
          el('p', { className: 'panel-message' }, message),
          el(
            'div',
            { className: 'panel-actions' },
            el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
            el(
              'button',
              {
                className: 'button',
                type: 'button',
                onClick: () => {
                  result = true;
                  close();
                },
              },
              confirmLabel
            )
          )
        ),
      { onClose: () => resolve(result) }
    );
  });
}
