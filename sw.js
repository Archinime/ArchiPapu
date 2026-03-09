// sw.js
const CACHE_NAME = `room-cache-${Date.now()}`; // Versión dinámica garantizada [cite: 340]

const urlsToCache = [
    './',
    './index.html',
    './room_style.css',
    './room_main.js',
    './inventory-data.js'
];

// Instalación: Salta la espera inmediatamente
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

// Activación: Destruye todas las cachés anteriores obligatoriamente
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia: Siempre pide al servidor. Si estás offline, rescata del caché.
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    event.respondWith(
        fetch(event.request, { cache: 'no-store' }) // Fuerzo bypass de caché HTTP [cite: 344]
        .then(networkResponse => {
            if (!requestUrl.includes('nocache=')) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});