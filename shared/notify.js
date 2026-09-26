// Mitteilungen an User schicken – bewusst fehlertolerant: Ohne Secret oder bei
// Versandfehlern passiert nichts, der eigentliche API-Aufruf bleibt unberührt.

import { sendPush } from './webpush.js';

export const VAPID_PUBLIC_KEY = 'BOYw561Iiw6XrvQDPlYrrNwNe9fY35j0n5DT7Ime-6uu4AcTqrm4zRklnSy9mY-_ozUgJqiiGp7MPrDkb1_OtZo';
const VAPID_SUBJECT = 'https://moneten.julianthurner.com';

const euroFormat = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Cent → "1.234,56 €" (für Mitteilungstexte). */
export function euro(cents) {
  return `${euroFormat.format(cents / 100)} €`;
}

/**
 * Push an mehrere User (alle ihre Geräte). Tote Abos werden aufgeräumt.
 * @param {string[]} userIds
 * @param {{title: string, body: string, url?: string, badge?: number}} payload
 */
export async function notifyUsers(env, userIds, payload) {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!env.VAPID_PRIVATE_KEY || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    const { results } = await env.DB.prepare(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`
    )
      .bind(...ids)
      .all();
    const vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
    for (const sub of results) {
      try {
        const res = await sendPush(sub, { badge: 1, ...payload }, vapid);
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        }
      } catch {
        // Einzelner Versandfehler ist egal
      }
    }
  } catch {
    // Mitteilungen dürfen nie den eigentlichen Vorgang stören
  }
}

/** Anzeigename eines Users, für Mitteilungstexte. */
export async function displayName(env, userId) {
  const row = await env.DB.prepare('SELECT display_name FROM users WHERE id = ?').bind(userId).first();
  return row?.display_name ?? 'Jemand';
}
