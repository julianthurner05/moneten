// Gruppen-Ansicht: eigener Saldo zuerst, Monatsliste darunter, Plus-Button für Aktionen.

import { api } from '../api.js';
import { monthSwitch } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { buildFab } from '../fab.js';
import { currentMonth, formatDate, formatEuro, monthOf } from '../format.js';
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

function build(ctx, data) {
  const { group, members, expenses, settlements, suggestions } = data;
  const me = ctx.state.user.id;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';
  const myBalance = members.find((m) => m.id === me)?.balanceCents ?? 0;
  const mySuggestions = suggestions.filter((s) => s.fromUser === me || s.toUser === me);

  const month = filterState.month ?? currentMonth();
  const entries = [
    ...expenses.filter((e) => !e.isEinzug).map((e) => ({ type: 'expense', date: e.spentOn, data: e })),
    ...settlements.map((s) => ({ type: 'settlement', date: s.settledOn, data: s })),
  ]
    .filter((entry) => monthOf(entry.date) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const head = el(
    'div',
    { className: 'section-head' },
    el(
      'div',
      {},
      el(
        'div',
        { className: 'detail-meta' },
        el('span', {}, group.kind === 'wg' ? 'WG' : 'Standard'),
        el('span', {}, members.length === 1 ? '1 Mitglied' : `${members.length} Mitglieder`),
        group.archived ? el('span', {}, 'Archiviert') : null
      ),
      monthSwitch(month, (m) => {
        filterState.month = m;
        ctx.refresh();
      })
    )
  );

  // Eigener Saldo als Erstes, farblich passend zum Stand.
  const balanceClass = myBalance > 0 ? ' is-positive' : myBalance < 0 ? ' is-negative' : '';
  const hero = el(
    'div',
    { className: 'hero' },
    el('div', { className: 'hero-label' }, 'Dein Saldo'),
    el(
      'div',
      { className: 'hero-row' },
      el('div', { className: `hero-value${balanceClass}` }, formatEuro(myBalance)),
      el(
        'button',
        {
          className: 'info-button',
          type: 'button',
          'aria-label': 'Wer schuldet wem?',
          onClick: () => openBalanceInfo(ctx, name, myBalance, mySuggestions),
        },
        'i'
      )
    ),
    el(
      'div',
      { className: 'hero-foot' },
      myBalance > 0 ? 'bekommst du insgesamt' : myBalance < 0 ? 'schuldest du insgesamt' : 'alles ausgeglichen'
    )
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
            el(
              'div',
              { className: 'row-main' },
              el('div', { className: 'row-label' }, `${formatDate(expense.spentOn)} · Bezahlt von ${name(expense.paidBy)}`),
              el('div', { className: 'row-title' }, expense.description)
            ),
            el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(expense.amountCents)))
          );
        }
        const settlement = entry.data;
        const canConfirm = !settlement.confirmed && settlement.toUser === me && !group.archived;
        return el(
          'div',
          { className: 'row' },
          el(
            'div',
            { className: 'row-main' },
            el(
              'div',
              { className: 'row-label' },
              `${formatDate(settlement.settledOn)} · Begleichung${settlement.confirmed ? '' : ' · Wartet auf Bestätigung'}`
            ),
            el('div', { className: 'row-title' }, `${name(settlement.fromUser)} an ${name(settlement.toUser)}`)
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

  const manageBar = group.archived
    ? null
    : el(
        'div',
        { className: 'toolbar toolbar-sub' },
        el('button', { className: 'textlink', type: 'button', onClick: () => openAddMember(ctx, group, members) }, '+ Mitglied'),
        el(
          'button',
          {
            className: 'textlink',
            type: 'button',
            onClick: async () => {
              const ok = await confirmPanel('Gruppe archivieren? Das geht nur, wenn alle Salden ausgeglichen sind.', 'Archivieren');
              if (!ok) return;
              try {
                await api(`/api/groups/${group.id}/archive`, { method: 'POST' });
                ctx.refresh();
              } catch (err) {
                noticePanel(err.message);
              }
            },
          },
          'Gruppe archivieren'
        )
      );

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
        ],
        { badge: reminder }
      );

  return el('div', { className: 'view' }, head, hero, entryList, manageBar, fab);
}

function openBalanceInfo(ctx, name, myBalance, mySuggestions) {
  openPanel((close) =>
    el(
      'div',
      {},
      el('h2', { className: 'panel-title' }, 'Dein Saldo im Detail'),
      mySuggestions.length === 0
        ? el('p', { className: 'panel-message' }, 'Alles ausgeglichen – niemand schuldet niemandem etwas.')
        : el(
            'div',
            { className: 'row-list' },
            mySuggestions.map((s) =>
              el(
                'div',
                { className: 'row' },
                el(
                  'div',
                  { className: 'row-main' },
                  el(
                    'div',
                    { className: 'row-title' },
                    s.toUser === ctx.state.user.id ? `${name(s.fromUser)} schuldet dir` : `Du schuldest ${name(s.toUser)}`
                  )
                ),
                el(
                  'div',
                  { className: 'row-side' },
                  el(
                    'div',
                    { className: `row-amount${s.toUser === ctx.state.user.id ? ' is-positive' : ' is-negative'}` },
                    formatEuro(s.amountCents)
                  )
                )
              )
            )
          ),
      el('div', { className: 'panel-actions' }, el('button', { className: 'button', type: 'button', onClick: () => close() }, 'OK'))
    )
  );
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
