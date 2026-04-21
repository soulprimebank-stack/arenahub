/* FutStory Service Worker v2
   Estratégia:
   - HTML: NETWORK-FIRST (sempre busca versão nova; cache só como fallback offline)
   - Manifest.json: NETWORK-FIRST (mesma lógica)
   - CDNs (Firebase SDK, etc): cache-first (não mudam)
   - Imagens do app: stale-while-revalidate
   - Firestore/Auth/Backend: nunca cachear
   
   Mudança crítica vs v1: index.html agora é SEMPRE buscado da rede primeiro.
   Usuários com internet vão ter a versão mais atual.
   Só fica no cache quando offline.
*/
const CACHE_VERSION = 'futstory-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const APP_SHELL = [
  './manifest.json'
];

const CACHEABLE_CDNS = [
  'gstatic.com',
  'googleapis.com',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'tile.openstreetmap.org'
];

const NEVER_CACHE = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseio.com',
  'firebaseinstallations.googleapis.com',
  'firebasestorage.googleapis.com',
  'vercel.app'
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
            console.log('[SW] removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isHTMLRequest(request) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const url = new URL(request.url);
  if (url.pathname.endsWith('.html')) return true;
  if (url.pathname === '/' || url.pathname.endsWith('/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (NEVER_CACHE.some((domain) => url.hostname.includes(domain))) {
    return;
  }

  if (isHTMLRequest(request)) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  if (url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
