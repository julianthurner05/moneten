// Konto: eigene Seite, erreichbar über den Button ganz unten im Privat-Bereich.
// Eigene Daten, Passwort ändern, Abmelden – für Admins die User-Verwaltung.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';

export async function renderAccount(ctx) {
  const users = ctx.state.user.isAdmin ? (await api('/api/users')).users : null;
  ctx.show('konto', () =>
    el(
      'div',
      { className: 'view' },
      el(
        'div',
        { className: 'hero hero-centered' },
        el('div', { className: 'month-title' }, ctx.state.user.isAdmin ? 'Adminbereich' : 'Konto'),
        el('a', { className: 'textlink', href: '#/monat' }, '← Privat')
      ),
      buildAccountSection(ctx, users)
    )
  );
}

function buildAccountSection(ctx, users) {
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

  const activeGroups = ctx.state.groups.filter((g) => !g.archived);
  const adminTools =
    users && activeGroups.length > 0
      ? [
          el('div', { className: 'section-label' }, 'Gruppen'),
          el(
            'div',
            { className: 'row-list' },
            el(
              'div',
              { className: 'row' },
              el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, 'Gruppe archivieren')),
              el(
                'div',
                { className: 'row-side' },
                el('button', { className: 'textlink', type: 'button', onClick: () => openArchiveForm(ctx, activeGroups) }, 'Auswählen')
              )
            )
          ),
        ]
      : null;

  return [
    users
      ? el(
          'div',
          { className: 'settings-block-head' },
          el('div', { className: 'section-label' }, 'Accounts'),
          el('button', { className: 'textlink', type: 'button', onClick: () => openUserForm(ctx) }, '+ User')
        )
      : null,
    el('div', { className: 'row-list', 'data-stagger': '' }, ownRow, adminRows),
    adminTools,
  ];
}

function openArchiveForm(ctx, groups) {
  openPanel((close) => {
    const select = el(
      'select',
      { id: 'archive-group' },
      groups.map((group) => el('option', { value: group.id }, group.name))
    );
    const error = el('p', { className: 'form-error', role: 'alert' });

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          const group = groups.find((g) => g.id === select.value);
          close();
          const ok = await confirmPanel(
            `„${group.name}" archivieren? Das geht nur, wenn alle Salden ausgeglichen sind.`,
            'Archivieren'
          );
          if (!ok) return;
          try {
            await api(`/api/groups/${group.id}/archive`, { method: 'POST' });
            ctx.state.groups = []; // Gruppen-Cache verwerfen
            ctx.refresh();
          } catch (err) {
            openPanel((closeNotice) =>
              el(
                'div',
                {},
                el('p', { className: 'panel-message' }, err.message),
                el(
                  'div',
                  { className: 'panel-actions' },
                  el('button', { className: 'button', type: 'button', onClick: () => closeNotice() }, 'OK')
                )
              )
            );
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Gruppe archivieren'),
      el(
        'div',
        { className: 'field' },
        el('label', { className: 'field-label', for: 'archive-group' }, 'Gruppe'),
        el('span', { className: 'select-wrap' }, select, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')),
        error
      ),
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Archivieren')
      )
    );
  });
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
