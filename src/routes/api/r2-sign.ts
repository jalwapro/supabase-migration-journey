import { createFileRoute } from "@tanstack/react-router";

// Issues a short-lived presigned PUT URL for Cloudflare R2 so browsers can
// upload directly without ever seeing the R2 credentials.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9._/-]/g, "").replace(/\.{2,}/g, "").replace(/^\/+/, "");
}

async function verifyUser(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://vfuiqjxgyptjqhbmzigk.supabase.co";
  const anon =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/r2-sign")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const endpoint = process.env.R2_ENDPOINT;
        const bucket = process.env.R2_BUCKET;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const publicBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

        if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
          return json({ error: "r2_not_configured" }, 503);
        }

        const userId = await verifyUser(request);
        if (!userId) return json({ error: "unauthorized" }, 401);

        let body: { path?: string; contentType?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const path = safeSegment(String(body.path ?? "")).slice(0, 300);
        if (!path) return json({ error: "path required" }, 400);
        const contentType = (body.contentType || "application/octet-stream").slice(0, 120);

        try {
          const { AwsClient } = await import("aws4fetch");
          const client = new AwsClient({
            accessKeyId,
            secretAccessKey,
            service: "s3",
            region: "auto",
          });
          const target = `${endpoint.replace(/\/+$/, "")}/${bucket}/${path}`;
          const signed = await client.sign(
            new Request(`${target}?X-Amz-Expires=900`, { method: "PUT" }),
            { aws: { signQuery: true } },
          );
          return json({
            uploadUrl: signed.url,
            publicUrl: `${publicBase}/${path}`,
            path,
            contentType,
          });
        } catch (e) {
          console.error("r2-sign failed:", e instanceof Error ? e.message : e);
          return json({ error: "sign_failed" }, 500);
        }
      },
    },
  },
});
