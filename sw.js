// ── InOut · sw.js ─────────────────────────────────────────────────────────────
// Service Worker — Cache-first with background refresh (stale-while-revalidate)
// Version bump here triggers cache purge on next install

const CACHE_NAME    = 'inout-v1.0.2';
const NETWORK_ONLY  = ['api.x.ai', 'api.groq.com'];  // Never cache API calls

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/store.js',
  './js/exercises.js',
  './js/ai.js',
  './js/calendar.js',
  './js/app.js',
  './file_000000006c20820bbf1241cf786592e2.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install: pre-cache app shell ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for app shell, network-only for API ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only for external APIs
  if (NETWORK_ONLY.some(host => url.hostname.includes(host))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For GET requests: stale-while-revalidate
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => null);

          return cached || fetchPromise;
        })
      )
    );
  }
});
