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

// Allow-list of uploadable asset types with per-kind size caps (bytes).
const ALLOWED: Record<string, { mime: string[]; max: number }> = {
  mp4: { mime: ["video/mp4"], max: 80 * 1024 * 1024 },
  webm: { mime: ["video/webm"], max: 80 * 1024 * 1024 },
  mov: { mime: ["video/quicktime"], max: 80 * 1024 * 1024 },
  png: { mime: ["image/png"], max: 15 * 1024 * 1024 },
  jpg: { mime: ["image/jpeg"], max: 15 * 1024 * 1024 },
  jpeg: { mime: ["image/jpeg"], max: 15 * 1024 * 1024 },
  webp: { mime: ["image/webp"], max: 15 * 1024 * 1024 },
  gif: { mime: ["image/gif"], max: 15 * 1024 * 1024 },
  svg: { mime: ["image/svg+xml"], max: 4 * 1024 * 1024 },
  json: { mime: ["application/json", "text/plain"], max: 10 * 1024 * 1024 },
  svga: { mime: ["application/octet-stream"], max: 25 * 1024 * 1024 },
  mp3: { mime: ["audio/mpeg", "audio/mp3"], max: 20 * 1024 * 1024 },
  wav: { mime: ["audio/wav", "audio/x-wav"], max: 30 * 1024 * 1024 },
  ogg: { mime: ["audio/ogg"], max: 20 * 1024 * 1024 },
  aac: { mime: ["audio/aac"], max: 20 * 1024 * 1024 },
  m4a: { mime: ["audio/mp4", "audio/x-m4a"], max: 20 * 1024 * 1024 },
  webp2: { mime: ["image/webp"], max: 15 * 1024 * 1024 },
  bin: { mime: ["application/octet-stream"], max: 25 * 1024 * 1024 },
};

function validateUpload(path: string, contentType: string, size?: number) {
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  const rule = ALLOWED[ext];
  if (!rule) return `unsupported file type: .${ext || "unknown"}`;
  const ct = contentType.split(";")[0]!.trim().toLowerCase();
  if (ct && ct !== "application/octet-stream" && !rule.mime.includes(ct)) {
    return `content-type ${ct} does not match .${ext}`;
  }
  if (typeof size === "number" && size > rule.max) {
    return `file too large: ${(size / 1048576).toFixed(1)}MB (max ${Math.round(rule.max / 1048576)}MB)`;
  }
  return null;
}

function supabaseEnv() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://vfuiqjxgyptjqhbmzigk.supabase.co";
  const anon =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  return { url, anon };
}

async function verifyUser(request: Request): Promise<{ id: string; token: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const { url, anon } = supabaseEnv();
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user?.id ? { id: user.id, token } : null;
  } catch {
    return null;
  }
}

/** Server-side admin check — never trust a client-supplied role claim. */
async function isAdmin(userId: string, token: string): Promise<boolean> {
  const { url, anon } = supabaseEnv();
  try {
    const res = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({ _user_id: userId }),
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

/**
 * Shared namespaces hold catalogue media (gifts, frames, entrances, banners…)
 * that every user reads. Only admins may write there — otherwise any signed-in
 * account could overwrite a live gift or splash asset.
 */
const ADMIN_ONLY_PREFIXES = [
  "shop-assets",
  "gifts",
  "frames",
  "entrances",
  "entrance-effects",
  "banners",
  "splash",
  "ads",
  "poster",
  "room-bg",
  "video",
  "themes",
  "theme-categories",
  "spotlights",
  "room-frames",
  "profile-cards",
  "vip",
  "emoji",
  "admin",
];

/** Buckets whose objects are namespaced per user: `<bucket>/<userId>/...`. */
const USER_SCOPED_PREFIXES = [
  "avatars",
  "gallery",
  "chat-media",
  "voice-notes",
  "moments",
  "proofs",
  "kyc",
];

/** Returns an error string when this user may not write to `path`. */
function authorizeWrite(path: string, userId: string, admin: boolean): string | null {
  if (admin) return null;
  const [bucket, second] = path.split("/");
  if (!bucket) return "path required";
  // Shared catalogue root is admin-only, but a user may still own a personal
  // sub-folder inside it (e.g. shop-assets/<uid>/custom-themes/...).
  if (ADMIN_ONLY_PREFIXES.includes(bucket)) {
    return second === userId ? null : "admin_only_namespace";
  }
  if (USER_SCOPED_PREFIXES.includes(bucket)) {
    return second === userId ? null : "path_outside_your_folder";
  }
  // Unknown namespace: force it under the user's own folder.
  return second === userId ? null : "path_outside_your_folder";
}


export const Route = createFileRoute("/api/r2-sign")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const endpoint = process.env['R2_ENDPOINT'];
        const bucket = process.env['R2_BUCKET'];
        const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
        const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];
        const publicBase = (process.env['R2_PUBLIC_URL'] ?? "").replace(/\/+$/, "");

        const missing = [
          ["R2_ENDPOINT", endpoint],
          ["R2_BUCKET", bucket],
          ["R2_ACCESS_KEY_ID", accessKeyId],
          ["R2_SECRET_ACCESS_KEY", secretAccessKey],
          ["R2_PUBLIC_URL", publicBase],
        ].filter(([, v]) => !v).map(([k]) => k);

        if (missing.length) {
          console.error("[r2-sign] missing env:", missing.join(", "));
          return json(
            {
              error: `Cloud storage is not configured on the server (missing: ${missing.join(", ")}). Add these keys and redeploy.`,
              code: "r2_not_configured",
              missing,
            },
            503,
          );
        }
        const r2Endpoint = endpoint as string;
        const r2Bucket = bucket as string;
        const r2Key = accessKeyId as string;
        const r2Secret = secretAccessKey as string;



        const user = await verifyUser(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: { path?: string; contentType?: string; op?: string; size?: number };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const path = safeSegment(String(body.path ?? "")).slice(0, 300);
        if (!path) return json({ error: "path required" }, 400);
        const contentType = (body.contentType || "application/octet-stream").slice(0, 120);
        const op = body.op === "get" ? "get" : "put";

        if (op === "put") {
          const invalid = validateUpload(path, contentType, body.size);
          if (invalid) return json({ error: invalid }, 400);
          // Namespace authorization: shared catalogue media is admin-only and
          // everything else must live under the caller's own user folder.
          let denied = authorizeWrite(path, user.id, false);
          if (denied && (await isAdmin(user.id, user.token))) denied = null;
          if (denied) return json({ error: denied }, 403);
        }

        try {
          const { AwsClient } = await import("aws4fetch");
          const client = new AwsClient({
            accessKeyId,
            secretAccessKey,
            service: "s3",
            region: "auto",
          });
          const target = `${endpoint.replace(/\/+$/, "")}/${bucket}/${path}`;
          if (op === "get") {
            // Short-lived read URL for private assets (voice notes, proofs).
            const signedGet = await client.sign(
              new Request(`${target}?X-Amz-Expires=3600`, { method: "GET" }),
              { aws: { signQuery: true } },
            );
            return json({ url: signedGet.url, path, expiresIn: 3600 });
          }
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
