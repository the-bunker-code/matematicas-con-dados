/**
 * Service worker network-first: online siempre sirve lo publicado (y lo cachea);
 * offline usa la caché. Nadie queda atrapado en una versión vieja.
 * Subir VERSION al cambiar la lista FILES. Desactivarlo: README.md › Service worker.
 */

const VERSION = 'v1';
const CACHE_NAME = `dados-y-tapitas-${VERSION}`;

/** Precarga para el primer uso offline. */
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'fonts/fredoka-latin-v17.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/main.js',
  'js/game.js',
  'js/render.js',
  'js/rules.js',
  'js/config.js',
  'js/spanish.js',
  'js/audio.js',
  'js/storage.js',
  'js/settings-panel.js',
  'js/icons.js',
  'js/mascot.js',
  'js/dom.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)));
  self.skipWaiting(); // activa sin esperar a que se cierren las pestañas
});

// Limpia cachés de versiones anteriores.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Solo GET del mismo origen. Fallback: request cacheado → index.html.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) ?? (await caches.match('index.html')) ?? Response.error()),
  );
});
