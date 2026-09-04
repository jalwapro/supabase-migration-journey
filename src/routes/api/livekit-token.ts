import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";
import { AccessToken } from "livekit-server-sdk";

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

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
}

function serviceKey() {
  return process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;
}

async function verifyBearer(token: string): Promise<string | null> {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.SB_JWT_SECRET || process.env.JWT_SECRET;
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      return typeof payload.sub === "string" && (!payload.role || payload.role === "authenticated") ? payload.sub : null;
    } catch {
      return null;
    }
  }

  const key = serviceKey();
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export const Route = createFileRoute("/api/livekit-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const wsUrl = (process.env.LIVEKIT_URL || "").trim();

        if (!apiKey || !apiSecret || !wsUrl) {
          return json({ error: "LiveKit is not configured on the server" }, 503);
        }
        if (!/^wss?:\/\//i.test(wsUrl)) {
          return json({ error: "LIVEKIT_URL must start with ws:// or wss://" }, 500);
        }

        let body: { room?: string; name?: string; canPublish?: boolean };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const roomId = String(body.room ?? "").trim();
        if (!roomId || roomId.length > 128) return json({ error: "room is required" }, 400);

        // Authentication is optional for the Voice Room connection. If a valid
        // Supabase session is present, use the real user identity and existing
        // room permissions. Otherwise issue a short-lived guest/test identity
        // so the LiveKit connection does not fail with 401.
        const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        let userId: string | null = null;
        if (bearer) userId = await verifyBearer(bearer);

        const key = serviceKey();
        if (!key) return json({ error: "Supabase service key is not configured" }, 503);
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });

        const { data: room, error: roomError } = await sb
          .from("live_rooms")
          .select("id,host_id,status,room_type")
          .eq("id", roomId)
          .maybeSingle();
        if (roomError || !room) return json({ error: "room not found" }, 404);
        if (room.status !== "live") return json({ error: "room is not live" }, 409);

        let isHost = false;
        let seated = false;
        let moderator = false;
        let isMuted = false;

        if (userId) {
          const { data: member } = await sb
            .from("room_members")
            .select("seat_index,is_moderator,is_muted")
            .eq("room_id", roomId)
            .eq("user_id", userId)
            .maybeSingle();

          isHost = room.host_id === userId;
          seated = member?.seat_index !== null && member?.seat_index !== undefined;
          moderator = member?.is_moderator === true;
          isMuted = member?.is_muted === true;
        }

        const requestedPublish = body.canPublish !== false;
        // Authenticated users keep the existing permission model. Guests are
        // allowed to publish for the voice-room/test flow so they can speak,
        // but receive a short-lived token and have no admin permissions.
        const canPublish = userId
          ? requestedPublish && (isHost || seated || moderator) && !isMuted
          : requestedPublish;

        const identity = userId
          ? `jalwa_${userId}`
          : `guest_${crypto.randomUUID().replace(/-/g, "")}`;
        const name = String(body.name ?? (userId ? "Jalwa user" : "Jalwa guest"))
          .trim()
          .slice(0, 80) || (userId ? "Jalwa user" : "Jalwa guest");

        const at = new AccessToken(apiKey, apiSecret, {
          identity,
          name,
          ttl: userId ? "1h" : "15m",
        });
        at.addGrant({
          roomJoin: true,
          room: roomId,
          canSubscribe: true,
          canPublish,
          canPublishData: true,
          roomAdmin: userId ? isHost || moderator : false,
        });

        const participantToken = await at.toJwt();
        return new Response(
          JSON.stringify({
            server_url: wsUrl,
            participant_token: participantToken,
            room: roomId,
            canPublish,
            guest: !userId,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json", ...cors },
          },
        );
      },
    },
  },
});
