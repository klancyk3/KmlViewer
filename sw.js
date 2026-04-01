const CACHE_NAME = 'kml-viewer-v5';
const MAP_CACHE = 'osm-map-tiles-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './kml-parser.js',
    './map-renderer.js',
    './sample.kml',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME && name !== MAP_CACHE) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle map tiles
    if (url.hostname === 'tile.openstreetmap.org') {
        event.respondWith(
            caches.open(MAP_CACHE).then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {
                        // Return empty response on failure to not break images
                        return new Response('', { status: 404, statusText: 'Not Found' });
                    });
                });
            })
        );
        return;
    }

    // Handle Google Fonts
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {
                    // Fail silently
                    return new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
        );
        return;
    }

    // Default cache-first for other assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // Return empty response on failure
                return new Response('', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
});
