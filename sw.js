/* ============================================
   DEUTSCH VOCAB — Service Worker
   Caches all assets for offline use
   ============================================ */

const CACHE_NAME = 'deutsch-vocab-v4';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './words.js',
    './words_a2.js',
    './manifest.json',
    './sw.js',
];

// Install — cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            // Return cached version, but also update cache in background
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return networkResponse;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
