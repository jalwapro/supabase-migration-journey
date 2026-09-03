import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";
import { createLiveKitToken } from "@/lib/livekit-token.server";

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

function resolveSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
}

async function verifyBearer(bearer: string): Promise<string | null> {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.SB_JWT_SECRET || process.env.JWT_SECRET;
  if (secret) {
    try {
      const { payload } = await jwtVerify(bearer, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      const sub = typeof payload.sub === "string" ? payload.sub : null;
      if (!sub || (payload.role && payload.role !== "authenticated")) return null;
      return sub;
    } catch {
      return null;
    }
  }

  const serviceKey = process.env.SB_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SECRET_KEY;
  if (!serviceKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(bearer);
  return error || !data?.user ? null : data.user.id;
}

async function canPublish(userId: string, channel: string) {
  const serviceKey = process.env.SB_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SECRET_KEY;
  if (!serviceKey) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("can_publish_in_channel", { _user_id: userId, _channel: channel });
  if (error) {
    console.error("[livekit-token] entitlement check failed", error.message);
    return false;
  }
  return data === true;
}

export const Route = createFileRoute("/api/livekit-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const bearer = auth.replace(/^Bearer\s+/i, "");
        if (!bearer) return json({ error: "unauthorized" }, 401);
        const userId = await verifyBearer(bearer);
        if (!userId) return json({ error: "unauthorized" }, 401);

        let body: { channel?: string; name?: string; publish?: boolean };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const channel = String(body.channel ?? "").trim();
        if (!channel) return json({ error: "channel required" }, 400);

        const requestedPublish = body.publish !== false;
        const allowed = requestedPublish ? await canPublish(userId, channel) : false;
        const livekitUrl = process.env.LIVEKIT_URL;
        if (!livekitUrl) return json({ error: "LIVEKIT_URL is not configured on server" }, 503);

        try {
          const token = await createLiveKitToken({
            identity: userId,
            name: String(body.name ?? userId),
            room: channel,
            canPublish: allowed,
          });
          return json({ token, url: livekitUrl, canPublish: allowed });
        } catch (e) {
          console.error("[livekit-token] mint failed", e);
          return json({ error: e instanceof Error ? e.message : "token failed" }, 500);
        }
      },
    },
  },
});
