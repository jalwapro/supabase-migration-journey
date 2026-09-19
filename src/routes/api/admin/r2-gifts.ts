import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getAdminToken(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!anon) return null;

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return null;

  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return null;

  const adminRes = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
    body: JSON.stringify({ _user_id: user.id }),
  });
  if (!adminRes.ok || (await adminRes.json()) !== true) return null;

  return token;
}

export const Route = createFileRoute("/api/admin/r2-gifts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const token = await getAdminToken(request);
        if (!token) return json({ error: "admin authentication required" }, 401);

        const endpoint = process.env.R2_ENDPOINT;
        const bucket = process.env.R2_BUCKET;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const publicBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

        if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
          return json({ error: "R2 server configuration is incomplete" }, 503);
        }

        try {
          const { AwsClient } = await import("aws4fetch");
          const client = new AwsClient({
            accessKeyId,
            secretAccessKey,
            service: "s3",
            region: "auto",
          });

          const url = new URL(`${endpoint.replace(/\/+$/, "")}/${bucket}`);
          url.searchParams.set("list-type", "2");
          url.searchParams.set("prefix", "gift-");
          url.searchParams.set("max-keys", "1000");

          const signed = await client.sign(new Request(url.toString(), { method: "GET" }), {
            aws: { signQuery: true },
          });
          const response = await fetch(signed.url);
          if (!response.ok) return json({ error: `R2 list failed: ${response.status}` }, 502);

          const xml = await response.text();
          const keys = [...xml.matchAll(/<Key>([\\s\\S]*?)<\\/Key>/g)].map((m) =>
            m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          );

          const assets = keys
            .filter((key) => /^(gift-clips|gift-thumbs|gift-audio)\//i.test(key))
            .map((key) => {
              const filename = key.split("/").pop() ?? key;
              const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
              const stem = filename.replace(/\.[^.]+$/, "");
              const kind = /^gift-clips\//i.test(key) ? "clip" : /^gift-thumbs\//i.test(key) ? "thumb" : "audio";
              return {
                key,
                filename,
                stem,
                ext,
                kind,
                url: `${publicBase}/${key}`,
              };
            });

          return json({ assets, count: assets.length });
        } catch (e) {
          console.error("[r2-gifts] list failed:", e instanceof Error ? e.message : e);
          return json({ error: "r2_list_failed" }, 500);
        }
      },
    },
  },
});
