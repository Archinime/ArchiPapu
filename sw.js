// sw.js
const CACHE_NAME = 'room-cache-v7'; // Versión actualizada para incluir nuevos efectos y sonidos
const urlsToCache = [
    './',
    './index.html',
    './room_style.css',
    './room_main.js',
    './inventory-data.js',
    'gohan_vs_cell.mp4',
    'zoro_vs_king.mp4',
    'rezero.mp4',
    'efecto_tele.mp4',                // Efecto al apagar
    'efecto_tele - Invertido.mp4',     // Efecto al encender
    'prender_luz.mp3',
    'apagar_luz.mp3',
    'abrir_poster.mp3',
    'guardar_poster.mp3',
    'sonido_boton.mp3'                 // Sonido para botones de TV
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
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    event.respondWith(
        fetch(event.request).then(networkResponse => {
            // Solo guardamos en caché si NO tiene el parámetro "nocache".
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