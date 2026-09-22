// Gruppendetail: Salden, Ausgleichsvorschläge, Ausgaben und Zahlungen mit Monatsfilter.

import { api } from '../api.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { formatDate, formatEuro, formatMonth, monthOf } from '../format.js';
import { openExpenseForm } from './expenseForm.js';
import { openSettlementForm } from './settlementForm.js';

const filterState = { groupId: null, month: 'all' };

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
    filterState.month = 'all';
  }
  ctx.show('gruppe', () => build(ctx, data));
}

function build(ctx, data) {
  const { group, members, expenses, settlements, suggestions } = data;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';

  const entries = [
    // Einzugs-Ausgaben laufen gesondert im Einzug-Bereich.
    ...expenses.filter((e) => !e.isEinzug).map((e) => ({ type: 'expense', date: e.spentOn, data: e })),
    ...settlements.map((s) => ({ type: 'settlement', date: s.settledOn, data: s })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const months = [...new Set(entries.map((entry) => monthOf(entry.date)))];
  if (!months.includes(filterState.month) && filterState.month !== 'all') {
    filterState.month = 'all';
  }
  const filtered =
    filterState.month === 'all' ? entries : entries.filter((entry) => monthOf(entry.date) === filterState.month);

  const monthSelect = el(
    'select',
    {
      'aria-label': 'Monat filtern',
      onChange: (event) => {
        filterState.month = event.target.value;
        ctx.refresh();
      },
    },
    el('option', { value: 'all', selected: filterState.month === 'all' }, 'Alle Monate'),
    months.map((month) =>
      el('option', { value: month, selected: filterState.month === month }, formatMonth(month))
    )
  );

  const toolbar = el(
    'div',
    { className: 'toolbar' },
    el('span', { className: 'select-wrap' }, monthSelect, el('span', { className: 'select-arrow', 'aria-hidden': 'true' }, '▾')),
    el('div', { className: 'toolbar-spacer' }),
    group.archived
      ? null
      : [
          el(
            'button',
            {
              className: 'button',
              type: 'button',
              onClick: () => openExpenseForm(ctx, group, members, null, { myCategories: data.myCategories }),
            },
            '+ Ausgabe'
          ),
          el(
            'button',
            {
              className: 'button',
              type: 'button',
              onClick: () => openSettlementForm(ctx, group, members, null),
            },
            '+ Ausgleich'
          ),
        ]
  );

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
      el('div', { className: 'month-title' }, group.name)
    ),
    toolbar
  );

  const balanceFoot = (cents) => (cents > 0 ? 'bekommt' : cents < 0 ? 'schuldet' : 'ausgeglichen');

  const balances = el(
    'div',
    { className: 'card-grid card-grid-small', 'data-stagger': '' },
    members.map((member) =>
      el(
        'div',
        { className: 'card card-static' },
        el('div', { className: 'card-meta' }, el('span', {}, member.displayName)),
        el('div', { className: 'card-amount card-amount-small' }, formatEuro(member.balanceCents)),
        el('div', { className: 'card-foot' }, balanceFoot(member.balanceCents))
      )
    )
  );

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

  const suggestionRows =
    suggestions.length === 0 || group.archived
      ? null
      : el(
          'div',
          { className: 'row-list', 'data-stagger': '' },
          suggestions.map((suggestion) =>
            el(
              'div',
              { className: 'row' },
              el(
                'div',
                { className: 'row-main' },
                el('div', { className: 'row-label' }, 'Ausgleichsvorschlag'),
                el('div', { className: 'row-title' }, `${name(suggestion.fromUser)} zahlt an ${name(suggestion.toUser)}`)
              ),
              el(
                'div',
                { className: 'row-side' },
                el('div', { className: 'row-amount' }, formatEuro(suggestion.amountCents)),
                el(
                  'button',
                  {
                    className: 'button',
                    type: 'button',
                    onClick: () =>
                      openSettlementForm(ctx, group, members, {
                        fromUser: suggestion.fromUser,
                        toUser: suggestion.toUser,
                        amountCents: suggestion.amountCents,
                      }),
                  },
                  'Eintragen'
                )
              )
            )
          )
        );

  let entryList;
  if (filtered.length === 0) {
    entryList = el('p', { className: 'empty-note' }, 'Keine Einträge.');
  } else {
    entryList = el(
      'div',
      { className: 'row-list', 'data-stagger': '' },
      filtered.map((entry) => {
        if (entry.type === 'expense') {
          const expense = entry.data;
          const row = el(
            group.archived ? 'div' : 'button',
            group.archived ? { className: 'row' } : {
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
          return row;
        }
        const settlement = entry.data;
        const canConfirm = !settlement.confirmed && settlement.toUser === ctx.state.user.id && !group.archived;
        return el(
          'div',
          { className: 'row' },
          el(
            'div',
            { className: 'row-main' },
            el(
              'div',
              { className: 'row-label' },
              `${formatDate(settlement.settledOn)} · Ausgleich${settlement.confirmed ? '' : ' · Wartet auf Bestätigung'}`
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

  return el('div', { className: 'view' }, head, balances, manageBar, suggestionRows, entryList);
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
