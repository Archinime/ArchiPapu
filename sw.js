// sw.js
const CACHE_NAME = 'room-cache-v3'; // Versión actualizada para forzar limpieza
const urlsToCache = [
    './',
    './index.html',
    './room_style.css',
    './room_main.js',
    './inventory-data.js',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/lunari_durmiendo1.glb',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/Lunari_Duerme_2.glb',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/cuadro.glb',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb',
    'pantalla.glb',
    'gohan_vs_cell.mp4',
    'zoro_vs_king.mp4',
    'rezero.mp4'
];

// Instalación: cachea los archivos esenciales
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

// Estrategia Inteligente: 
// - Modelos 3D y Videos: Cache first (para que cargue rápido)
// - HTML, CSS, JS, JSON: Network first (para que siempre veas tus actualizaciones)
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;
    const isHeavyAsset = requestUrl.endsWith('.glb') || requestUrl.endsWith('.mp4') || requestUrl.includes('cdn.jsdelivr.net');

    if (isHeavyAsset) {
        // Estrategia: Cache First para archivos pesados
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                return cachedResponse || fetch(event.request).then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
    } else {
        // Estrategia: Network First para código (HTML, CSS, JS)
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => {
                return caches.match(event.request);
            })
        );
    }
});