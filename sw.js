// sw.js
const CACHE_NAME = 'room-cache-v2';
const urlsToCache = [
    './',
    './inventory-data.js',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/lunari_durmiendo1.glb',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/Lunari_Duerme_2.glb',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/cuadro.glb',
    'https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb',
    
    // Tus nuevos recursos para la TV
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

// Estrategia: Cache first, luego red
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});