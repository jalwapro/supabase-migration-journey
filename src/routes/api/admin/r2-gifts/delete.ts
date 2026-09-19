import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getAdmin(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!anon) return null;
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return null;
  const adminRes = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: anon },
    body: JSON.stringify({ _user_id: user.id }),
  });
  if (!adminRes.ok || (await adminRes.json()) !== true) return null;
  return { id: user.id, token };
}

async function getR2() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2 server configuration is incomplete");
  const { AwsClient } = await import("aws4fetch");
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
  };
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export const Route = createFileRoute("/api/admin/r2-gifts/delete")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      DELETE: async ({ request }) => {
        const admin = await getAdmin(request);
        if (!admin) return json({ error: "admin authentication required" }, 401);

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
        const dbKey = admin.token;

        let id = "";
        try {
          id = ((await request.json()) as { id?: string }).id ?? "";
        } catch {}
        if (!id) return json({ error: "gift id required" }, 400);

        try {
          const giftRes = await fetch(
            `${supabaseUrl}/rest/v1/gifts?id=eq.${encodeURIComponent(id)}&select=id,clip_path,image_url,audio_url,sound_url`,
            { headers: { apikey: dbKey, Authorization: `Bearer ${dbKey}` } },
          );
          if (!giftRes.ok) return json({ error: `gift lookup failed: ${giftRes.status}` }, 502);
          const gifts = (await giftRes.json()) as Array<Record<string, unknown>>;
          const gift = gifts[0];
          if (!gift) return json({ error: "gift not found" }, 404);

          const stems = new Set<string>();
          for (const field of ["clip_path", "image_url", "audio_url", "sound_url"]) {
            const value = gift[field];
            if (typeof value !== "string" || !value) continue;
            const filename = value.split("/").pop()?.split("?")[0] ?? "";
            const stem = filename.replace(/\.[^.]+$/, "");
            if (stem) stems.add(stem);
          }

          // Delete only after the DB deletion succeeds. If the DB rejects the delete
          // (for example because a historical gift send still references it), R2 stays intact.
          const deleteDb = await fetch(
            `${supabaseUrl}/rest/v1/gifts?id=eq.${encodeURIComponent(id)}`,
            {
              method: "DELETE",
              headers: {
                apikey: dbKey,
                Authorization: `Bearer ${dbKey}`,
                Prefer: "return=minimal",
              },
            },
          );
          if (!deleteDb.ok) {
            const detail = await deleteDb.text();
            return json({ error: `gift delete failed: ${detail.slice(0, 300)}` }, 409);
          }

          if (!stems.size) return json({ ok: true, deletedGift: id, deletedR2: 0 });

          const { endpoint, bucket, client } = await getR2();
          let token: string | undefined;
          const removed: string[] = [];

          do {
            const listUrl = new URL(`${endpoint}/${bucket}`);
            listUrl.searchParams.set("list-type", "2");
            listUrl.searchParams.set("max-keys", "1000");
            if (token) listUrl.searchParams.set("continuation-token", token);

            const signedList = await client.sign(
              new Request(listUrl.toString(), { method: "GET" }),
              { aws: { signQuery: true } },
            );
            const listRes = await fetch(signedList.url);
            if (!listRes.ok) throw new Error(`R2 list failed: ${listRes.status}`);

            const xml = await listRes.text();
            const keys = [...xml.matchAll(/<Key>([\\s\\S]*?)<\\/Key>/g)].map((m) => decodeXml(m[1]));

            for (const rawKey of keys) {
              const key = rawKey.replace(/^\\/+/, "").replace(/^shop-assets\\//i, "");
              if (!/^(?:gift-clips|gift-thumbs|gift-audio)\\//i.test(key)) continue;

              const filename = key.split("/").pop() ?? "";
              const stem = filename.replace(/\\.[^.]+$/, "");
              if (!stems.has(stem)) continue;

              const deleteUrl = new URL(
                `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
              );
              const signedDelete = await client.sign(
                new Request(deleteUrl.toString(), { method: "DELETE" }),
              );
              const deleteRes = await fetch(signedDelete.url);
              if (!deleteRes.ok) throw new Error(`R2 delete failed for ${key}: ${deleteRes.status}`);
              removed.push(key);
            }

            const next = xml.match(/<NextContinuationToken>([\\s\\S]*?)<\\/NextContinuationToken>/)?.[1];
            token = /<IsTruncated>true<\\/IsTruncated>/i.test(xml) && next ? decodeXml(next) : undefined;
          } while (token);

          return json({ ok: true, deletedGift: id, deletedR2: removed.length, keys: removed });
        } catch (e) {
          console.error("[r2-gifts/delete] failed:", e instanceof Error ? e.message : e);
          return json({ error: e instanceof Error ? e.message : "gift_delete_failed", partial: true }, 500);
        }
      },
    },
  },
});
