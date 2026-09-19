import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getAdminUser(request: Request) {
  const raw = request.headers.get("authorization") ?? ""; const token = (raw.toLowerCase().startsWith("bearer ") ? raw.slice(7) : raw).trim();
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

  return { token, userId: user.id };
}

async function r2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBase = trimTrailingSlashes(process.env.R2_PUBLIC_URL ?? "");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
    throw new Error("R2 server configuration is incomplete");
  }

  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return { endpoint: trimTrailingSlashes(endpoint), bucket, publicBase, client };
}

function trimTrailingSlashes(value: string) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

function decodeXml(value: string) {
  return value.split("&amp;").join("&").split("&lt;").join("<").split("&gt;").join(">").split("&quot;").join('"').split("&#39;").join("'");
}

function extractTagValues(xml: string, tag: string) {
  const open = "<" + tag + ">";
  const close = "</" + tag + ">";
  const values: string[] = [];
  let cursor = 0;
  while (true) {
    const start = xml.indexOf(open, cursor);
    if (start < 0) break;
    const valueStart = start + open.length;
    const end = xml.indexOf(close, valueStart);
    if (end < 0) break;
    values.push(xml.slice(valueStart, end));
    cursor = end + close.length;
  }
  return values;
}

function extractTagValue(xml: string, tag: string) {
  return extractTagValues(xml, tag)[0];
}

function normalizeR2Key(key: string) {
  let normalized = key;
  while (normalized.startsWith("/")) normalized = normalized.slice(1);
  const prefix = "shop-assets/";
  if (normalized.slice(0, prefix.length).toLowerCase() === prefix) normalized = normalized.slice(prefix.length);
  return normalized;
}

function fileStem(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function fileExt(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

async function listGiftAssets() {
  const { endpoint, bucket, publicBase, client } = await r2Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const url = new URL(`${endpoint}/${bucket}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1000");
    if (continuationToken) url.searchParams.set("continuation-token", continuationToken);

    const signed = await client.sign(new Request(url.toString(), { method: "GET" }), {
      aws: { signQuery: true },
    });
    const response = await fetch(signed.url);
    if (!response.ok) throw new Error(`R2 list failed: ${response.status}`);

    const xml = await response.text();
    for (const value of extractTagValues(xml, "Key")) keys.push(decodeXml(value));

    const next = extractTagValue(xml, "NextContinuationToken");
    continuationToken = xml.toLowerCase().includes("<istruncated>true</istruncated>") && next ? decodeXml(next) : undefined;
  } while (continuationToken);

  const assets = keys
    .map((key) => normalizeR2Key(key))
    .filter((key) => { const lower = key.toLowerCase(); return lower.startsWith("gift-clips/") || lower.startsWith("gift-thumbs/") || lower.startsWith("gift-audio/"); })
    .map((key) => {
      const filename = key.split("/").pop() ?? key;
      const ext = fileExt(filename);
      const stem = fileStem(filename);
      const lowerKey = key.toLowerCase();
      const kind = lowerKey.startsWith("gift-clips/")
        ? "clip"
        : lowerKey.startsWith("gift-thumbs/")
          ? "thumb"
          : "audio";
      return {
        key,
        filename,
        stem,
        ext,
        kind,
        url: `${publicBase}/${key}`,
      } as const;
    });

  return { assets, publicBase };
}

function recoveredName(stem: string) {
  const clean = stem.split("-").join(" ").split("_").join(" ").trim();
  return clean ? clean.split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : `Recovered Gift ${stem.slice(-6)}`;
}

export const Route = createFileRoute("/api/admin/r2-gifts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const admin = await getAdminUser(request);
        if (!admin) return json({ error: "admin authentication required" }, 401);

        try {
          const { assets } = await listGiftAssets();
          return json({ assets, count: assets.length });
        } catch (e) {
          console.error("[r2-gifts] list failed:", e instanceof Error ? e.message : e);
          return json({ error: "r2_list_failed" }, 500);
        }
      },

      POST: async ({ request }) => {
        const admin = await getAdminUser(request);
        if (!admin) return json({ error: "admin authentication required" }, 401);

        const supabaseUrl =
          process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL ||
          "https://vfuiqjxgyptjqhbmzigk.supabase.co";
        // Supabase requires a project key in `apikey`; the user's JWT belongs
        // only in `Authorization`. Using the JWT as the apikey causes 401.
        const dbKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          "";
        if (!dbKey) throw new Error("Supabase server key is not configured");

        try {
          const { assets } = await listGiftAssets();

          const existingRes = await fetch(
            `${supabaseUrl}/rest/v1/gifts?select=id,name,icon,emoji,price,price_coins,category,animation,sort_order,active,is_active,clip_path,image_url,audio_url,sound_url`,
            {
              headers: {
                apikey: dbKey,
                Authorization: `Bearer ${admin.token}`,
              },
            },
          );
          if (!existingRes.ok) throw new Error(`gift catalog read failed: ${existingRes.status}`);
          const existing = (await existingRes.json()) as Array<Record<string, unknown>>;

          const existingStems = new Set<string>();
          for (const gift of existing) {
            for (const field of ["clip_path", "image_url", "audio_url", "sound_url"]) {
              const value = gift[field];
              if (typeof value !== "string" || !value) continue;
              const filename = value.split("/").pop()?.split("?")[0] ?? "";
      const stem = fileStem(filename);
              if (stem) existingStems.add(stem);
            }
          }

          const groups = new Map<string, typeof assets>();
          for (const asset of assets) {
            const arr = groups.get(asset.stem) ?? [];
            arr.push(asset);
            groups.set(asset.stem, arr);
          }

          const created: string[] = [];
          const skipped: string[] = [];

          for (const [stem, group] of groups) {
            if (existing.some((g) =>
              ["clip_path", "image_url", "audio_url", "sound_url"].some((field) =>
                typeof g[field] === "string" && (g[field] as string).includes(`/${stem}.`),
              ),
            )) {
              skipped.push(stem);
              continue;
            }

            const clip = group.find((a) => a.kind === "clip");
            const thumb = group.find((a) => a.kind === "thumb");
            const audio = group.find((a) => a.kind === "audio");
            const name = recoveredName(stem);

            const payload = {
              name,
              icon: "🎁",
              emoji: "🎁",
              image_url: thumb?.url ?? null,
              price: 100,
              price_coins: 100,
              diamonds_value: 0,
              animation: clip ? "pop" : "none",
              category: "popular",
              sort_order: 9000 + created.length,
              active: true,
              is_active: true,
              clip_path: clip?.url ?? null,
              clip_type: clip ? (clip.ext === "webm" ? "webm" : "mp4") : "none",
              audio_url: audio?.url ?? null,
              audio_enabled: true,
              audio_volume: 1,
            };

            const insertRes = await fetch(`${supabaseUrl}/rest/v1/gifts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Prefer: "return=minimal",
                apikey: dbKey,
                Authorization: `Bearer ${admin.token}`,
              },
              body: JSON.stringify(payload),
            });
            if (!insertRes.ok) {
              const detail = await insertRes.text();
              throw new Error(`failed to recover ${stem}: ${detail.slice(0, 300)}`);
            }
            created.push(name);
          }

          return json({
            ok: true,
            r2Assets: assets.length,
            groups: groups.size,
            recovered: created.length,
            skipped: skipped.length,
            created,
          });
        } catch (e) {
          console.error("[r2-gifts] sync failed:", e instanceof Error ? e.message : e);
          return json({ error: e instanceof Error ? e.message : "r2_sync_failed" }, 500);
        }
      },
    },
  },
});
