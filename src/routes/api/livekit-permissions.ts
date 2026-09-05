import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";
import { LiveKitAPI } from "livekit-server-sdk";

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

async function verifyUser(token: string): Promise<string | null> {
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

function getLiveKitApi() {
  const wsUrl = (process.env.LIVEKIT_URL || "").trim();
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!wsUrl || !apiKey || !apiSecret) return null;
  const host = wsUrl.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
  return new LiveKitAPI({ host, apiKey, secret: apiSecret });
}

export const Route = createFileRoute("/api/livekit-permissions")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ error: "authentication required" }, 401);

        const userId = await verifyUser(token);
        if (!userId) return json({ error: "invalid authentication" }, 401);

        let body: { room?: string; canPublish?: boolean };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const roomId = String(body.room ?? "").trim();
        if (!roomId || roomId.length > 128) return json({ error: "room is required" }, 400);
        const requestedPublish = body.canPublish === true;

        const key = serviceKey();
        if (!key) return json({ error: "Supabase service key is not configured" }, 503);
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });

        const roomQuery = isUuid(roomId)
          ? sb.from("live_rooms").select("id,host_id,status,rtc_channel").eq("id", roomId).maybeSingle()
          : sb.from("live_rooms").select("id,host_id,status,rtc_channel").eq("rtc_channel", roomId).maybeSingle();
        const { data: room, error: roomError } = await roomQuery;
        if (roomError) return json({ error: "room lookup failed", detail: roomError.message }, 500);
        if (!room) return json({ error: "room not found" }, 404);
        if (room.status !== "live") return json({ error: "room is not live" }, 409);

        const { data: member, error: memberError } = await sb
          .from("room_members")
          .select("seat_index,is_muted")
          .eq("room_id", room.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (memberError) return json({ error: "member lookup failed", detail: memberError.message }, 500);

        const isHost = room.host_id === userId;
        const seated = member?.seat_index !== null && member?.seat_index !== undefined;
        const isMuted = member?.is_muted === true;

        // Granting publication is only valid for a currently seated user or
        // the host. Revocation is always allowed for the authenticated user's
        // own participant. This keeps the permission transition server-side.
        const canPublish = requestedPublish && (isHost || seated) && !isMuted;
        const participantIdentity = `jalwa_${userId}`;
        const livekitRoom = room.rtc_channel || roomId;

        const api = getLiveKitApi();
        if (!api) return json({ error: "LiveKit is not configured on the server" }, 503);

        try {
          const participant = await api.room.updateParticipant(livekitRoom, participantIdentity, undefined, {
            canPublish,
            canSubscribe: true,
            canPublishData: true,
            // roomAdmin is not part of ParticipantPermission in this SDK version
          });

          return json({
            ok: true,
            room: livekitRoom,
            identity: participantIdentity,
            canPublish,
            canSubscribe: true,
            participant_sid: participant.sid,
          });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "LiveKit permission update failed" }, 502);
        }
      },
    },
  },
});
