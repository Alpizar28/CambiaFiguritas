// Service Worker mínimo. Solo presencia para que Chrome muestre install prompt.
// Cache real lo maneja Firebase Hosting (cache headers en firebase.json).
// Si crece la app, considerar Workbox para offline.

const CACHE_NAME = 'cambiafiguritas-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first. Sin caching propio. Hosting CDN ya cachea estáticos.
});
