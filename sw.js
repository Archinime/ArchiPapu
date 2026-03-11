// sw.js
const CACHE_NAME = 'room-cache-v8'; // Subimos la versión
const urlsToCache = [
    './',
    './index.html',
    './room_style.css',
    './room_main.js',
    './inventory-data.js',
    'gohan_vs_cell.mp4',
    'zoro_vs_king.mp4',
    'rezero.mp4',
    'efecto_tele.mp4',
    'efecto_tele - Invertido.mp4',
    'prender_luz.mp3',
    'apagar_luz.mp3',
    'abrir_poster.mp3',
    'guardar_poster.mp3',
    'sonido_boton.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;
    const isMedia = requestUrl.endsWith('.mp4') || requestUrl.endsWith('.glb') || requestUrl.endsWith('.mp3');

    // Caché Primero para multimedia (no cambian y pesan mucho)
    if (isMedia) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return networkResponse;
                });
            }).catch(() => caches.match(event.request))
        );
    } else {
        // Red Primero para HTML, JS, CSS
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                if (!requestUrl.includes('nocache=')) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => caches.match(event.request))
        );
    }
});