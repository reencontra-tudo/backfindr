// Service Worker - Backfindr
// Não cacheia rotas de API e admin

self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  if (
    url.includes('/api/') ||
    url.includes('/admin/') ||
    url.includes('/auth/')
  ) {
    return;
  }
});

// ── Push + clique na notificação (achado no fechamento do ciclo "Encontrei",
// 22/08/2026) ────────────────────────────────────────────────────────────────
// Antes disso este arquivo só tinha o listener de 'fetch' — nenhum handler
// de 'push' nem 'notificationclick'. A subscrição de push (usePushNotifications)
// e o payload real (web-push, ver src/lib/pushNotification.ts — já inclui
// title/body/url/tag) sempre funcionaram, mas clicar na notificação do
// sistema operacional não levava a lugar nenhum: sem 'notificationclick',
// não existe handler nenhum decidindo o que fazer com o clique.
self.addEventListener('push', function(event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Backfindr', body: event.data.text() };
  }

  const title = payload.title || 'Backfindr';
  const options = {
    body: payload.body || '',
    icon: '/icons/logo-backfindr-small.png',
    badge: '/icons/logo-backfindr-small.png',
    tag: payload.tag,
    data: { url: payload.url || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já existe uma aba do Backfindr aberta, foca nela e navega —
      // evita abrir uma segunda aba toda vez que uma notificação é clicada.
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
