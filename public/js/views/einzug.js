// Einzug-Bereich einer WG-Gruppe: gemeinsame Einzugs-Ausgaben plus privater Bereich.

import { api } from '../api.js';
import { createDatePicker, dateChip, suggestFromBalances } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { buildFab } from '../fab.js';
import { centsToInput, formatDate, formatEuro, parseEuroInput, todayIso } from '../format.js';
import { openExpenseForm } from './expenseForm.js';
import { openSettlementForm } from './settlementForm.js';
import { settlementRow } from './settlementRow.js';

export async function renderEinzug(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}`);
  ctx.show('einzug', () => build(ctx, data));
}

function build(ctx, data) {
  const { group, members, einzugPersonal } = data;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';
  // Kaution läuft gesondert: fest vermerkt, zählt nicht zu den Einzugskosten.
  const deposits = data.expenses.filter((e) => e.isEinzug && e.isDeposit);
  const shared = data.expenses.filter((e) => e.isEinzug && !e.isDeposit);
  const sharedSum = shared.reduce((sum, e) => sum + e.amountCents, 0);
  const mySharedSum = shared.reduce(
    (sum, e) => sum + (e.shares.find((s) => s.userId === ctx.state.user.id)?.shareCents ?? 0),
    0
  );
  const privateSum = einzugPersonal.reduce((sum, item) => sum + item.amountCents, 0);

  // Kleines Einzug-Saldo: gemeinsame Ausgaben (ohne Kaution) plus bestätigte Begleichungen.
  const me = ctx.state.user.id;
  const einzugSettlements = data.settlements.filter((s) => s.isEinzug);
  const balances = new Map(members.map((m) => [m.id, 0]));
  const addBalance = (id, cents) => balances.set(id, (balances.get(id) ?? 0) + cents);
  for (const e of shared) {
    addBalance(e.paidBy, e.amountCents);
    for (const s of e.shares) addBalance(s.userId, -s.shareCents);
  }
  for (const s of einzugSettlements) {
    if (!s.confirmed) continue;
    addBalance(s.fromUser, s.amountCents);
    addBalance(s.toUser, -s.amountCents);
  }
  const myBalance = balances.get(me) ?? 0;
  const debts = suggestFromBalances(balances).filter((s) => s.fromUser === me || s.toUser === me);

  // Gegenüberstellung als Erstes: gemeinsame und private Einzugskosten.
  const stats = el(
    'div',
    { className: 'stat-grid stat-grid-hero view-top', 'data-stagger': '' },
    el(
      'div',
      { className: 'stat' },
      el('div', { className: 'stat-label' }, 'Gemeinsam – dein Anteil'),
      el('div', { className: 'stat-value' }, formatEuro(mySharedSum))
    ),
    el(
      'div',
      { className: 'stat' },
      el('div', { className: 'stat-label' }, 'Privat'),
      el('div', { className: 'stat-value' }, formatEuro(privateSum))
    )
  );

  const depositRows = deposits.map((expense) => {
    const perPerson = expense.shares[0]?.shareCents ?? Math.round(expense.amountCents / members.length);
    return el(
      'div',
      { className: 'row row-muted' },
      el(
        'div',
        { className: 'row-main' },
        el('div', { className: 'row-title' }, expense.description),
        el('div', { className: 'row-label' }, `${formatEuro(perPerson)} p.\u202fP. · Überwiesen ✓`)
      ),
      el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(expense.amountCents)))
    );
  });

  const sharedEntries = [
    ...shared.map((e) => ({ type: 'expense', date: e.spentOn, data: e })),
    ...einzugSettlements.map((s) => ({ type: 'settlement', date: s.settledOn, data: s })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const sharedList =
    sharedEntries.length === 0 && depositRows.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine gemeinsamen Einzugs-Ausgaben – z. B. Kaution oder Gerätebestellungen.')
      : el(
          'div',
          { className: 'row-list', 'data-stagger': '' },
          sharedEntries.map((entry) => {
            if (entry.type === 'settlement') return settlementRow(ctx, group, members, entry.data, name);
            const expense = entry.data;
            return el(
              group.archived ? 'div' : 'button',
              group.archived
                ? { className: 'row' }
                : {
                    className: 'row row-clickable',
                    type: 'button',
                    onClick: () => openExpenseForm(ctx, group, members, expense, {}),
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
          }),
          depositRows
        );

  const privateList =
    einzugPersonal.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine privaten Einzugskosten – nur du siehst diesen Bereich.')
      : el(
          'div',
          { className: 'row-list', 'data-stagger': '' },
          einzugPersonal.map((item) =>
            el(
              'button',
              {
                className: 'row row-clickable',
                type: 'button',
                onClick: () => openPrivateForm(ctx, group, item),
              },
              dateChip(item.spentOn),
              el('div', { className: 'row-main' }, el('div', { className: 'row-title' }, item.description)),
              el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(item.amountCents)))
            )
          )
        );

  const fab = group.archived
    ? null
    : buildFab([
        { label: 'Gemeinsame Ausgabe', onClick: () => openExpenseForm(ctx, group, members, null, { isEinzug: true }) },
        {
          label: 'Begleichung',
          onClick: () => openSettlementForm(ctx, group, members, { suggestions: debts, me, isEinzug: true }),
        },
        { label: 'Privater Eintrag', onClick: () => openPrivateForm(ctx, group, null) },
      ]);

  // Saldo rechtsbündig in der Gemeinsam-Kopfzeile; die Details klappen über ein kleines i auf.
  const details = el(
    'div',
    { className: 'einzug-details reveal' },
    el(
      'div',
      { className: 'reveal-inner' },
      debts.map((s) =>
        el(
          'div',
          { className: 'einzug-saldo-line' },
          s.toUser === me
            ? `${name(s.fromUser)} schuldet dir ${formatEuro(s.amountCents)}`
            : `Du schuldest ${name(s.toUser)} ${formatEuro(s.amountCents)}`
        )
      )
    )
  );
  const infoButton = el(
    'button',
    {
      className: 'info-button',
      type: 'button',
      'aria-label': 'Wer schuldet wem?',
      'aria-expanded': 'false',
      onClick: () => {
        const open = !details.classList.contains('is-open');
        details.classList.toggle('is-open', open);
        infoButton.setAttribute('aria-expanded', String(open));
        infoButton.classList.toggle('is-active', open);
      },
    },
    'i'
  );
  const sharedHead = el(
    'div',
    { className: 'einzug-head' },
    el('div', { className: 'section-label' }, 'Gemeinsam'),
    el(
      'div',
      { className: 'einzug-saldo-side' },
      debts.length > 0 ? infoButton : null,
      el(
        'div',
        { className: `category-sum${myBalance > 0 ? ' is-positive' : myBalance < 0 ? ' is-negative' : ''}` },
        formatEuro(myBalance)
      )
    )
  );

  return el(
    'div',
    { className: 'view' },
    stats,
    sharedHead,
    details,
    sharedList,
    el('div', { className: 'section-label' }, 'Privat'),
    privateList,
    fab
  );
}

function openPrivateForm(ctx, group, item) {
  openPanel((close) => {
    const isEdit = !!item;
    const description = el('input', { id: 'einzug-desc', type: 'text', required: true, value: item?.description ?? '' });
    const amount = el('input', {
      id: 'einzug-amount',
      type: 'text',
      inputmode: 'decimal',
      required: true,
      placeholder: '0,00',
      value: item ? centsToInput(item.amountCents) : '',
    });
    const date = createDatePicker({ id: 'einzug-date', value: item?.spentOn ?? todayIso() });
    const error = el('p', { className: 'form-error', role: 'alert' });

    const showError = (message) => {
      error.textContent = message;
      error.classList.add('is-visible');
    };

    const remove = async () => {
      const ok = await confirmPanel('Diesen Eintrag wirklich löschen?', 'Löschen');
      if (!ok) return;
      try {
        await api(`/api/groups/${group.id}/einzug/${item.id}`, { method: 'DELETE' });
        close();
        ctx.refresh();
      } catch (err) {
        showError(err.message);
      }
    };

    const wrap = (label, input, forId) =>
      el('div', { className: 'field' }, el('label', { className: 'field-label', for: forId }, label), input);

    return el(
      'form',
      {
        onSubmit: async (event) => {
          event.preventDefault();
          const amountCents = parseEuroInput(amount.value);
          if (amountCents === null || amountCents === 0) {
            showError('Bitte einen Betrag eingeben, z. B. 12,50.');
            return;
          }
          const body = { description: description.value, amountCents, spentOn: date.value };
          try {
            if (isEdit) {
              await api(`/api/groups/${group.id}/einzug/${item.id}`, { method: 'PUT', body });
            } else {
              await api(`/api/groups/${group.id}/einzug`, { method: 'POST', body });
            }
            close();
            ctx.refresh();
          } catch (err) {
            showError(err.message);
          }
        },
      },
      el('h2', { className: 'panel-title' }, isEdit ? 'Privaten Eintrag bearbeiten' : 'Neuer privater Eintrag'),
      wrap('Beschreibung', description, 'einzug-desc'),
      wrap('Betrag', amount, 'einzug-amount'),
      wrap('Datum', date.root, 'einzug-date'),
      error,
      el(
        'div',
        { className: 'panel-actions' },
        isEdit ? el('button', { className: 'textlink textlink-danger', type: 'button', onClick: remove }, 'Löschen') : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
