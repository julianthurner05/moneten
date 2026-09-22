// Einstieg: Anmeldezustand klären, Gruppen-Workspace, Hash-Routing.

import { api } from './api.js';
import { swapView } from './dom.js';
import { renderHeader } from './header.js';
import { renderLogin, renderPasswordChange, renderSetup } from './views/auth.js';
import { renderGroups } from './views/groups.js';
import { renderGroupDetail } from './views/groupDetail.js';
import { renderEinzug } from './views/einzug.js';
import { renderMonth } from './views/month.js';
import { renderMonthOverview } from './views/monthOverview.js';
import { renderMonthSettings } from './views/monthSettings.js';
import { renderAccount } from './views/account.js';
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
    // Das Thema hängt am Modus: Privat ist dunkel, alles andere hell.
    const privat = active === 'monat' || active === 'konto';
    document.documentElement.dataset.theme = state.user && privat ? 'dark' : 'light';
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

  // Gruppenliste nur laden, wenn sie fehlt oder die Route sie frisch braucht –
  // sonst hängt an jedem Seitenwechsel ein zusätzlicher Request.
  const ensureGroups = async (force = false) => {
    if (!force && state.groups.length > 0) return;
    await loadGroupsData();
  };

  try {
    if (parts[0] === 'gruppen' && parts[1]) {
      await ensureGroups(true);
      selectGroup(parts[1]);
      await renderGroupDetail(ctx, parts[1]);
    } else if (parts[0] === 'gruppen') {
      await ensureGroups(true);
      renderGroups(ctx, { groups: state.groups, totalBalanceCents: state.totalBalanceCents });
    } else if (parts[0] === 'einzug') {
      await ensureGroups();
      if (state.selectedGroupId) {
        await renderEinzug(ctx, state.selectedGroupId);
      } else {
        ctx.navigate('#/gruppen');
      }
    } else if (parts[0] === 'konto' || parts[0] === 'monat') {
      // Privat-Modus braucht die Gruppenliste nicht – höchstens im Hintergrund
      // vorladen, damit der Rückweg sofort da ist.
      if (state.groups.length === 0) loadGroupsData().catch(() => {});
      if (parts[0] === 'konto' && parts[1] === 'passwort') {
        renderPasswordChange(ctx, { forced: false });
      } else if (parts[0] === 'konto') {
        // Konto/Adminbereich gibt es vorerst nur für Admins.
        if (state.user.isAdmin) {
          await renderAccount(ctx);
        } else {
          await renderMonth(ctx, null);
        }
      } else if (parts[1] === 'uebersicht') {
        await renderMonthOverview(ctx);
      } else if (parts[1] === 'einstellungen') {
        await renderMonthSettings(ctx);
      } else if (isMonthString(parts[1])) {
        await renderMonth(ctx, parts[1]);
      } else {
        await renderMonth(ctx, null);
      }
    } else {
      await ensureGroups();
      if (state.selectedGroupId) {
        await renderGroupDetail(ctx, state.selectedGroupId);
      } else {
        renderGroups(ctx, { groups: state.groups, totalBalanceCents: state.totalBalanceCents });
      }
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

// Ladebildschirm: Wortmarke mit Ladebalken, füllt sich, wenn die App bereit ist.
const loader = document.getElementById('loader');
const startLoader = () => {
  const fill = loader.querySelector('.loader-fill');
  let progress = 0;
  let target = 88;
  const tick = () => {
    progress += (target - progress) * 0.035;
    if (target === 100 && progress > 99.4) progress = 100;
    fill.style.width = `${progress}%`;
    if (progress < 100) {
      requestAnimationFrame(tick);
    } else {
      loader.classList.add('is-done');
      setTimeout(() => loader.remove(), 500);
    }
  };
  requestAnimationFrame(tick);
  return () => {
    target = 100;
  };
};
const finishLoader = startLoader();

window.addEventListener('hashchange', handleRoute);
handleRoute().finally(finishLoader);
