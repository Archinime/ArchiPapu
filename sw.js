// sw.js
const CACHE_NAME = 'room-cache-v10'; // Subimos la versión a v10 para forzar la actualización
const urlsToCache = [
    './',
    './index.html',
    './room_style.css',
    './room_main.js',
    './room_state.js',    // Añadidos los nuevos módulos
    './room_scene.js',    
    './room_tv.js',       
    './room_pc.js',       
    './room_lunari.js',   
    './room_clima.js',    
    './room_ui.js',       
    'gohan_vs_cell.mp4',
    'zoro_vs_king.mp4',
    'rezero.mp4',
    'efecto_tele.mp4',
    'efecto_tele - Invertido.mp4',
    'prender_luz.mp3',
    'apagar_luz.mp3',
    'abrir_poster.mp3',
    'guardar_poster.mp3',
    'sonido_boton.mp3',
    'lunari_esta_despierta.glb'
    // Asegúrate de añadir aquí cualquier otro .glb o archivo base que uses siempre
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Fuerza a que el nuevo SW tome el control inmediatamente
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Usamos allSettled para que si un archivo falla (ej. un mp4 no existe), el SW siga instalándose con el resto
                return Promise.allSettled(
                    urlsToCache.map(url => cache.add(url).catch(err => console.warn('No se pudo precachear:', url)))
                );
            })
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
    // IMPORTANTE: Solo interceptar peticiones GET y válidas (evita errores con extensiones de Chrome o POSTs)
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    const requestUrl = event.request.url;
    const isMedia = requestUrl.endsWith('.mp4') || requestUrl.endsWith('.glb') || requestUrl.endsWith('.mp3');

    // Caché Primero para multimedia (no cambian y pesan mucho)
    if (isMedia) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then(networkResponse => {
                    // Solo cachear si la respuesta es exitosa (código 200)
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return networkResponse;
                }).catch(() => caches.match(event.request))
            })
        );
    } else {
        // Red Primero para HTML, JS, CSS
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                // Solo cachear si la respuesta es exitosa y no tiene marca de nocache
                if (networkResponse && networkResponse.status === 200 && !requestUrl.includes('nocache=')) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => caches.match(event.request)) // Si no hay red, busca en caché
        );
    }
});