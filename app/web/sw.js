// SW v3 - 2026-05-06 - Offline shell + precache
//
// Estrategia:
// - JS bundle (_expo/static/js/web/*.js): cache-first (immutable hash en URL)
// - Assets estáticos (icons, manifest): cache-first
// - HTML (/, /index.html): stale-while-revalidate
// - Resto same-origin: network-first con fallback cache
// - Cross-origin (Firestore, Auth, GIS): pasar de largo (no manejar)
//
// La lista de URLs precacheadas y el hash de versión los inyecta patch-web-bundle.js
// reemplazando los placeholders __PRECACHE_URLS__ y __PRECACHE_HASH__ abajo.

const VERSION = 'v3-__PRECACHE_HASH__';
const CACHE_STATIC = `cf-static-${VERSION}`;
const CACHE_RUNTIME = `cf-runtime-${VERSION}`;

const PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|otf)$/i) ||
    url.pathname === '/manifest.json'
  );
}

function isHtml(request) {
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

// FCM push handler. Cuando llega un push del backend en background, mostramos la notif.
// FCM SDK web normalmente registra firebase-messaging-sw.js separado; integramos aquí
// para evitar dos SWs y mantener nuestra estrategia de cache.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'CambiaFiguritas', body: event.data.text() } };
  }
  const title = payload?.notification?.title ?? payload?.data?.title ?? 'CambiaFiguritas';
  const body = payload?.notification?.body ?? payload?.data?.body ?? '';
  const link = payload?.fcmOptions?.link ?? payload?.data?.link ?? '/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(link) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        }).catch(() => caches.match('/'));
      })
    );
    return;
  }

  if (isHtml(request)) {
    event.respondWith(
      caches.open(CACHE_RUNTIME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkPromise = fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone()).catch(() => {});
              }
              return response;
            })
            .catch(() => cached);
          return cached || networkPromise;
        })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((c) => c || new Response('', { status: 504 })))
  );
});
