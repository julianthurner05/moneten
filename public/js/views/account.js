// Konto-Bereich: sitzt ganz unten im Privat-Bereich.
// Eigene Daten, Passwort ändern, Abmelden – für Admins die User-Verwaltung.

import { api } from '../api.js';
import { el, openPanel } from '../dom.js';

export function buildAccountSection(ctx, users) {
  const user = ctx.state.user;

  const ownRow = el(
    'div',
    { className: 'row' },
    el(
      'div',
      { className: 'row-main' },
      el('div', { className: 'row-title' }, user.displayName)
    ),
    el(
      'div',
      { className: 'row-side' },
      el('a', { className: 'textlink', href: '#/konto/passwort' }, 'Passwort ändern'),
      el(
        'button',
        {
          className: 'textlink',
          type: 'button',
          onClick: async () => {
            await api('/api/logout', { method: 'POST' });
            ctx.onLogout();
          },
        },
        'Abmelden'
      )
    )
  );

  let adminRows = null;
  if (users) {
    adminRows = users
      .filter((entry) => entry.id !== user.id)
      .map((entry) =>
        el(
          'div',
          { className: 'row' },
          el(
            'div',
            { className: 'row-main' },
            el('div', { className: 'row-title' }, entry.displayName),
            entry.mustChangePassword ? el('div', { className: 'row-label' }, 'Muss Passwort ändern') : null
          ),
          el(
            'div',
            { className: 'row-side' },
            el('button', { className: 'textlink', type: 'button', onClick: () => openResetForm(ctx, entry) }, 'Passwort zurücksetzen')
          )
        )
      );
  }

  return [
    el(
      'div',
      { className: 'settings-block-head' },
      el('div', { className: 'section-label' }, 'Konto'),
      users
        ? el('button', { className: 'textlink', type: 'button', onClick: () => openUserForm(ctx) }, '+ User')
        : null
    ),
    el('div', { className: 'row-list', 'data-stagger': '' }, ownRow, adminRows),
  ];
}

function openUserForm(ctx) {
  openPanel((close) => {
    const username = el('input', { id: 'new-username', type: 'text', autocapitalize: 'none', required: true });
    const displayName = el('input', { id: 'new-displayname', type: 'text', required: true });
    const password = el('input', { id: 'new-password', type: 'text', required: true });
    const error = el('p', { className: 'form-error', role: 'alert' });
    const wrap = (label, input) =>
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: input.id }, label), input);

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            await api('/api/users', {
              method: 'POST',
              body: { username: username.value, displayName: displayName.value, password: password.value },
            });
            close();
            ctx.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Neuer User'),
      wrap('Benutzername', username),
      wrap('Anzeigename', displayName),
      wrap('Startpasswort', password),
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

function openResetForm(ctx, entry) {
  openPanel((close) => {
    const password = el('input', { id: 'reset-password', type: 'text', required: true });
    const error = el('p', { className: 'form-error', role: 'alert' });

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            await api(`/api/users/${entry.id}/reset-password`, { method: 'POST', body: { password: password.value } });
            close();
            ctx.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, `Passwort zurücksetzen: ${entry.displayName}`),
      el(
        'div',
        { className: 'field' },
        el('label', { className: 'field-label', for: 'reset-password' }, 'Neues Startpasswort'),
        password
      ),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Zurücksetzen')
      )
    );
  });
}
