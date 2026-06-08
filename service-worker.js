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
  apiKey: "AIzaSyBJt3bCDYaqzLe_vGiFqvCMehJedZFvSJs",
  authDomain: "task-edd4d.firebaseapp.com",
  projectId: "task-edd4d",
  storageBucket: "task-edd4d.firebasestorage.app",
  messagingSenderId: "372695845973",
  appId: "1:372695845973:web:23b25b0de8ca2b72dfd8dc"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || payload.data?.title || 'My Thesis Hub';
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
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache GET and HEAD requests
        if (event.request.method === 'GET' || event.request.method === 'HEAD') {
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
        }
        return response;
      })
      .catch(() => {
        // Try to return cached response on network error
        if (event.request.method === 'GET' || event.request.method === 'HEAD') {
          return caches.match(event.request);
        }
        throw new Error('Network request failed');
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
