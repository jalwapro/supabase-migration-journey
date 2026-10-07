const CACHE_NAME = "jalwa-assets-v1";
const MANAGED = /\.(mp4|webm|mov|svga|svg|png|jpe?g|gif|webp|avif|mp3|wav|ogg|m4a)(\?.*)?$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

function isRange(request) {
  return request.headers.has("range");
}

async function fullResponse(request, cache) {
  const hit = await cache.match(new Request(request.url, { method: "GET" }));
  if (hit) return hit;
  const networkRequest = new Request(request.url, {
    method: "GET",
    headers: new Headers([...request.headers].filter(([key]) => key.toLowerCase() !== "range")),
    mode: request.mode,
    credentials: request.credentials,
    redirect: request.redirect,
  });
  const response = await fetch(networkRequest);
  if (response.ok && response.type !== "opaque") {
    await cache.put(new Request(request.url), response.clone());
  }
  return response;
}

async function rangeResponse(request, full) {
  const range = request.headers.get("range");
  if (!range || !full.ok) return full;

  const match = /^bytes=(\d+)-(\d*)$/i.exec(range.trim());
  if (!match) return full;

  const total = Number(full.headers.get("content-length") || 0);
  if (!Number.isFinite(total) || total <= 0) return full;

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : total - 1;
  if (start >= total) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }

  const end = Math.min(requestedEnd, total - 1);
  const buffer = await full.arrayBuffer();
  const body = buffer.slice(start, end + 1);
  const headers = new Headers(full.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(body.byteLength));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Type", full.headers.get("Content-Type") || "application/octet-stream");
  return new Response(body, { status: 206, statusText: "Partial Content", headers });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!/^https?:$/.test(url.protocol) || !MANAGED.test(url.pathname + url.search)) return;

  const forceRefresh =
    request.cache === "no-store" ||
    request.headers.get("cache-control")?.includes("no-cache");

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      if (forceRefresh) {
        const response = await fetch(request);
        if (response.ok && response.type !== "opaque" && !isRange(request)) {
          event.waitUntil(cache.put(new Request(request.url), response.clone()));
        }
        return response;
      }

      // Range responses cannot themselves be stored as reusable full assets.
      // Resolve them against one cached full response instead, then return the
      // exact 206 slice the media element requested.
      if (isRange(request)) {
        const full = await fullResponse(request, cache);
        return await rangeResponse(request, full);
      }

      const hit = await cache.match(request);
      if (hit) return hit;

      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch {
      return (await cache.match(request)) || Response.error();
    }
  })());
});
