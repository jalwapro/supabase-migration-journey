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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

        const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        let userId: string | null = null;
        if (bearer) userId = await verifyBearer(bearer);

        const key = serviceKey();
        if (!key) return json({ error: "Supabase service key is not configured" }, 503);
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });

        // The app has two valid room identifiers: the UUID primary key and the
        // LiveKit/RTC channel (for example, "jalwa-abc123"). Resolve either to
        // the same live_rooms row before checking permissions. The previous
        // implementation always queried the UUID column, which caused a 22P02
        // PostgreSQL error whenever the voice-room flow supplied rtc_channel.
        const roomQuery = isUuid(roomId)
          ? sb.from("live_rooms").select("id,host_id,status,room_type,rtc_channel").eq("id", roomId).maybeSingle()
          : sb.from("live_rooms").select("id,host_id,status,room_type,rtc_channel").eq("rtc_channel", roomId).maybeSingle();

        const { data: room, error: roomError } = await roomQuery;
        if (roomError) return json({ error: "room lookup failed", detail: roomError.message }, 500);
        if (!room) return json({ error: "room not found" }, 404);
        if (room.status !== "live") return json({ error: "room is not live" }, 409);

        let isHost = false;
        let seated = false;
        let moderator = false;
        let isMuted = false;

        if (userId) {
          const { data: member } = await sb
            .from("room_members")
            .select("seat_index,is_moderator,is_muted")
            .eq("room_id", room.id)
            .eq("user_id", userId)
            .maybeSingle();

          isHost = room.host_id === userId;
          seated = member?.seat_index !== null && member?.seat_index !== undefined;
          moderator = member?.is_moderator === true;
          isMuted = member?.is_muted === true;
        }

        // LiveKit permissions are explicit for every valid room participant.
        // Application-level seat/mute rules can still control whether the UI
        // exposes the microphone, but the token itself must allow publication.
        const canPublish = true;
        const canSubscribe = true;

        const identity = userId
          ? `jalwa_${userId}`
          : `guest_${crypto.randomUUID().replace(/-/g, "")}`;
        const name = String(body.name ?? (userId ? "Jalwa user" : "Jalwa guest"))
          .trim()
          .slice(0, 80) || (userId ? "Jalwa user" : "Jalwa guest");

        // Keep the LiveKit room name identical to the identifier supplied by
        // the client. This lets both UUID-based and rtc_channel-based clients
        // connect consistently while the database lookup above resolves the
        // corresponding live_rooms record for authorization.
        const at = new AccessToken(apiKey, apiSecret, {
          identity,
          name,
          ttl: userId ? "1h" : "15m",
        });
        at.addGrant({
          roomJoin: true,
          room: roomId,
          canSubscribe,
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
            database_room_id: room.id,
            canPublish,
            canSubscribe,
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
