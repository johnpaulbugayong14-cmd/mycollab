importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'task-manager-v6';
const urlsToCache = [
  'index.html',
  'login.html',
  'admin.html',
  'member.html',
  'style.css',
  'manifest.json',
  'firebase.js',
  'auth.js',
  'admin.js',
  'member.js',
  'notifications.js'
];

const firebaseConfig = {
  apiKey: "AIzaSyDwaMDGG7ke7fwM0wYsywSfPPZ2qZGPZLc",
  authDomain: "mycollab-89c11.firebaseapp.com",
  projectId: "mycollab-89c11",
  storageBucket: "mycollab-89c11.firebasestorage.app",
  messagingSenderId: "1089766419760",
  appId: "1:1089766419760:web:26b4307d2fd78fd067acf5",
  measurementId: "G-N0JF8FKPHP"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || payload.data?.title || 'My Collab';
  const body = payload.notification?.body || payload.data?.body || 'You have a new notification';
  const options = {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Only intercept same-origin GET/HEAD requests for app shell caching.
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
    return;
  }

  if (requestUrl.origin !== location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            try {
              cache.put(event.request, responseClone);
            } catch (e) {
              console.warn('Failed to cache response:', e);
            }
          }).catch(err => console.warn('Failed to open cache:', err));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          return Response.error();
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
