// Einstieg: Anmeldezustand klären, Gruppen-Workspace, Hash-Routing.

import { api } from './api.js';
import { swapView } from './dom.js';
import { renderHeader } from './header.js';
import { renderLogin, renderPasswordChange, renderSetup } from './views/auth.js';
import { renderGroups } from './views/groups.js';
import { renderGroupDetail } from './views/groupDetail.js';
import { renderEinzug } from './views/einzug.js';
import { renderEinkauf } from './views/einkauf.js';
import { renderPutzplan } from './views/putzplan.js';
import { renderMonth } from './views/month.js';
import { renderMonthOverview } from './views/monthOverview.js';
import { renderMonthSettings } from './views/monthSettings.js';
import { renderAccount } from './views/account.js';
import { isMonthString } from './format.js';
import { restorePush } from './push.js';

const main = document.getElementById('app');
const GROUP_KEY = 'moneten_group';

const state = {
  user: null,
  groups: [],
  selectedGroupId: null,
  totalBalanceCents: 0,
};

// Roter Zähler am App-Icon: Summe aller roten Tab-Zahlen plus offene eigene
// Putz-Durchgänge. Der Service Worker zählt bei Mitteilungen denselben
// (in IndexedDB gemerkten) Zähler hoch; hier wird er auf die echte Summe gesetzt.
function updateAppBadge() {
  if (!('setAppBadge' in navigator)) return;
  let total = 0;
  for (const group of state.groups) {
    if (group.archived) continue;
    const tabs = group.tabNew ?? {};
    total += (tabs.gruppe ?? 0) + (tabs.einzug ?? 0) + (tabs.einkauf ?? 0) + (group.myCleaningCount ?? 0);
  }
  try {
    const request = indexedDB.open('moneten-badge', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => {
      request.result.transaction('kv', 'readwrite').objectStore('kv').put(total, 'count');
    };
  } catch {
    // Ohne gemerkten Zähler zählt der Service Worker ab 0 weiter
  }
  if (total > 0) navigator.setAppBadge(total).catch(() => {});
  else navigator.clearAppBadge?.().catch(() => {});
}

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
    // Der eigene Tab gilt beim Anzeigen als gesehen – Zähler sofort weg.
    const group = selectedGroup();
    if (group?.tabNew && active in group.tabNew && group.tabNew[active] > 0) {
      group.tabNew[active] = 0;
      updateAppBadge();
    }

    // Dieselbe Ansicht nach einer Aktion oder Auto-Aktualisierung: in einem
    // Zug ersetzen statt sichtbar aus- und einzublenden.
    const soft = softNext && active === lastActive;
    const changed = lastActive !== null && active !== lastActive;
    lastActive = active;
    softNext = false;

    const apply = () => {
      // Das Thema hängt am Modus: Privat ist dunkel, alles andere hell.
      const privat = active === 'monat' || active === 'konto' || active === 'passwort';
      document.documentElement.dataset.theme = state.user && privat ? 'dark' : 'light';
      renderHeader({
        user: state.user,
        active,
        groups: state.groups,
        selectedGroup: selectedGroup(),
      });
      swapView(main, build, soft || useTransition);
    };

    // Tab-Wechsel: Browser-View-Transition – die Pill gleitet, der Inhalt
    // blendet weich über (Browser ohne Unterstützung wechseln wie bisher).
    const useTransition =
      changed &&
      !soft &&
      main.childElementCount > 0 &&
      document.visibilityState === 'visible' &&
      typeof document.startViewTransition === 'function';
    if (useTransition) document.startViewTransition(apply);
    else apply();
  },
  navigate(hash) {
    if (location.hash === hash) {
      handleRoute();
    } else {
      location.hash = hash;
    }
  },
  refresh: () => {
    softNext = true;
    return handleRoute();
  },
  setCleaningCount(groupId, count) {
    const group = state.groups.find((g) => g.id === groupId);
    if (group) group.myCleaningCount = count;
    updateAppBadge();
  },
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
  updateAppBadge();

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

let pushRestored = false;
let lastActive = null;
let softNext = false;

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

  if (!pushRestored) {
    pushRestored = true;
    restorePush();
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
      await ensureGroups(true);
      if (state.selectedGroupId) {
        await renderEinzug(ctx, state.selectedGroupId);
      } else {
        ctx.navigate('#/gruppen');
      }
    } else if (parts[0] === 'einkaufsliste') {
      await ensureGroups(true);
      if (state.selectedGroupId) {
        await renderEinkauf(ctx, state.selectedGroupId);
      } else {
        ctx.navigate('#/gruppen');
      }
    } else if (parts[0] === 'putzplan') {
      await ensureGroups(true);
      if (state.selectedGroupId) {
        await renderPutzplan(ctx, state.selectedGroupId);
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
        await renderAccount(ctx);
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


// Auto-Aktualisierung: Wenn die App wieder sichtbar wird und in ruhigem
// Abstand auch zwischendurch wird die aktuelle Ansicht neu geladen – sanft,
// ohne sichtbares Neuzeichnen. Nicht, während getippt wird oder ein Panel
// offen ist.
function autoRefresh() {
  if (!state.user || document.visibilityState !== 'visible') return;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (typing || document.querySelector('.panel-overlay')) return;
  softNext = true;
  handleRoute().catch(() => {
    // Offline oder Server kurz weg: nächster Versuch kommt von selbst.
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  autoRefresh();
});
setInterval(autoRefresh, 30000);

window.addEventListener('hashchange', handleRoute);
handleRoute();
