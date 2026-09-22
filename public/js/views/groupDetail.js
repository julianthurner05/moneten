// Gruppen-Ansicht: monatsgebundenes Saldo groß und mittig, darunter die Liste.

import { api } from '../api.js';
import { dateChip, monthSwitch, suggestFromBalances } from '../controls.js';
import { el, openPanel } from '../dom.js';
import { buildFab } from '../fab.js';
import { currentMonth, formatEuro, monthOf } from '../format.js';
import { openExpenseForm } from './expenseForm.js';
import { openSettlementForm } from './settlementForm.js';

const filterState = { groupId: null, month: null };

function noticePanel(message) {
  openPanel((close) =>
    el(
      'div',
      {},
      el('p', { className: 'panel-message' }, message),
      el('div', { className: 'panel-actions' }, el('button', { className: 'button', type: 'button', onClick: () => close() }, 'OK'))
    )
  );
}

export async function renderGroupDetail(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}`);
  if (filterState.groupId !== groupId) {
    filterState.groupId = groupId;
    filterState.month = currentMonth();
  }
  ctx.show('gruppe', () => build(ctx, data));
}

/** Salden nur aus den Einträgen eines Monats (bestätigte Begleichungen). */
function monthBalances(members, expenses, settlements, month) {
  const balances = new Map(members.map((m) => [m.id, 0]));
  const add = (id, cents) => balances.set(id, (balances.get(id) ?? 0) + cents);
  for (const e of expenses) {
    if (e.isEinzug || monthOf(e.spentOn) !== month) continue;
    add(e.paidBy, e.amountCents);
    for (const s of e.shares) add(s.userId, -s.shareCents);
  }
  for (const s of settlements) {
    if (!s.confirmed || monthOf(s.settledOn) !== month) continue;
    add(s.fromUser, s.amountCents);
    add(s.toUser, -s.amountCents);
  }
  return balances;
}

function build(ctx, data) {
  const { group, members, expenses, settlements, suggestions } = data;
  const me = ctx.state.user.id;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';

  const month = filterState.month ?? currentMonth();
  const balances = monthBalances(members, expenses, settlements, month);
  const myBalance = balances.get(me) ?? 0;
  const monthSuggestions = suggestFromBalances(balances).filter((s) => s.fromUser === me || s.toUser === me);
  const mySuggestions = suggestions.filter((s) => s.fromUser === me || s.toUser === me);

  const entries = [
    ...expenses.filter((e) => !e.isEinzug).map((e) => ({ type: 'expense', date: e.spentOn, data: e })),
    ...settlements.map((s) => ({ type: 'settlement', date: s.settledOn, data: s })),
  ]
    .filter((entry) => monthOf(entry.date) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Monatsumschalter und Saldo mittig; die Details klappen darunter auf.
  const balanceClass = myBalance > 0 ? ' is-positive' : myBalance < 0 ? ' is-negative' : '';
  const details = el(
    'div',
    { className: 'hero-details' },
    monthSuggestions.length === 0
      ? el('div', { className: 'hero-detail-row' }, el('span', {}, 'In diesem Monat ist alles ausgeglichen.'))
      : monthSuggestions.map((s) =>
          el(
            'div',
            { className: 'hero-detail-row' },
            el(
              'span',
              {},
              s.toUser === me ? `${name(s.fromUser)} schuldet dir` : `Du schuldest ${name(s.toUser)}`
            ),
            el(
              'span',
              { className: `row-amount${s.toUser === me ? ' is-positive' : ' is-negative'}` },
              formatEuro(s.amountCents)
            )
          )
        )
  );
  details.style.display = 'none';

  const toggleDetails = () => {
    const open = details.style.display === 'none';
    for (const button of [infoButton, detailsButton]) {
      button.setAttribute('aria-expanded', String(open));
      button.classList.toggle('is-active', open);
    }
    if (open) {
      details.style.display = '';
      requestAnimationFrame(() => requestAnimationFrame(() => details.classList.add('is-open')));
    } else {
      details.classList.remove('is-open');
      details.addEventListener(
        'transitionend',
        () => {
          if (!details.classList.contains('is-open')) details.style.display = 'none';
        },
        { once: true }
      );
    }
  };

  const infoButton = el(
    'button',
    { className: 'info-button', type: 'button', 'aria-label': 'Wer schuldet wem?', 'aria-expanded': 'false', onClick: toggleDetails },
    'i'
  );
  // Am Handy sitzt statt des i ein kleiner Details-Knopf unter dem Saldo.
  const detailsButton = el(
    'button',
    { className: 'details-button', type: 'button', 'aria-expanded': 'false', onClick: toggleDetails },
    'Details'
  );

  const hero = el(
    'div',
    { className: 'hero hero-centered' },
    monthSwitch(month, (m) => {
      filterState.month = m;
      ctx.refresh();
    }),
    el(
      'div',
      { className: 'hero-row' },
      el('div', { className: `hero-value${balanceClass}` }, formatEuro(myBalance)),
      infoButton
    ),
    detailsButton,
    details,
    group.archived ? el('div', { className: 'detail-meta' }, el('span', {}, 'Archiviert')) : null
  );

  let entryList;
  if (entries.length === 0) {
    entryList = el('p', { className: 'empty-note' }, 'Keine Einträge in diesem Monat.');
  } else {
    entryList = el(
      'div',
      { className: 'row-list', 'data-stagger': '' },
      entries.map((entry) => {
        if (entry.type === 'expense') {
          const expense = entry.data;
          return el(
            group.archived ? 'div' : 'button',
            group.archived
              ? { className: 'row' }
              : {
                  className: 'row row-clickable',
                  type: 'button',
                  onClick: () => openExpenseForm(ctx, group, members, expense, { myCategories: data.myCategories }),
                },
            dateChip(expense.spentOn),
            el(
              'div',
              { className: 'row-main' },
              el('div', { className: 'row-title' }, expense.description),
              el('div', { className: 'row-label' }, `Bezahlt von ${name(expense.paidBy)}`)
            ),
            el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(expense.amountCents)))
          );
        }
        const settlement = entry.data;
        const canConfirm = !settlement.confirmed && settlement.toUser === me && !group.archived;
        return el(
          'div',
          { className: 'row row-settle' },
          dateChip(settlement.settledOn),
          el(
            'div',
            { className: 'row-main settle-main' },
            el(
              'div',
              { className: 'settle-flow' },
              el('span', {}, name(settlement.fromUser)),
              el('span', { className: 'settle-arrow', 'aria-hidden': 'true' }),
              el('span', {}, name(settlement.toUser))
            ),
            settlement.confirmed ? null : el('div', { className: 'row-label' }, 'Wartet auf Bestätigung')
          ),
          el(
            'div',
            { className: 'row-side' },
            el('div', { className: 'row-amount' }, formatEuro(settlement.amountCents)),
            canConfirm
              ? el(
                  'button',
                  {
                    className: 'button',
                    type: 'button',
                    onClick: async () => {
                      try {
                        await api(`/api/groups/${group.id}/settlements/${settlement.id}/confirm`, { method: 'POST' });
                        ctx.refresh();
                      } catch (err) {
                        noticePanel(err.message);
                      }
                    },
                  },
                  'Erhalten'
                )
              : null
          )
        );
      })
    );
  }

  // Zum Monatsende erinnert ein roter Zähler am Plus an offene Begleichungen.
  const monthEnd = Number(new Date().getDate()) >= 25;
  const reminder = monthEnd && !group.archived ? mySuggestions.length : 0;
  const fab = group.archived
    ? null
    : buildFab(
        [
          {
            label: 'Ausgabe',
            onClick: () => openExpenseForm(ctx, group, members, null, { myCategories: data.myCategories }),
          },
          {
            label: 'Begleichung',
            badge: reminder,
            onClick: () => openSettlementForm(ctx, group, members, { suggestions: mySuggestions, me }),
          },
          {
            label: 'Mitglied',
            onClick: () => openAddMember(ctx, group, members),
          },
        ],
        { badge: reminder }
      );

  return el('div', { className: 'view' }, hero, entryList, fab);
}

async function openAddMember(ctx, group, members) {
  const { users } = await api('/api/users');
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = users.filter((user) => !memberIds.has(user.id));
  if (candidates.length === 0) {
    noticePanel('Alle Accounts sind schon Mitglied.');
    return;
  }
  openPanel((close) => {
    const select = el(
      'select',
      { id: 'add-member' },
      candidates.map((user) => el('option', { value: user.id }, user.displayName))
    );
    const error = el('p', { className: 'form-error', role: 'alert' });
    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          try {
            await api(`/api/groups/${group.id}/members`, { method: 'POST', body: { userId: select.value } });
            close();
            ctx.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.classList.add('is-visible');
          }
        },
      },
      el('h2', { className: 'panel-title' }, 'Mitglied hinzufügen'),
      el(
        'div',
        { className: 'field' },
        el('label', { className: 'field-label', for: 'add-member' }, 'Account'),
        el('span', { className: 'select-wrap' }, select, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾'))
      ),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Hinzufügen')
      )
    );
  });
}
