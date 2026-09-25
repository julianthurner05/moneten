// Begleichungszeile mit Bestätigungs-Button – in Allgemein und Einzug identisch.

import { api } from '../api.js';
import { el, noticePanel } from '../dom.js';
import { formatEuro } from '../format.js';
import { openSettlementForm } from './settlementForm.js';

export function settlementRow(ctx, group, members, settlement, name) {
  const me = ctx.state.user.id;
  const canConfirm = !settlement.confirmed && settlement.toUser === me && !group.archived;
  return el(
    'div',
    group.archived
      ? { className: 'row row-settle' }
      : {
          className: 'row row-settle row-clickable',
          onClick: () =>
            openSettlementForm(ctx, group, members, { settlement, me, isEinzug: settlement.isEinzug }),
        },
    el('span', { className: 'date-chip date-chip-euro', 'aria-hidden': 'true' }, '€'),
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
              onClick: async (event) => {
                event.stopPropagation();
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
}
