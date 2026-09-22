// Einstieg: Anmeldezustand klären, Hash-Routing, Kopfzeile aktuell halten.

import { api } from './api.js';
import { swapView } from './dom.js';
import { renderHeader } from './header.js';
import { renderLogin, renderPasswordChange, renderSetup } from './views/auth.js';
import { renderAccount } from './views/account.js';
import { renderGroups } from './views/groups.js';
import { renderGroupDetail } from './views/groupDetail.js';

const main = document.getElementById('app');

const state = {
  user: null,
  groupCount: 0,
  totalBalanceCents: 0,
};

const ctx = {
  state,
  show(active, build) {
    renderHeader({ user: state.user, active, groupCount: state.groupCount, totalBalanceCents: state.totalBalanceCents });
    swapView(main, build);
  },
  navigate(hash) {
    if (location.hash === hash) {
      handleRoute();
    } else {
      location.hash = hash;
    }
  },
  refresh: () => handleRoute(),
  onLogin(user) {
    state.user = user;
    ctx.navigate('#/gruppen');
  },
  onLogout() {
    state.user = null;
    state.groupCount = 0;
    state.totalBalanceCents = 0;
    ctx.navigate('#/login');
  },
};

async function loadGroupsData() {
  const data = await api('/api/groups');
  state.groupCount = data.groups.filter((g) => !g.archived).length;
  state.totalBalanceCents = data.totalBalanceCents;
  return data;
}

async function handleRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (!state.user) {
    const setup = await api('/api/setup');
    if (setup.needed) {
      renderSetup(ctx);
      return;
    }
    try {
      const me = await api('/api/me');
      state.user = me.user;
    } catch {
      renderLogin(ctx);
      return;
    }
  }

  if (state.user.mustChangePassword) {
    renderPasswordChange(ctx, { forced: true });
    return;
  }

  try {
    if (parts[0] === 'gruppen' && parts[1]) {
      await loadGroupsData();
      await renderGroupDetail(ctx, parts[1]);
      return;
    }
    if (parts[0] === 'konto' && parts[1] === 'passwort') {
      await loadGroupsData();
      renderPasswordChange(ctx, { forced: false });
      return;
    }
    if (parts[0] === 'konto') {
      await loadGroupsData();
      await renderAccount(ctx);
      return;
    }
    const data = await loadGroupsData();
    renderGroups(ctx, data);
  } catch (err) {
    if (err.status === 401) {
      state.user = null;
      renderLogin(ctx);
      return;
    }
    throw err;
  }
}

// Eingabeart merken: Fokus-Outline nur bei Tastaturbedienung zeigen,
// Klick oder Autofokus verändern nichts Sichtbares.
document.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Tab') document.documentElement.dataset.input = 'keyboard';
  },
  true
);
document.addEventListener(
  'pointerdown',
  () => {
    document.documentElement.dataset.input = 'pointer';
  },
  true
);

window.addEventListener('hashchange', handleRoute);
handleRoute();
