const APP_CACHE = 'kml-viewer-app-v17';
const MAP_CACHE = 'osm-map-tiles-v2';
const FONT_CACHE = 'kml-viewer-fonts-v1';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './kml-parser.js',
    './gpx-parser.js',
    './geo-utils.js',
    './trail-layer-controller.js',
    './map-renderer.js',
    './tile17.js',
    './sample.kml',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    const keepCaches = new Set([APP_CACHE, MAP_CACHE, FONT_CACHE]);

    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((name) => {
                if (!keepCaches.has(name)) {
                    return caches.delete(name);
                }
                return undefined;
            })
        ))
    );
    self.clients.claim();
});

function isAppShellRequest(url) {
    return url.origin === self.location.origin
        && (
            url.pathname === '/'
            || url.pathname.endsWith('/index.html')
            || url.pathname.endsWith('.js')
            || url.pathname.endsWith('.css')
            || url.pathname.endsWith('.json')
            || url.pathname.endsWith('.html')
            || url.pathname.endsWith('.png')
            || url.pathname.endsWith('.svg')
            || url.pathname.endsWith('.ico')
        );
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (url.hostname === 'tile.openstreetmap.org') {
        event.respondWith(
            caches.open(MAP_CACHE).then((cache) => cache.match(event.request).then((response) => {
                if (response) {
                    return response;
                }

                return fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(() => new Response('', { status: 404, statusText: 'Not Found' }));
            }))
        );
        return;
    }

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.open(FONT_CACHE).then((cache) => cache.match(event.request).then((response) => {
                const networkFetch = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });

                return response || networkFetch;
            })).catch(() => new Response('', { status: 404, statusText: 'Not Found' }))
        );
        return;
    }

    if (isAppShellRequest(url)) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                const responseClone = networkResponse.clone();
                caches.open(APP_CACHE).then((cache) => cache.put(event.request, responseClone));
                return networkResponse;
            }).catch(() => caches.match(event.request).then((cachedResponse) => (
                cachedResponse || caches.match('./index.html')
            )))
        );
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
