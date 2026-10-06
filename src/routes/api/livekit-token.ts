import { createFileRoute } from "@tanstack/react-router";
import { AccessToken } from "livekit-server-sdk";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
const serviceKey = () => process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;
async function verifyBearer(token: string): Promise<string | null> { const key = serviceKey(); if (!key) return null; const { createClient } = await import("@supabase/supabase-js"); const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } }); const { data, error } = await sb.auth.getUser(token); return error || !data.user ? null : data.user.id; }
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export const Route = createFileRoute("/api/livekit-token")({ server: { handlers: {
  OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
  POST: async ({ request }) => {
    const apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET, wsUrl = (process.env.LIVEKIT_URL || "").trim();
    if (!apiKey || !apiSecret || !wsUrl) return json({ error: "LiveKit is not configured on the server" }, 503);
    if (!/^wss?:\/\//i.test(wsUrl)) return json({ error: "LIVEKIT_URL must start with ws:// or wss://" }, 500);
    let body: { userId?: string; roomName?: string; room?: string; name?: string; canPublish?: boolean };
    try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
    const roomName = String(body.roomName ?? body.room ?? "").trim();
    if (!roomName || roomName.length > 128) return json({ error: "roomName is required" }, 400);
    const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const authenticatedUserId = bearer ? await verifyBearer(bearer) : null;
    if (!authenticatedUserId) return json({ error: "authentication required" }, 401);
    const requestedUserId = String(body.userId ?? authenticatedUserId).trim();
    if (!isUuid(requestedUserId) || requestedUserId !== authenticatedUserId) return json({ error: "userId must equal the authenticated Supabase Auth UUID" }, 403);

    const key = serviceKey(); if (!key) return json({ error: "Supabase service key is not configured" }, 503);
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
    const q = isUuid(roomName)
      ? sb.from("live_rooms").select("id,host_id,status,room_type,rtc_channel").eq("id", roomName).maybeSingle()
      : sb.from("live_rooms").select("id,host_id,status,room_type,rtc_channel").eq("rtc_channel", roomName).maybeSingle();
    const { data: room, error: re } = await q;
    if (re) return json({ error: "room lookup failed", detail: re.message }, 500);
    if (!room) return json({ error: "room not found" }, 404);
    if (room.status !== "live") return json({ error: "room is not live" }, 409);
    const { data: member } = await sb.from("room_members").select("seat_index,is_moderator,is_muted").eq("room_id", room.id).eq("user_id", authenticatedUserId).maybeSingle();
    const isHost = room.host_id === authenticatedUserId;
    const isModerator = member?.is_moderator === true;
    const seated = member?.seat_index !== null && member?.seat_index !== undefined;
    const isMuted = member?.is_muted === true;
    const canPublish = (isHost || isModerator || seated) && !isMuted;
    const livekitRoom = typeof room.rtc_channel === "string" ? room.rtc_channel.trim() : "";
    if (!livekitRoom) return json({ error: "room rtc_channel is missing" }, 500);

    // The database room id may be used for lookup, but the rtc_channel is the
    // single canonical LiveKit room name. The token grant and frontend
    // Room.connect() must both use this exact value.
    const identity = authenticatedUserId;
    const at = new AccessToken(apiKey, apiSecret, { identity, name: String(body.name ?? "Jalwa user").trim().slice(0, 80) || "Jalwa user", ttl: "4h" });
    // The connection token must explicitly grant the client the base LiveKit
    // room capabilities. Runtime room-role/mute restrictions are enforced by
    // the separate livekit-permissions endpoint via UpdateParticipant.
    at.addGrant({ roomJoin: true, room: livekitRoom, canPublish, canSubscribe: true, canPublishData: true, roomAdmin: isHost || isModerator });
    return new Response(JSON.stringify({ server_url: wsUrl, participant_token: await at.toJwt(), room: livekitRoom, database_room_id: room.id, identity, canPublish, canSubscribe: true }), { status: 201, headers: { "Content-Type": "application/json", ...cors } });
  },
} } });
