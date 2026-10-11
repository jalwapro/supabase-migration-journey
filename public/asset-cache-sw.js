const CACHE_NAME = "jalwa-assets-v1";
const MANAGED = /\.(mp4|webm|mov|svga|svg|png|jpe?g|gif|webp|avif|mp3|wav|ogg|m4a)(\?.*)?$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Serve byte ranges from a previously cached complete asset when possible.
  // Never write the resulting 206 response back to Cache Storage.
  if (request.headers.has("range")) {
    if (!/^https?:$/.test(new URL(request.url).protocol) || !MANAGED.test(new URL(request.url).pathname + new URL(request.url).search)) return;
    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(new Request(request.url, { method: "GET" }));
        if (!cached || cached.status !== 200) return fetch(request);
        const range = request.headers.get("range") || "";
        const match = range.match(/^bytes=(\d*)-(\d*)$/);
        if (!match) return fetch(request);
        const blob = await cached.blob();
        if (!match[1] && !match[2]) return fetch(request);
        // Support normal ranges (bytes=100-), bounded ranges (bytes=100-500),
        // and suffix ranges (bytes=-500) used by some media players.
        const suffixLength = !match[1] && match[2] ? Number(match[2]) : null;
        const start = suffixLength !== null ? Math.max(blob.size - suffixLength, 0) : Number(match[1] || 0);
        const end = match[2] && suffixLength === null ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= blob.size || (suffixLength !== null && suffixLength <= 0)) {
          return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${blob.size}` } });
        }
        const part = blob.slice(start, end + 1);
        const headers = new Headers(cached.headers);
        // The cached body is already decoded by Fetch; do not forward stale
        // encoding/length headers from the original full response.
        headers.delete("Content-Encoding");
        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Length", String(part.size));
        headers.set("Content-Range", `bytes ${start}-${end}/${blob.size}`);
        return new Response(part, { status: 206, statusText: "Partial Content", headers });
      } catch {
        return fetch(request);
      }
    })());
    return;
  }

  const url = new URL(request.url);
  if (!/^https?:$/.test(url.protocol) || !MANAGED.test(url.pathname + url.search)) return;

  const forceRefresh =
    request.cache === "no-store" ||
    request.headers.get("cache-control")?.includes("no-cache");

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // AssetCache uses no-store when a manifest version changed.
    // Bypass the local hit in that case so the new file can replace it.
    if (forceRefresh) {
      try {
        const response = await fetch(request);
        if (response.status === 200 && response.type !== "opaque") {
          event.waitUntil(cache.put(request, response.clone()).catch((error) => {
            console.warn("[AssetCache] Cache write skipped", error);
          }));
        }
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    }

    // Normal app media requests are strictly local-first.
    const hit = await cache.match(request);
    if (hit) return hit;

    try {
      const response = await fetch(request);
      if (response.status === 200 && response.type !== "opaque") {
        event.waitUntil(cache.put(request, response.clone()).catch((error) => {
          console.warn("[AssetCache] Cache write skipped", error);
        }));
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
