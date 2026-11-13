/* ==========================================================================
   Service Worker PWA - VirMarket VIP & Studio
   Estrategia: Network-First con fallback seguro a Cache para disponibilidad offline
   y soporte nativo WebAPK / PWA sin degradación a Chrome Custom Tabs en Android.
   ========================================================================== */

const CACHE_NAME = 'virmarket-cache-v3';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './tarjeta_qr.html',
  './manifest.json',
  './manifest-admin.json',
  './favicon.svg',
  './favicon-32x32.png',
  './favicon-16x16.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

// Evento install: activar inmediatamente sin esperar cierre de otras pestañas
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precaché inicial completado con excepciones:', err);
      });
    })
  );
});

// Evento activate: reclamar clientes activos y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

// Evento fetch: Network-First con fallback seguro a Cache
self.addEventListener('fetch', (event) => {
  // Solo procesar peticiones GET
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // No interceptar llamadas al backend dinámico (n8n / webhooks / easypanel)
  if (event.request.url.includes('/webhook/') || event.request.url.includes('easypanel.host')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clonedResponse = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./') || caches.match('./index.html');
          }
        });
      })
  );
});
