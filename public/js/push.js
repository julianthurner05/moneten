// Web-Push-Grundstein: Service Worker registrieren, Abo an- und abmelden.
// Der private VAPID-Schlüssel liegt nicht im Repo (wird erst beim Versand gebraucht).

import { api } from './api.js';

const VAPID_PUBLIC_KEY = 'BOYw561Iiw6XrvQDPlYrrNwNe9fY35j0n5DT7Ime-6uu4AcTqrm4zRklnSy9mY-_ozUgJqiiGp7MPrDkb1_OtZo';

function applicationServerKey() {
  const base64 = (VAPID_PUBLIC_KEY + '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function pushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Mitteilungen wurden nicht erlaubt.');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(),
  });
  await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
}

export async function disablePush() {
  const sub = await pushSubscription();
  if (!sub) return;
  await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
