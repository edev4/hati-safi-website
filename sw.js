/* ═══════════════════════════════════════
   HATI SAFI — Service Worker (sw.js)
   Progressive Web App Caching Strategy
═══════════════════════════════════════ */

const CACHE_NAME = 'hati-safi-v1.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap',
];

/* ── INSTALL: Cache core assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https://fonts')));
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: Clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: Stale-while-revalidate for app shell, network-first for API ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip Anthropic API calls — always network
  if (url.hostname === 'api.anthropic.com') return;

  // Skip Google Fonts — always network
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(event.request)
          .then(resp => { cache.put(event.request, resp.clone()); return resp; })
          .catch(() => caches.match(event.request))
      )
    );
    return;
  }

  // App shell — cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && event.request.method === 'GET') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      });
      return cached || networkFetch;
    })
  );
});

/* ── BACKGROUND SYNC: Queue failed analyses ── */
self.addEventListener('sync', event => {
  if (event.tag === 'retry-analysis') {
    // Future: retry failed analyses when back online
    console.log('[SW] Background sync: retry-analysis');
  }
});

/* ── PUSH NOTIFICATIONS: Legal reminders ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hati Safi Reminder', {
      body: data.body || 'You have an upcoming legal deadline.',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'hati-safi-reminder',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
});
