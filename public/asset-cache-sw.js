const CACHE_ASSETS = "jalwa-assets-v1"; // Must match src/lib/assetCache.ts
const CACHE_LEGACY_ASSETS = "jalwa-assets-v2"; // Preserve assets cached by older workers
const CACHE_SHELL = "jalwa-shell-v2";
const CACHE_PUBLIC_DATA = "jalwa-public-data-v1";
const CACHE_PUBLIC_DATA = "jalwa-public-data-v1";
const PUBLIC_MANIFEST_PATH = "/api/public/asset-manifest";

// Static assets regex: JS chunks, CSS, fonts, images, audio, video
const MANAGED_MEDIA = /\.(mp4|webm|mov|svga|svg|png|jpe?g|gif|webp|avif|mp3|wav|ogg|m4a)(\?.*)?$/i;
const MANAGED_CODE = /\.(js|css|woff2?|ttf|otf)(\?.*)?$/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Seed an offline-capable app shell during the first successful online install.
  // This is best-effort: the worker must still install if the network is unavailable.
  event.waitUntil((async () => {
    try {
      const shellCache = await caches.open(CACHE_SHELL);
      const shellUrl = new URL("/", self.location.origin).toString();
      const response = await fetch(shellUrl, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok || response.type === "opaque") return;
      const html = await response.clone().text();
      await shellCache.put(shellUrl, response.clone());

      // Cache JS/CSS referenced by the first Home HTML for the next offline launch.
      const assetUrls = new Set();
      const assetPattern = /(?:src|href)=["']([^"'#]+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
      let match;
      while ((match = assetPattern.exec(html)) !== null) {
        try {
          const assetUrl = new URL(match[1], shellUrl);
          if (assetUrl.origin === self.location.origin && /\.(js|css)(\?|$)/i.test(assetUrl.href)) {
            assetUrls.add(assetUrl.toString());
          }
        } catch {}
      }
      await Promise.all([...assetUrls].map(async (assetUrl) => {
        try {
          const assetResponse = await fetch(assetUrl, { credentials: "same-origin" });
          if (assetResponse.ok && assetResponse.type !== "opaque") {
            await shellCache.put(assetUrl, assetResponse);
          }
        } catch {}
      }));
    } catch {}
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_ASSETS && key !== CACHE_LEGACY_ASSETS && key !== CACHE_SHELL && key !== CACHE_PUBLIC_DATA) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache only the public, non-user-specific asset catalog. All other APIs
  // (especially auth, balances, messages, room counts, and LiveKit) bypass caching.
  if (url.origin === self.location.origin && url.pathname === "/api/public/asset-manifest") {
    const cacheName = "jalwa-public-data-v1";
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(async (response) => {
        const type = response.headers.get("content-type") || "";
        if (response.status === 200 && response.type !== "opaque" && type.includes("application/json")) {
          await cache.put(request, response.clone());
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
        return cached;
      }
      try {
        return await refresh;
      } catch {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "X-Jalwa-Offline": "1" },
        });
      }
    })());
    return;
  }

  // Skip API calls, livekit, Supabase REST, and WebSocket connections
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/realtime/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("livekit")
  ) {
    return;
  }

  // 0. Native Android cold start: return the last cached Home shell immediately.
  // Only "/" is cache-first because it is the app shell; other route HTML can be
  // user-specific and remains network-first. Refresh the shell in the background.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_SHELL);
      const isHome = url.origin === self.location.origin && url.pathname === "/" && !url.search;
      if (isHome) {
        const cachedHome = await cache.match(new URL("/", self.location.origin).toString());
        const refreshHome = fetch(request).then(async (response) => {
          if (response.ok && response.type !== "opaque") {
            await cache.put(new URL("/", self.location.origin).toString(), response.clone());
          }
          return response;
        });
        event.waitUntil(refreshHome.then(() => undefined).catch(() => undefined));
        if (cachedHome) return cachedHome;
        try { return await refreshHome; } catch {}
      }
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== "opaque") {
          event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
        }
        return response;
      } catch {
        const exact = await cache.match(request);
        if (exact) return exact;
        const home = await cache.match(new URL("/", self.location.origin).toString());
        if (home) return home;
        return new Response(
          "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#1a0d2e\"><title>JALWA Offline</title></head><body style=\"margin:0;background:#100819;color:white;font:16px system-ui;display:grid;min-height:100vh;place-items:center;text-align:center\"><main style=\"padding:24px\"><h1>JALWA</h1><p>Open JALWA once with internet to prepare offline files, then try again.</p><button onclick=\"location.reload()\" style=\"padding:12px 20px;border:0;border-radius:12px\">Retry</button></main></body></html>",
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  // 1. Audio / Video Partial Range Requests (206)
  if (request.headers.has("range")) {
    if (!MANAGED_MEDIA.test(url.pathname + url.search)) return;

    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_ASSETS);
          const cacheKey = new Request(request.url, { method: "GET" });
          let cached = await cache.match(cacheKey);
          if (!cached) {
            // Older app versions cached media in v2; keep it playable during migration.
            cached = await (await caches.open(CACHE_LEGACY_ASSETS)).match(cacheKey);
          }
          if (!cached || cached.status !== 200) return fetch(request);

          const range = request.headers.get("range") || "";
          const match = range.match(/^bytes=(\d*)-(\d*)$/);
          if (!match) return fetch(request);

          const cachedLength = Number(cached.headers.get("content-length") || 0);
          const MAX_RANGE_SLICE_BYTES = 24 * 1024 * 1024;
          if (!Number.isFinite(cachedLength) || cachedLength <= 0 || cachedLength > MAX_RANGE_SLICE_BYTES) {
            return fetch(request);
          }

          if (!match[1] && !match[2]) return fetch(request);
          const blob = await cached.blob();

          const suffixLength = !match[1] && match[2] ? Number(match[2]) : null;
          const start = suffixLength !== null ? Math.max(blob.size - suffixLength, 0) : Number(match[1] || 0);
          const end = match[2] && suffixLength === null ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;

          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= blob.size ||
            (suffixLength !== null && (!Number.isSafeInteger(suffixLength) || suffixLength <= 0))
          ) {
            return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${blob.size}` } });
          }

          const part = blob.slice(start, end + 1);
          const headers = new Headers(cached.headers);
          headers.delete("Content-Encoding");
          headers.set("Accept-Ranges", "bytes");
          headers.set("Content-Length", String(part.size));
          headers.set("Content-Range", `bytes ${start}-${end}/${blob.size}`);
          return new Response(part, { status: 206, statusText: "Partial Content", headers });
        } catch {
          return fetch(request);
        }
      })()
    );
    return;
  }

  // 2. Vite Hashed JS / CSS / Fonts -> Cache-First (Instant Offline Disk Load)
  const isViteAsset = url.pathname.startsWith("/assets/") && MANAGED_CODE.test(url.pathname);
  if (isViteAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_SHELL);
        const hit = await cache.match(request);
        if (hit) return hit;

        try {
          const response = await fetch(request);
          if (response.status === 200 && response.type !== "opaque") {
            event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
          }
          return response;
        } catch {
          return hit || Response.error();
        }
      })()
    );
    return;
  }

  // 3. Media Assets (Images, Sounds, Animations, SVGA) -> Local Cache First
  if (MANAGED_MEDIA.test(url.pathname + url.search)) {
    const forceRefresh =
      request.cache === "no-store" || request.headers.get("cache-control")?.includes("no-cache");

    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ASSETS);

        if (forceRefresh) {
          try {
            const response = await fetch(request);
            if (response.status === 200 && response.type !== "opaque") {
              event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
            }
            return response;
          } catch {
            const hit = await cache.match(request);
            if (hit) return hit;
            return (await (await caches.open(CACHE_LEGACY_ASSETS)).match(request)) || Response.error();
          }
        }

        const hit = await cache.match(request);
        if (hit) return hit;
        const legacyHit = await (await caches.open(CACHE_LEGACY_ASSETS)).match(request);
        if (legacyHit) {
          // Promote legacy entries so subsequent requests use the unified cache.
          event.waitUntil(cache.put(request, legacyHit.clone()).catch(() => undefined));
          return legacyHit;
        }

        try {
          const response = await fetch(request);
          if (response.status === 200 && response.type !== "opaque") {
            event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
          }
          return response;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }
});
