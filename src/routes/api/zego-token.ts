import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";

function resolveSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://vfuiqjxgyptjqhbmzigk.supabase.co"
  );
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// SCALE FIX: verify Supabase JWTs locally instead of calling
// `auth.getUser(bearer)` — that hit was a network round-trip to Supabase Auth
// on every ZEGO token mint (every room join / renewal). At 10k concurrent
// users this was a hot bottleneck. Local HS256 verify against
// SUPABASE_JWT_SECRET is microseconds and needs no network.
//
// Falls back to remote verify only if SUPABASE_JWT_SECRET is not configured,
// so existing deployments keep working during the rollout.
async function verifyBearer(bearer: string): Promise<string | null> {
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SB_JWT_SECRET ||
    process.env.JWT_SECRET;
  if (secret) {
    try {
      const { payload } = await jwtVerify(bearer, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      const sub = typeof payload.sub === "string" ? payload.sub : null;
      if (!sub) return null;
      // jose already checks exp/nbf. Require an authenticated role.
      if (payload.role && payload.role !== "authenticated") return null;
      return sub;
    } catch {
      return null;
    }
  }

  // Fallback: remote verify (legacy path).
  const serviceKey =
    process.env.SB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SB_SECRET_KEY;
  if (!serviceKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data?.user) return null;
  return data.user.id;
}

// Must mirror uidFromUuid() in the room UI — the numeric ZEGO uid is derived
// from the Supabase user id, so it can be re-derived and checked server-side.
function uidFromUuid(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 2_000_000_000) + 1;
}

async function canPublish(userId: string, channel: string): Promise<boolean> {
  const serviceKey =
    process.env.SB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SB_SECRET_KEY;
  if (!serviceKey) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("can_publish_in_channel", {
    _user_id: userId,
    _channel: channel,
  });
  if (error) {
    console.error("[zego-token] entitlement check failed", error.message);
    return false;
  }
  return data === true;
}


type DbRtcConfig = { app_id: number | null; server_secret: string | null; server_url: string | null };
let rtcCache: { at: number; value: DbRtcConfig | null } | null = null;

async function loadDbRtcConfig(): Promise<DbRtcConfig | null> {
  if (rtcCache && Date.now() - rtcCache.at < 30_000) return rtcCache.value;
  const serviceKey =
    process.env.SB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SB_SECRET_KEY;
  if (!serviceKey) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(resolveSupabaseUrl(), serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await sb
      .from("rtc_credentials")
      .select("app_id,server_secret,server_url")
      .eq("id", true)
      .maybeSingle();
    const value = (data as DbRtcConfig | null) ?? null;
    rtcCache = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}


export const Route = createFileRoute("/api/zego-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        // Admin-panel credentials win over env secrets, so keys can be
        // rotated from the dashboard without a redeploy.
        const db = await loadDbRtcConfig();
        const appIdRaw = db?.app_id ? String(db.app_id) : process.env.ZEGO_APP_ID;
        const serverSecret = db?.server_secret || process.env.ZEGO_SERVER_SECRET;
        if (!appIdRaw || !serverSecret) {
          console.error("[zego-token] ZEGO_APP_ID / ZEGO_SERVER_SECRET missing");
          return json({ error: "ZEGO not configured on server" }, 503);
        }
        const appId = Number(appIdRaw);
        if (!Number.isFinite(appId) || appId <= 0) {
          return json({ error: "ZEGO_APP_ID must be a positive integer" }, 500);
        }


        let body: {
          channel?: string;
          uid?: number | string;
          role?: "publisher" | "audience";
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const channel = String(body.channel ?? "").trim();
        const uidStr = String(body.uid ?? "").trim();
        const roleName = body.role === "audience" ? "audience" : "publisher";
        if (!channel || !uidStr) return json({ error: "channel and uid required" }, 400);

        // Verify caller is signed in — local JWT verify (no network hop).
        const auth = request.headers.get("authorization") ?? "";
        const bearer = auth.replace(/^Bearer\s+/i, "");
        if (!bearer) return json({ error: "unauthorized" }, 401);
        const callerId = await verifyBearer(bearer);
        if (!callerId) return json({ error: "unauthorized" }, 401);

        // The uid is derived from the caller's user id — a client may not mint a
        // token that impersonates another user's stream.
        if (uidStr !== String(uidFromUuid(callerId))) {
          return json({ error: "uid mismatch" }, 403);
        }

        // Publishing is an entitlement (host / seated / PK opponent / moderator),
        // never something the client can simply ask for. Unentitled callers are
        // silently downgraded to audience so viewing still works.
        let effectiveRole: "publisher" | "audience" = roleName;
        if (effectiveRole === "publisher") {
          const allowed = await canPublish(callerId, channel);
          if (!allowed) effectiveRole = "audience";
        }

        const expireSeconds = 3600;

        const { generateZegoToken04 } = await import("@/lib/zego-token.server");
        let out: { token: string; expire: number };
        try {
          out = generateZegoToken04(
            appId,
            uidStr,
            serverSecret,
            expireSeconds,
            channel,
            { login: true, publish: effectiveRole === "publisher" },
          );
        } catch (e) {
          console.error("[zego-token] generate failed", e);
          return json({ error: e instanceof Error ? e.message : "token failed" }, 500);
        }

        // Server URL: ZEGO Console value when configured; modern Web SDKs can
        // discover the endpoint with an empty string, so don't guess a URL.
        const serverUrl =
          process.env.ZEGO_SERVER_URL?.trim() ||
          "";

        return json({
          appId,
          token: out.token,
          uid: uidStr,
          channel,
          server: serverUrl,
          expiresAt: out.expire,
        });
      },
    },
  },
});
