// Cron-Worker: verschickt die Putzplan-Erinnerungen zu festen Zeiten,
// unabhängig davon, ob jemand die App öffnet. Gleiche Logik und Sperren wie
// der Auslöser beim App-Laden – es geht nie etwas doppelt raus.
// Deploy: npx wrangler deploy -c worker/wrangler.toml
// Secret: cat ~/.moneten-vapid-private.txt | npx wrangler secret put VAPID_PRIVATE_KEY -c worker/wrangler.toml

import { checkCleaningReminders } from '../shared/cleaningNotify.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkCleaningReminders(env));
  },
};
