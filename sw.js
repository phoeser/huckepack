// Huckepack Service Worker v1.0
const CACHE_NAME = 'huckepack-v1';
const OFFLINE_URL = '/huckepack/app/';

// Files to cache for offline use
const PRECACHE_URLS = [
  '/huckepack/app/',
  '/huckepack/app/icons/icon-192.png',
  '/huckepack/app/icons/icon-512.png',
  '/huckepack/app/manifest.json'
];

// Install: cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first strategy (always try network, fall back to cache)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase, Stripe, and external API calls
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('stripe') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('router.project-osrm') ||
    url.hostname.includes('tile.openstreetmap')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If requesting a page, show the cached app
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
