// sw.js
const CACHE_NAME = 'room-cache-v4'; // Versión actualizada
const urlsToCache = [
    './',
    './index.html',
    './room_style.css',
    './room_main.js',
    './inventory-data.js',
    'gohan_vs_cell.mp4',
    'zoro_vs_king.mp4',
    'rezero.mp4'
    // Se quitaron los .glb de la precarga para evitar que se queden atascados en caché
];

// Instalación
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activación: limpia cachés antiguas
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

// Estrategia Network First (Red Primero) para TODO.
// Queremos los datos más recientes siempre al instante.
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    event.respondWith(
        fetch(event.request).then(networkResponse => {
            // Solo guardamos en caché si NO tiene el parámetro "nocache".
            // Esto evita que la memoria del teléfono se llene de copias del mismo modelo 3D.
            if (!requestUrl.includes('nocache=')) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
            }
            return networkResponse;
        }).catch(() => {
            // Si no hay internet, intentamos cargar lo que haya en la caché
            return caches.match(event.request);
        })
    );
});