import { createFileRoute } from "@tanstack/react-router";
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

function getServiceKey() {
  return process.env.SB_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SECRET_KEY;
}

async function verifyBearer(bearer: string): Promise<string | null> {
  // Always validate the user's Supabase access token through Supabase Auth.
  // Do not locally assume the JWT signing algorithm/secret: Supabase projects
  // can use different signing configurations, and getUser() validates the
  // actual access token against the Auth service.
  const serviceKey = getServiceKey();
  if (!serviceKey) {
    throw new Error("Supabase server authorization key is not configured");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data?.user) {
    console.error("[livekit-token] Supabase access-token validation failed", error?.message ?? "user not found");
    return null;
  }
  return data.user.id;
}

async function canPublish(userId: string, channel: string) {
  const serviceKey = getServiceKey();
  if (!serviceKey) throw new Error("Supabase server authorization key is not configured");

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("can_publish_in_channel", {
    _user_id: userId,
    _channel: channel,
  });
  if (error) {
    console.error("[livekit-token] entitlement check failed", error.message);
    throw new Error(`channel permission check failed: ${error.message}`);
  }
  return data === true;
}

export const Route = createFileRoute("/api/livekit-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const bearer = auth.replace(/^Bearer\s+/i, "").trim();
          if (!bearer) return json({ error: "unauthorized" }, 401);

          const userId = await verifyBearer(bearer);
          if (!userId) return json({ error: "invalid Supabase access token" }, 401);

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

          const livekitUrl = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL;
          if (!livekitUrl) {
            console.error("[livekit-token] LIVEKIT_URL is not configured");
            return json({ error: "LIVEKIT_URL is not configured on server" }, 503);
          }

          const token = await createLiveKitToken({
            identity: userId,
            name: String(body.name ?? userId),
            room: channel,
            canPublish: allowed,
          });

          return json({ token, url: livekitUrl, canPublish: allowed });
        } catch (e) {
          console.error("[livekit-token] request failed", e);
          return json({ error: e instanceof Error ? e.message : "LiveKit token request failed" }, 500);
        }
      },
    },
  },
});