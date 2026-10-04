const CACHE_NAME = "jalwa-assets-v1";
const MANAGED = /\.(mp4|webm|mov|svga|svg|png|jpe?g|gif|webp|avif|mp3|wav|ogg|m4a)(\?.*)?$/i;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !MANAGED.test(url.pathname + url.search)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch {
      return hit || Response.error();
    }
  })());
});
