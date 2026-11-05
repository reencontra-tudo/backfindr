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
const DEFAULT_ICON = '/icons/logo-backfindr-small.png';
const VIBRATE_DEFAULT = [200, 100, 200];
const VIBRATE_URGENT = [300, 150, 300, 150, 300, 150, 600];

function validVibrate(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= 10 && v.every(function(n) { return typeof n === 'number' && n >= 0 && n <= 2000; })
    ? v : null;
}

// Imagem só do próprio domínio (caminho relativo ou mesma origem) ou do bucket público de mídia (*.r2.dev, https).
function isAllowedImage(u) {
  if (typeof u !== 'string' || !u) return false;
  if (u.charAt(0) === '/') return u.charAt(1) !== '/' && u.indexOf('\\') === -1;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') return false;
    return parsed.origin === self.location.origin || parsed.hostname === 'r2.dev' || /\.r2\.dev$/.test(parsed.hostname);
  } catch (e) { return false; }
}

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Backfindr', body: event.data.text() };
  }

  const title = payload.title || 'Backfindr';
  const urgent = payload.urgent === true;
  const options = {
    body: payload.body || '',
    icon: (typeof payload.icon === 'string' && payload.icon) || DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: payload.tag,
    data: { url: payload.url || '/dashboard' },
    vibrate: validVibrate(payload.vibrate) || (urgent ? VIBRATE_URGENT : VIBRATE_DEFAULT),
  };
  // Aditivos (Web): botões, nova mensagem da mesma conversa volta a alertar, imagem só de origem permitida,
  // urgente fica na tela até ser fechado.
  if (Array.isArray(payload.actions) && payload.actions.length > 0) options.actions = payload.actions;
  if (payload.tag) options.renotify = true;
  if (isAllowedImage(payload.image)) options.image = payload.image;
  if (urgent) options.requireInteraction = true;

  // Som com o app aberto: só avisa as janelas VISÍVEIS; o aviso do sistema NÃO é suprimido
  // (pode haver som duplicado: o do sistema e o do app).
  const notifyWindows = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(function(list) {
      list.forEach(function(c) {
        if (c.visibilityState === 'visible') {
          try { c.postMessage({ type: 'push-received', tag: payload.tag || null, urgent: urgent }); } catch (e) { /* ignora */ }
        }
      });
    })
    .catch(function() {});

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), notifyWindows]));
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
