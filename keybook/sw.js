/* Key Book offline support.
   Saves the app on first visit so it opens with no internet.
   Serves the saved copy right away and refreshes it in the background,
   so an update shows up the next time the app is opened.
   Bump VERSION when files are added or removed. */
const VERSION = 'keybook-v2';
const FILES = [
  './',
  './index.html',
  './vendor/vexflow-bravura.js',
  './fonts.css',
  './fonts/BebasNeue-400.woff2',
  './fonts/Inter-400.woff2',
  './fonts/JetBrainsMono-500.woff2',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(
    caches.open(VERSION).then(async cache => {
      const saved = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(key, res.clone());
        return res;
      }).catch(() => saved);
      if (saved) { event.waitUntil(fresh); return saved; }
      return fresh;
    })
  );
});
