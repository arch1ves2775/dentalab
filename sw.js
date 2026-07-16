const DENTALAB_CACHE = 'dentalab-pwa-v10';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(DENTALAB_CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== DENTALAB_CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(DENTALAB_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(DENTALAB_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: 'DentaLab', body: event.data ? event.data.text() : 'Novo aviso recebido.' };
  }

  const title = payload.title || 'DentaLab';
  const options = {
    body: payload.body || 'Novo aviso recebido.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.tag || [payload.kind || 'general', payload.url || './'].join(':'),
    renotify: false,
    data: {
      url: payload.url || './',
      kind: payload.kind || 'general'
    }
  };

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Safari/iOS may omit WindowClient.visibilityState. Ask every client and
    // let the page decide using document.visibilityState/document.hasFocus().
    const answers = await Promise.all(clientList.map((client) => new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(false), 500);
      channel.port1.onmessage = (messageEvent) => {
        clearTimeout(timer);
        resolve(!!(messageEvent.data && messageEvent.data.suppressSystemNotification));
      };
      try {
        client.postMessage({ type: 'DENTALAB_PUSH_VISIBILITY_QUERY', payload }, [channel.port2]);
      } catch (err) {
        clearTimeout(timer);
        resolve(false);
      }
    })));
    if (!answers.some(Boolean)) await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    savePendingNotificationTarget(targetUrl).then(() => clients.matchAll({ type: 'window', includeUncontrolled: true })).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          let destinationClient = client;
          if ('navigate' in client) {
            try {
              const navigatedClient = await client.navigate(targetUrl);
              if (navigatedClient) destinationClient = navigatedClient;
              else if (clients.openWindow) return clients.openWindow(targetUrl);
            } catch (err) {
              if (clients.openWindow) return clients.openWindow(targetUrl);
            }
          }
          await destinationClient.focus();
          // URL navigation is the durable iOS path. postMessage keeps an
          // already-awake Edge/Chrome window responsive without waiting.
          destinationClient.postMessage({ type: 'DENTALAB_NOTIFICATION_OPEN', url: targetUrl });
          return destinationClient;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

// iOS can reopen an installed PWA at its start URL and discard the query
// string supplied to openWindow()/navigate(). Persist the intended target
// before waking the app so the page can consume it after session restore.
function savePendingNotificationTarget(url) {
  return new Promise((resolve) => {
    const request = indexedDB.open('dentalab-notifications', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
    };
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ url, createdAt: Date.now() }, 'pendingTarget');
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    };
  });
}
