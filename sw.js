/* FutStory Service Worker
   Versão: bump esse número a cada deploy significativo pra forçar cache refresh */
const CACHE_VERSION = 'futstory-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// Assets do app shell (carregados no install)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// CDNs que podem ser cacheadas com cache-first
const CACHEABLE_CDNS = [
  'gstatic.com',
  'googleapis.com',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'tile.openstreetmap.org'
];

// Domínios que NUNCA devem ser cacheados (tempo real)
const NEVER_CACHE = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseio.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] install error:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Só GET é cacheado
  if (request.method !== 'GET') return;

  // Ignora requisições ao Firestore/Auth (precisam ser sempre online)
  if (NEVER_CACHE.some((domain) => url.hostname.includes(domain))) {
    return;
  }

  // Navigation requests (HTML) → network-first com fallback pro cache
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // CDNs cacheáveis → cache-first
  if (CACHEABLE_CDNS.some((domain) => url.hostname.includes(domain))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Mesma origem (GitHub Pages) → stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Demais: network com fallback pro cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Permite a página pedir skipWaiting manualmente (ex: após update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
