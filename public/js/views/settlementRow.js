// Begleichungszeile mit Bestätigungs-Button – in Allgemein und Einzug identisch.

import { api } from '../api.js';
import { el, noticePanel } from '../dom.js';
import { formatEuro } from '../format.js';

export function settlementRow(ctx, group, settlement, name) {
  const me = ctx.state.user.id;
  const canConfirm = !settlement.confirmed && settlement.toUser === me && !group.archived;
  return el(
    'div',
    { className: 'row row-settle' },
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
}
