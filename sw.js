self.addEventListener('install', (event) => {
    // Obliga al nuevo service worker a tomar el control al instante
    self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
    // Borra todas las memorias caché existentes
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        })
    );
    return self.clients.claim();
});

// Al interceptar peticiones, SIEMPRE las pide a internet, nunca al caché
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});