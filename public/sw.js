// Service Worker: empfängt Push-Mitteilungen und zeigt sie an. (Version 2026-10-25)

// Gemeinsamer Zähler für den roten Punkt am App-Icon: Mitteilungen zählen
// hoch, die offene App setzt ihn auf die echte Summe (js/app.js).
function badgeDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('moneten-badge', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function badgeCount(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('kv').objectStore('kv').get('count');
    request.onsuccess = () => resolve(request.result ?? 0);
    request.onerror = () => reject(request.error);
  });
}

function setBadgeCount(db, count) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(count, 'count');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function bumpBadge(by) {
  if (!('setAppBadge' in self.navigator)) return;
  let count = by;
  try {
    const db = await badgeDB();
    count = (await badgeCount(db)) + by;
    await setBadgeCount(db, count);
  } catch {
    // Ohne Zähler wenigstens einen Punkt zeigen
  }
  await self.navigator.setAppBadge(count).catch(() => {});
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const jobs = [
    self.registration.showNotification(data.title ?? 'moneten', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/' },
    }),
  ];
  // Roter Zähler am App-Icon (iOS zeigt ihn nur bei installierter Web-App):
  // jede Mitteilung zählt hoch, die offene App setzt die echte Summe.
  if (data.badge) {
    jobs.push(bumpBadge(data.badge));
  }
  event.waitUntil(Promise.all(jobs));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      if (open) {
        open.navigate(url);
        return open.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Tauscht der Browser das Abo aus, gleich das neue beim Server hinterlegen.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription?.options;
      const sub =
        event.newSubscription ??
        (options?.applicationServerKey ? await self.registration.pushManager.subscribe(options) : null);
      if (!sub) return;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
    })().catch(() => {})
  );
});
