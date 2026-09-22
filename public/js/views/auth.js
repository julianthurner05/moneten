// Setup, Login und Passwort ändern.

import { api } from '../api.js';
import { el } from '../dom.js';

function field(label, input) {
  return el('div', { className: 'field' }, el('label', { className: 'field-label', for: input.id }, label), input);
}

function errorLine() {
  return el('p', { className: 'form-error', role: 'alert' });
}

function showError(node, message) {
  node.textContent = message;
  node.classList.add('is-visible');
}

export function renderSetup(ctx) {
  ctx.show(null, () => {
    const username = el('input', { id: 'setup-username', type: 'text', autocomplete: 'username', autocapitalize: 'none', required: true });
    const displayName = el('input', { id: 'setup-displayname', type: 'text', autocomplete: 'name', required: true });
    const password = el('input', { id: 'setup-password', type: 'password', autocomplete: 'new-password', required: true });
    const error = errorLine();

    const form = el(
      'form',
      {
        className: 'auth-form',
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            const result = await api('/api/setup', {
              method: 'POST',
              body: { username: username.value, displayName: displayName.value, password: password.value },
            });
            ctx.onLogin(result.user);
          } catch (err) {
            showError(error, err.message);
          }
        },
      },
      el('h1', { className: 'auth-title' }, 'Einrichtung'),
      field('Benutzername', username),
      field('Anzeigename', displayName),
      field('Passwort', password),
      error,
      el('button', { className: 'button', type: 'submit' }, 'Admin-Account anlegen')
    );
    return el(
      'div',
      { className: 'auth-wrap', 'data-stagger': '' },
      el('div', { className: 'auth-wordmark' }, 'moneten'),
      form
    );
  });
}

export function renderLogin(ctx) {
  ctx.show(null, () => {
    const username = el('input', { id: 'login-username', type: 'text', autocomplete: 'username', autocapitalize: 'none', required: true });
    const password = el('input', { id: 'login-password', type: 'password', autocomplete: 'current-password', required: true });
    const error = errorLine();

    const form = el(
      'form',
      {
        className: 'auth-form',
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            const result = await api('/api/login', {
              method: 'POST',
              body: { username: username.value, password: password.value },
            });
            ctx.onLogin(result.user);
          } catch (err) {
            showError(error, err.message);
          }
        },
      },
      field('Benutzername', username),
      field('Passwort', password),
      error,
      el('button', { className: 'button', type: 'submit' }, 'Anmelden')
    );
    return el(
      'div',
      { className: 'auth-wrap', 'data-stagger': '' },
      el('div', { className: 'auth-wordmark' }, 'moneten'),
      form
    );
  });
}

export function renderPasswordChange(ctx, { forced = false } = {}) {
  ctx.show(forced ? null : 'konto', () => {
    const current = el('input', { id: 'pw-current', type: 'password', autocomplete: 'current-password', required: true });
    const next = el('input', { id: 'pw-next', type: 'password', autocomplete: 'new-password', required: true });
    const error = errorLine();

    const form = el(
      'form',
      {
        className: 'auth-form',
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            await api('/api/password', {
              method: 'POST',
              body: { currentPassword: current.value, newPassword: next.value },
            });
            ctx.state.user.mustChangePassword = false;
            ctx.navigate(forced ? '#/gruppen' : '#/konto');
          } catch (err) {
            showError(error, err.message);
          }
        },
      },
      el('h1', { className: 'auth-title' }, 'Passwort ändern'),
      field('Aktuelles Passwort', current),
      field('Neues Passwort', next),
      error,
      el('button', { className: 'button', type: 'submit' }, 'Passwort ändern')
    );
    return el(
      'div',
      { className: 'auth-wrap', 'data-stagger': '' },
      el('div', { className: 'auth-wordmark' }, 'moneten'),
      form
    );
  });
}
