// public/sw.js — Backfindr Service Worker

const CACHE_NAME = 'backfindr-v1';
const STATIC_ASSETS = ['/', '/map', '/auth/login', '/auth/register'];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch — Network first, cache fallback ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return; // Never cache API

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  const options = {
    body:    data.body ?? 'Você tem uma nova notificação no Backfindr.',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url ?? '/dashboard' },
    actions: data.actions ?? [],
    tag:     data.tag ?? 'backfindr-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Backfindr', options)
  );
});

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
