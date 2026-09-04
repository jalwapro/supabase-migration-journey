import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";
import { LiveKitAPI } from "livekit-server-sdk";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
}
function serviceKey() {
  return process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;
}
async function verifyUser(token: string) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.SB_JWT_SECRET || process.env.JWT_SECRET;
  if (jwtSecret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), { algorithms: ["HS256"] });
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch { return null; }
  }
  const key = serviceKey();
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}
async function requireAdmin(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const uid = await verifyUser(token);
  const key = serviceKey();
  if (!uid || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.rpc("has_role", { _user_id: uid, _role: "admin" });
  return data === true ? sb : null;
}
function getApi() {
  const ws = (process.env.LIVEKIT_URL || "").trim();
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!ws || !key || !secret) return null;
  const host = ws.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://").replace(/\/$/, "");
  return new LiveKitAPI({ host, apiKey: key, secret });
}

export const Route = createFileRoute("/api/livekit-room")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        if (!await requireAdmin(request)) return json({ error: "forbidden" }, 403);
        const api = getApi();
        if (!api) return json({ error: "LiveKit is not configured on the server" }, 503);
        try { return json({ rooms: await api.room.listRooms() }); }
        catch (e) { return json({ error: e instanceof Error ? e.message : "LiveKit request failed" }, 502); }
      },
      POST: async ({ request }) => {
        if (!await requireAdmin(request)) return json({ error: "forbidden" }, 403);
        const api = getApi();
        if (!api) return json({ error: "LiveKit is not configured on the server" }, 503);
        let body: { name?: string; maxParticipants?: number; emptyTimeout?: number; metadata?: string };
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
        const name = String(body.name ?? "").trim();
        if (!name || name.length > 128) return json({ error: "room name is required" }, 400);
        try {
          const room = await api.room.createRoom({
            name,
            maxParticipants: Math.max(2, Math.min(3000, Number(body.maxParticipants) || 100)),
            emptyTimeout: Math.max(30, Math.min(86400, Number(body.emptyTimeout) || 600)),
            metadata: body.metadata ? String(body.metadata).slice(0, 4000) : undefined,
          });
          return json({ room }, 201);
        } catch (e) { return json({ error: e instanceof Error ? e.message : "LiveKit create failed" }, 502); }
      },
      DELETE: async ({ request }) => {
        if (!await requireAdmin(request)) return json({ error: "forbidden" }, 403);
        const api = getApi();
        if (!api) return json({ error: "LiveKit is not configured on the server" }, 503);
        const url = new URL(request.url);
        const name = url.searchParams.get("name")?.trim() || "";
        if (!name) return json({ error: "name is required" }, 400);
        try { await api.room.deleteRoom(name); return json({ ok: true }); }
        catch (e) { return json({ error: e instanceof Error ? e.message : "LiveKit delete failed" }, 502); }
      },
    },
  },
});
