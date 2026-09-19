import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOST_SUFFIX = ".r2.dev";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag",
  };
}

function isAllowedR2Url(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(ALLOWED_HOST_SUFFIX) &&
      url.pathname.toLowerCase().includes("/gift-clips/")
    );
  } catch {
    return false;
  }
}

function responseHeaders(source: Response) {
  const headers = new Headers(corsHeaders());
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "cache-control",
    "last-modified",
  ]) {
    const value = source.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", source.headers.get("cache-control") ?? "public, max-age=3600");
  return headers;
}

export const Route = createFileRoute("/api/gift-media")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders() }),

      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        if (!raw || !isAllowedR2Url(raw)) {
          return new Response("Invalid gift media URL", {
            status: 400,
            headers: corsHeaders(),
          });
        }

        const headers = new Headers();
        const range = request.headers.get("range");
        if (range) headers.set("Range", range);

        try {
          const upstream = await fetch(raw, {
            method: "GET",
            headers,
            redirect: "error",
          });

          const outHeaders = responseHeaders(upstream);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: outHeaders,
          });
        } catch (error) {
          console.error(
            "[gift-media] upstream fetch failed:",
            error instanceof Error ? error.message : error,
          );
          return new Response("Gift media unavailable", {
            status: 502,
            headers: corsHeaders(),
          });
        }
      },

      HEAD: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        if (!raw || !isAllowedR2Url(raw)) {
          return new Response(null, { status: 400, headers: corsHeaders() });
        }

        try {
          const upstream = await fetch(raw, { method: "HEAD", redirect: "error" });
          return new Response(null, {
            status: upstream.status,
            headers: responseHeaders(upstream),
          });
        } catch {
          return new Response(null, { status: 502, headers: corsHeaders() });
        }
      },
    },
  },
});
