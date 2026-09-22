// Gruppe archivieren – nur wenn alle Salden 0 sind.

import { loadBalances, loadGroupForMember } from '../../../../shared/groupData.js';
import { error, json } from '../../../../shared/http.js';

export async function onRequestPost({ env, data, params }) {
  const group = await loadGroupForMember(env, params.id, data.user.id);
  if (!group) return error('Gruppe nicht gefunden.', 404);
  if (group.archived) return error('Die Gruppe ist schon archiviert.');

  const balances = await loadBalances(env, group.id);
  for (const cents of balances.values()) {
    if (cents !== 0) {
      return error('Archivieren geht erst, wenn alle Salden ausgeglichen sind.');
    }
  }

  await env.DB.prepare('UPDATE groups SET archived = 1 WHERE id = ?').bind(group.id).run();
  return json({ ok: true });
}
