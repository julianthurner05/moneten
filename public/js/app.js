// Einstieg: Anmeldezustand klären, Gruppen-Workspace, Hash-Routing.

import { api } from './api.js';
import { swapView } from './dom.js';
import { renderHeader } from './header.js';
import { renderLogin, renderPasswordChange, renderSetup } from './views/auth.js';
import { renderAccount } from './views/account.js';
import { renderGroups } from './views/groups.js';
import { renderGroupDetail } from './views/groupDetail.js';
import { renderEinzug } from './views/einzug.js';
import { renderMonth } from './views/month.js';
import { renderMonthSettings } from './views/monthSettings.js';
import { isMonthString } from './format.js';

const main = document.getElementById('app');
const GROUP_KEY = 'moneten_group';

const state = {
  user: null,
  groups: [],
  selectedGroupId: null,
  totalBalanceCents: 0,
};

function selectedGroup() {
  return state.groups.find((g) => g.id === state.selectedGroupId) ?? null;
}

function selectGroup(groupId) {
  state.selectedGroupId = groupId;
  try {
    localStorage.setItem(GROUP_KEY, groupId ?? '');
  } catch {
    // localStorage nicht verfügbar
  }
}

const ctx = {
  state,
  selectedGroup,
  selectGroup,
  show(active, build) {
    renderHeader({
      user: state.user,
      active,
      groups: state.groups,
      selectedGroup: selectedGroup(),
    });
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
    ctx.navigate('#/');
  },
  onLogout() {
    state.user = null;
    state.groups = [];
    state.totalBalanceCents = 0;
    ctx.navigate('#/login');
  },
};

async function loadGroupsData() {
  const data = await api('/api/groups');
  state.groups = data.groups;
  state.totalBalanceCents = data.totalBalanceCents;

  // Gewählte Gruppe prüfen bzw. sinnvoll vorbelegen (WG zuerst).
  let stored = null;
  try {
    stored = localStorage.getItem(GROUP_KEY);
  } catch {
    // localStorage nicht verfügbar
  }
  const active = data.groups.filter((g) => !g.archived);
  const valid = (id) => data.groups.some((g) => g.id === id);
  if (stored && valid(stored)) {
    state.selectedGroupId = stored;
  } else if (!valid(state.selectedGroupId)) {
    const wg = active.find((g) => g.kind === 'wg');
    state.selectedGroupId = (wg ?? active[0] ?? data.groups[0])?.id ?? null;
  }
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
      selectGroup(parts[1]);
      await renderGroupDetail(ctx, parts[1]);
    } else if (parts[0] === 'gruppen') {
      renderGroups(ctx, { groups: state.groups, totalBalanceCents: state.totalBalanceCents });
    } else if (parts[0] === 'einzug') {
      if (state.selectedGroupId) {
        await renderEinzug(ctx, state.selectedGroupId);
      } else {
        ctx.navigate('#/gruppen');
      }
    } else if (parts[0] === 'konto' && parts[1] === 'passwort') {
      renderPasswordChange(ctx, { forced: false });
    } else if (parts[0] === 'konto') {
      await renderAccount(ctx);
    } else if (parts[0] === 'monat' && parts[1] === 'einstellungen') {
      await renderMonthSettings(ctx);
    } else if (parts[0] === 'monat' && isMonthString(parts[1])) {
      await renderMonth(ctx, parts[1]);
    } else if (parts[0] === 'monat') {
      await renderMonth(ctx, null);
    } else if (state.selectedGroupId) {
      // Startansicht: die gewählte Gruppe.
      await renderGroupDetail(ctx, state.selectedGroupId);
    } else {
      renderGroups(ctx, { groups: state.groups, totalBalanceCents: state.totalBalanceCents });
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
