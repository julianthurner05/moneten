// Konto: eigene Daten, Passwort ändern, Abmelden – und für Admins die User-Verwaltung.

import { api } from '../api.js';
import { el, openPanel } from '../dom.js';

export async function renderAccount(ctx) {
  const isAdmin = ctx.state.user.isAdmin;
  const users = isAdmin ? (await api('/api/users')).users : null;
  ctx.show('konto', () => build(ctx, users));
}

function build(ctx, users) {
  const user = ctx.state.user;

  const ownSection = el(
    'div',
    { className: 'row-list', 'data-stagger': '' },
    el(
      'div',
      { className: 'row' },
      el(
        'div',
        { className: 'row-main' },
        el('div', { className: 'row-label' }, user.username),
        el('div', { className: 'row-title' }, user.displayName)
      ),
      el(
        'div',
        { className: 'row-side' },
        el('button', { className: 'textlink', type: 'button', onClick: () => (location.hash = '#/konto/passwort') }, 'Passwort ändern'),
        el(
          'button',
          {
            className: 'textlink strong',
            type: 'button',
            onClick: async () => {
              await api('/api/logout', { method: 'POST' });
              ctx.onLogout();
            },
          },
          'Abmelden'
        )
      )
    )
  );

  const head = el(
    'div',
    { className: 'section-head' },
    el('div', { className: 'big-count' }, users ? String(users.length) : '1'),
    el(
      'div',
      { className: 'toolbar' },
      el('div', { className: 'toolbar-spacer' }),
      users
        ? el('button', { className: 'textlink strong', type: 'button', onClick: () => openUserForm(ctx) }, '+ User')
        : null
    )
  );

  let adminSection = null;
  if (users) {
    adminSection = el(
      'div',
      { className: 'row-list', 'data-stagger': '' },
      users.map((entry) =>
        el(
          'div',
          { className: 'row' },
          el(
            'div',
            { className: 'row-main' },
            el(
              'div',
              { className: 'row-label' },
              [entry.username, entry.isAdmin ? 'Admin' : null, entry.mustChangePassword ? 'Muss Passwort ändern' : null]
                .filter(Boolean)
                .join(' · ')
            ),
            el('div', { className: 'row-title' }, entry.displayName)
          ),
          el(
            'div',
            { className: 'row-side' },
            entry.id === ctx.state.user.id
              ? null
              : el(
                  'button',
                  { className: 'textlink', type: 'button', onClick: () => openResetForm(ctx, entry) },
                  'Passwort zurücksetzen'
                )
          )
        )
      )
    );
  }

  return el('div', { className: 'view' }, head, ownSection, adminSection);
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
        el('button', { className: 'textlink strong', type: 'submit' }, 'Anlegen')
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
        el('button', { className: 'textlink strong', type: 'submit' }, 'Zurücksetzen')
      )
    );
  });
}
