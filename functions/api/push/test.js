// Testmitteilung an die eigenen Abos – braucht das Secret VAPID_PRIVATE_KEY.

import { sendPush } from '../../../shared/webpush.js';
import { error, json } from '../../../shared/http.js';

const VAPID_PUBLIC_KEY = 'BOYw561Iiw6XrvQDPlYrrNwNe9fY35j0n5DT7Ime-6uu4AcTqrm4zRklnSy9mY-_ozUgJqiiGp7MPrDkb1_OtZo';

export async function onRequestPost({ env, data }) {
  if (!env.VAPID_PRIVATE_KEY) return error('VAPID_PRIVATE_KEY ist nicht gesetzt.', 500);

  const { results } = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  )
    .bind(data.user.id)
    .all();
  if (results.length === 0) return error('Keine Mitteilungs-Abos für diesen Account.', 404);

  let sent = 0;
  for (const sub of results) {
    const res = await sendPush(
      sub,
      { title: 'moneten', body: 'Testmitteilung – Push funktioniert.', url: '/' },
      { publicKey: VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: 'https://moneten.julianthurner.com' }
    );
    if (res.status === 404 || res.status === 410) {
      // Abo ist tot (App gelöscht o. Ä.) – aufräumen.
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
    } else if (res.ok) {
      sent += 1;
    }
  }
  return json({ sent });
}
