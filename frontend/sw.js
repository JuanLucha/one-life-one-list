const CACHE_NAME = 'task-app-v8';
const STATIC_CACHE = 'task-app-static-v8';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/router.js',
  '/app.js',
  '/db.js',
  '/api.js',
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle API requests differently
  if (url.pathname.startsWith('/api/')) {
    handleApiRequest(event);
    return;
  }

  // Handle static files - cache first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response since it can only be consumed once
            const responseToCache = response.clone();

            // Cache the response for future use
            caches.open(STATIC_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If offline and request is for HTML page, serve cached index.html
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }

            // Otherwise return appropriate offline page or error
            return new Response('Offline - No cached version available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
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
  console.log('Service Worker: Sync event triggered:', event.tag);

  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

// Sync tasks with server
async function syncTasks() {
  try {
    console.log('Service Worker: Starting background sync...');

    // Get all clients to trigger sync in the app
    const clients = await self.clients.matchAll();

    // Send message to clients to trigger sync
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_TRIGGERED',
        tag: 'sync-tasks'
      });
    }

    console.log('Service Worker: Background sync completed');
    return true;
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
    return false;
  }
}

// Register for periodic sync (if supported)
if ('periodicSync' in registration) {
  self.registration.periodicSync.register({
    tag: 'sync-tasks-periodic',
    minInterval: 24 * 60 * 60 * 1000 // Once per day
  }).then(() => {
    console.log('Service Worker: Periodic sync registered');
  }).catch((error) => {
    console.log('Service Worker: Periodic sync registration failed:', error);
  });
}

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body || 'New task update',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1
      },
      actions: [
        {
          action: 'explore',
          title: 'View Task',
          icon: '/images/checkmark.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/images/xmark.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Task Update', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');

  event.notification.close();

  if (event.action === 'explore') {
    // Open the app to the specific task
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    event.notification.close();
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic sync for regular updates (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-tasks-periodic') {
    console.log('Service Worker: Periodic sync triggered');
    event.waitUntil(syncTasks());
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'FORCE_SYNC') {
    event.waitUntil(syncTasks());
  }
});
