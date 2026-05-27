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
