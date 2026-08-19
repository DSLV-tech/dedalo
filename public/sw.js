/*
 * Service worker di DEDALO.
 *
 * Strategia deliberatamente semplice: il gioco è interamente statico e non parla
 * con nessun server, quindi basta una cache "stale-while-revalidate" su tutto ciò
 * che è same-origin. Al primo avvio si popola da sola; dalle volte successive il
 * gioco parte anche senza rete.
 */
const CACHE = 'dedalo-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Aggiorna in sottofondo, ma serve subito ciò che abbiamo.
        void network;
        return cached;
      }

      const response = await network;
      if (response) return response;

      // Navigazione offline senza cache della rotta: ripieghiamo sull'app shell.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
