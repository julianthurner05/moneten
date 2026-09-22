// Einzug-Bereich einer WG-Gruppe: gemeinsame Einzugs-Ausgaben plus privater Bereich.

import { api } from '../api.js';
import { createDatePicker, dateChip } from '../controls.js';
import { confirmPanel, el, openPanel } from '../dom.js';
import { buildFab } from '../fab.js';
import { centsToInput, formatDate, formatEuro, parseEuroInput, todayIso } from '../format.js';
import { openExpenseForm } from './expenseForm.js';

export async function renderEinzug(ctx, groupId) {
  const data = await api(`/api/groups/${groupId}`);
  ctx.show('einzug', () => build(ctx, data));
}

function build(ctx, data) {
  const { group, members, einzugPersonal } = data;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const name = (id) => names.get(id) ?? 'Unbekannt';
  const transfers = new Set((data.einzugTransfers ?? []).map((t) => `${t.expenseId}|${t.userId}`));

  // Pro Person festhalten, dass der Anteil überwiesen wurde (rein informativ).
  const transferChips = (expense) =>
    el(
      'div',
      { className: 'transfer-chips' },
      expense.shares
        .filter((s) => s.userId !== expense.paidBy)
        .map((s) => {
          const done = transfers.has(`${expense.id}|${s.userId}`);
          return el(
            'button',
            {
              className: `transfer-chip${done ? ' is-done' : ''}`,
              type: 'button',
              title: done ? 'Überwiesen – Klick entfernt den Vermerk' : 'Als überwiesen vermerken',
              onClick: async (event) => {
                event.stopPropagation();
                try {
                  await api(`/api/groups/${group.id}/einzug-transfers`, {
                    method: 'POST',
                    body: { expenseId: expense.id, userId: s.userId, transferred: !done },
                  });
                  ctx.refresh();
                } catch {
                  // Fehler still ignorieren – nächster Refresh zeigt den Stand
                }
              },
            },
            `${name(s.userId)}${done ? ' ✓' : ''}`
          );
        })
    );

  // Kaution läuft gesondert: fest vermerkt, zählt nicht zu den Einzugskosten.
  const deposits = data.expenses.filter((e) => e.isEinzug && e.isDeposit);
  const shared = data.expenses.filter((e) => e.isEinzug && !e.isDeposit);
  const sharedSum = shared.reduce((sum, e) => sum + e.amountCents, 0);
  const mySharedSum = shared.reduce(
    (sum, e) => sum + (e.shares.find((s) => s.userId === ctx.state.user.id)?.shareCents ?? 0),
    0
  );
  const privateSum = einzugPersonal.reduce((sum, item) => sum + item.amountCents, 0);

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

  const sharedList =
    shared.length === 0 && depositRows.length === 0
      ? el('p', { className: 'empty-note' }, 'Noch keine gemeinsamen Einzugs-Ausgaben – z. B. Kaution oder Gerätebestellungen.')
      : el(
          'div',
          { className: 'row-list', 'data-stagger': '' },
          shared.map((expense) =>
            el(
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
                el('div', { className: 'row-label' }, `Bezahlt von ${name(expense.paidBy)}`),
                group.archived ? null : transferChips(expense)
              ),
              el('div', { className: 'row-side' }, el('div', { className: 'row-amount' }, formatEuro(expense.amountCents)))
            )
          ),
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
        { label: 'Privater Eintrag', onClick: () => openPrivateForm(ctx, group, null) },
      ]);

  return el(
    'div',
    { className: 'view' },
    stats,
    el('div', { className: 'section-label' }, 'Gemeinsam'),
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
        isEdit ? el('button', { className: 'textlink', type: 'button', onClick: remove }, 'Löschen') : null,
        el('div', { className: 'toolbar-spacer' }),
        el('button', { className: 'textlink', type: 'button', onClick: () => close() }, 'Abbrechen'),
        el('button', { className: 'button', type: 'submit' }, 'Speichern')
      )
    );
  });
}
