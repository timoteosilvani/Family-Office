// ============================================
// FAMILY OFFICE — SERVICE WORKER
// Cambiá CACHE_VERSION con cada deploy para
// forzar actualización en todos los dispositivos
// ============================================

const CACHE_VERSION = '20260603-002'; // <-- actualizar en cada deploy
const CACHE_NAME = 'fo-cache-' + CACHE_VERSION;

const PRECACHE = [
  '/Family-Office/',
  '/Family-Office/index.html',
];

// Install: cache recursos base
self.addEventListener('install', e => {
  self.skipWaiting(); // Activarse inmediatamente sin esperar
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

// Activate: eliminar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('fo-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // Tomar control de todas las tabs abiertas
  );
});

// Fetch: network-first para el HTML (siempre versión fresca),
// cache-first para CDN (supabase, chart.js, fonts)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Para el HTML principal: siempre intentar red primero
  if (url.pathname === '/Family-Office/' || url.pathname === '/Family-Office/index.html') {
    e.respondWith(
      fetch(e.request).then(res => {
        // Guardamos la versión fresca en caché
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return res;
      }).catch(() => caches.match(e.request)) // Fallback a caché si no hay red
    );
    return;
  }

  // Para CDN externos: cache-first (no cambian)
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
          return res;
        });
      })
    );
    return;
  }

  // Default: network-first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
