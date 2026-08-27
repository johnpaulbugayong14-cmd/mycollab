importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const APP_VERSION = '1.1.35';
const CACHE_NAME = `task-manager-v${APP_VERSION}`;
const UPDATE_META_CACHE = 'mycollab-update-meta-v1';
const IS_GITHUB_PAGES = self.location.hostname.endsWith('.github.io');
const metaKey = name => new Request(new URL(name, self.registration.scope || self.location.href));
const ACTIVE_KEY = metaKey('__mycollab_active_version__');
const PREVIOUS_KEY = metaKey('__mycollab_previous_version__');
const PENDING_KEY = metaKey('__mycollab_pending_version__');
const urlsToCache = [
  'index.html',
  'login.html',
  'admin.html',
  'member.html',
  'chat.html',
  'survey.html',
  'style.css',
  'manifest.json',
  'firebase.js',
  'auth.js',
  'admin.js',
  'member.js',
  'chat.js',
  'survey.js',
  'notifications.js',
  'watchtogether.js',
  'update-config.js',
  'update-manager.js'
];

async function readMeta(key) {
  const cache = await caches.open(UPDATE_META_CACHE);
  const response = await cache.match(key);
  return response ? response.json() : null;
}

async function writeMeta(key, value) {
  const cache = await caches.open(UPDATE_META_CACHE);
  await cache.put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

async function activeReleaseCache() {
  const pending = await readMeta(PENDING_KEY);
  if (pending && Date.now() - pending.activatedAt > 30000) {
    const healthy = await readMeta(metaKey(`__mycollab_healthy_${pending.version}__`));
    if (!healthy) {
      const previous = await readMeta(PREVIOUS_KEY);
      if (previous?.cacheName) {
        await writeMeta(ACTIVE_KEY, previous);
        await writeMeta(PENDING_KEY, null);
        console.warn('[Updater] Trial release failed; rolled back to', previous.version);
      }
    }
  }
  const active = await readMeta(ACTIVE_KEY);
  return active?.cacheName || null;
}

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
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.filter(name => name.startsWith('task-manager-v') && name !== CACHE_NAME).map(name => caches.delete(name))
    )).then(() => caches.open(CACHE_NAME)).then(cache => cache.addAll(urlsToCache))
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

  event.respondWith((async () => {
    const releaseCacheName = await activeReleaseCache();
    if (releaseCacheName && !IS_GITHUB_PAGES) {
      const releaseCache = await caches.open(releaseCacheName);
      const releaseResponse = await releaseCache.match(event.request, { ignoreSearch: true });
      if (releaseResponse) return releaseResponse;
    }

    if (IS_GITHUB_PAGES) {
      try {
        const response = await fetch(event.request, { cache: 'reload' });
        if (response?.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone)).catch(error => console.warn('Failed to cache response:', error));
        }
        return response;
      } catch {
        const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
        if (cachedResponse) return cachedResponse;
        return Response.error();
      }
    }

    const bundledResponse = await caches.match(event.request, { ignoreSearch: true });
    if (bundledResponse) return bundledResponse;

    try {
      const response = await fetch(event.request, { cache: 'reload' });
      if (response?.ok) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone)).catch(error => console.warn('Failed to cache response:', error));
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  event.waitUntil((async () => {
    if (data.type === 'ACTIVATE_RELEASE' && data.version && data.cacheName) {
      const cache = await caches.open(data.cacheName);
      const hasEntryPoint = await cache.match(new URL('index.html', self.registration.scope), { ignoreSearch: true });
      if (!hasEntryPoint) throw new Error('Release entry point is missing');
      const current = await readMeta(ACTIVE_KEY);
      await writeMeta(PREVIOUS_KEY, current?.cacheName ? current : { version: 'bundled', cacheName: CACHE_NAME });
      await writeMeta(ACTIVE_KEY, { version: data.version, cacheName: data.cacheName });
      await writeMeta(PENDING_KEY, { version: data.version, cacheName: data.cacheName, activatedAt: Date.now() });
      const previous = current?.cacheName || CACHE_NAME;
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter(cacheName => cacheName.startsWith('mycollab-release-') && cacheName !== data.cacheName && cacheName !== previous).map(cacheName => caches.delete(cacheName)));
      console.log('[Updater] Activated trial release', data.version);
    }

    if (data.type === 'MARK_HEALTHY' && data.version) {
      await writeMeta(metaKey(`__mycollab_healthy_${data.version}__`), { version: data.version, markedAt: Date.now() });
      await writeMeta(PENDING_KEY, null);
      console.log('[Updater] Release marked healthy', data.version);
    }

    if (data.type === 'ROLLBACK') {
      const previous = await readMeta(PREVIOUS_KEY);
      if (previous?.cacheName) {
        await writeMeta(ACTIVE_KEY, previous);
        await writeMeta(PENDING_KEY, null);
      }
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== UPDATE_META_CACHE && !cacheName.startsWith('mycollab-release-')) {
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
