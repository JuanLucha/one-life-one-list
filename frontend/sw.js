const CACHE_NAME = 'task-app-v11';
const STATIC_CACHE = 'task-app-static-v11';

// Static asset extensions that should use cache-first
const STATIC_EXT = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|json)$/;

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/router.js',
  '/app.js',
  '/db.js',
  '/api.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - SPA-aware routing
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API requests: network-first
  if (url.pathname.startsWith('/api/')) {
    handleApiRequest(event);
    return;
  }

  // Navigation requests (HTML pages / deep-links): always serve index.html
  // This is the key fix for SPA deep-linking support
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
      .catch(() => new Response('Offline', { status: 503 }))
  );
});

// Handle API requests with network-first strategy
function handleApiRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful API responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              // Return cached response but add header to indicate it's from cache
              const headers = new Headers(cachedResponse.headers);
              headers.set('X-From-Cache', 'true');

              return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: headers
              });
            }

            // If no cached response, return offline error
            return new Response(JSON.stringify({
              error: 'Offline - No cached data available',
              offline: true
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: {
                'Content-Type': 'application/json'
              }
            });
          });
      })
  );
}

// Background sync for offline operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

// Sync tasks with server
async function syncTasks() {
  try {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: 'SYNC_TRIGGERED', tag: 'sync-tasks' });
    }
    return true;
  } catch (error) {
    return false;
  }
}


// Periodic sync for regular updates (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-tasks-periodic') {
    event.waitUntil(syncTasks());
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'FORCE_SYNC') {
    event.waitUntil(syncTasks());
  }
});
