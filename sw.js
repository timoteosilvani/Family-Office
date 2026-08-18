// ============================================
// FAMILY OFFICE — SERVICE WORKER
// Cambiá CACHE_VERSION con cada deploy para
// forzar actualización en todos los dispositivos
// ============================================

const CACHE_VERSION = '20260818-158'; // <-- actualizar en cada deploy
const CACHE_NAME = 'fo-cache-' + CACHE_VERSION;

// Rutas RELATIVAS al sw.js, nunca absolutas. Con la app en usuario.github.io/Family-Office/
// resuelven a /Family-Office/ y /Family-Office/index.html, exactamente igual que antes. El día
// que el repo tenga dominio propio, GitHub Pages lo sirve desde la RAÍZ del dominio y estas dos
// mismas líneas resuelven a / y /index.html. Un solo archivo sirve para los dos casos.
const PRECACHE = [
  './',
  './index.html',
  // v146 — el manifest y los íconos también se precachean: sin esto, la app instalada
  // en el celular pierde el ícono y el modo pantalla completa al quedarse sin señal.
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-icon.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('fo-cache-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // 1) NUNCA interceptar escrituras ni llamadas a la API (Supabase u otras).
  //    Van directo a la red, sin caché. Esto evita servir datos viejos.
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co')) {
    return;
  }

  // 2) HTML principal: network-first
  if (url.origin === location.origin &&
      (url.pathname.endsWith('/') || url.pathname.endsWith('index.html'))) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 3) Librerías estáticas de CDN: cache-first
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('cdnjs') ||
      url.hostname.includes('cloudflare') || url.hostname.includes('unpkg')) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // 4) Resto same-origin: network-first
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // 5) Cualquier otra cosa: red directa
});
