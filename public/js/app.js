// Einstieg: Anmeldezustand klären, Hash-Routing, Kopfzeile aktuell halten.

import { api } from './api.js';
import { swapView } from './dom.js';
import { renderHeader } from './header.js';
import { renderLogin, renderPasswordChange, renderSetup } from './views/auth.js';
import { renderAccount } from './views/account.js';
import { renderGroups } from './views/groups.js';
import { renderGroupDetail } from './views/groupDetail.js';
import { renderMonth } from './views/month.js';
import { renderMonthSettings } from './views/monthSettings.js';
import { isMonthString } from './format.js';

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
    ctx.navigate('#/monat');
  },
  onLogout() {
    state.user = null;
    state.groupCount = 0;
    state.totalBalanceCents = 0;
    ctx.navigate('#/login');
  },
};

let lastGroups = [];

async function loadGroupsData() {
  const data = await api('/api/groups');
  state.groupCount = data.groups.filter((g) => !g.archived).length;
  state.totalBalanceCents = data.totalBalanceCents;
  lastGroups = data.groups;
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
    await loadGroupsData();
    if (parts[0] === 'gruppen' && parts[1]) {
      await renderGroupDetail(ctx, parts[1]);
    } else if (parts[0] === 'gruppen') {
      renderGroups(ctx, { groups: lastGroups, totalBalanceCents: state.totalBalanceCents });
    } else if (parts[0] === 'konto' && parts[1] === 'passwort') {
      renderPasswordChange(ctx, { forced: false });
    } else if (parts[0] === 'konto') {
      await renderAccount(ctx);
    } else if (parts[0] === 'monat' && parts[1] === 'einstellungen') {
      await renderMonthSettings(ctx);
    } else if (parts[0] === 'monat' && isMonthString(parts[1])) {
      await renderMonth(ctx, parts[1]);
    } else {
      await renderMonth(ctx, null);
    }
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
