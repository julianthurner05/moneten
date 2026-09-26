// Service Worker: empfängt Push-Mitteilungen und zeigt sie an.

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
  // Roter Zähler am App-Icon (iOS zeigt ihn nur bei installierter Web-App).
  if (data.badge && 'setAppBadge' in self.navigator) {
    jobs.push(self.navigator.setAppBadge(data.badge).catch(() => {}));
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
