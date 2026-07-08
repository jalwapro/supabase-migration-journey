import { createFileRoute } from "@tanstack/react-router";
import pkg from "agora-token";
const { RtcTokenBuilder, RtcRole } = pkg;
import { createClient } from "@supabase/supabase-js";

// Public Supabase URL — safe to embed
const SUPABASE_URL = "https://vfuiqjxgyptjqhbmzigk.supabase.co";

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

export const Route = createFileRoute("/api/agora-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const serviceKey = process.env.SB_SERVICE_ROLE_KEY;
        if (!serviceKey) return json({ error: "server misconfigured" }, 500);

        let body: {
          channel?: string;
          uid?: number;
          role?: "publisher" | "audience";
          kind?: "voice" | "video";
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const channel = String(body.channel ?? "").trim();
        const uid = Number(body.uid ?? 0);
        const roleName = body.role === "audience" ? "audience" : "publisher";
        const kind = body.kind === "video" ? "video" : "voice";
        if (!channel || !Number.isFinite(uid)) {
          return json({ error: "channel and uid required" }, 400);
        }

        // Verify caller is signed in (bearer token from supabase)
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "unauthorized" }, 401);

        const anon = createClient(SUPABASE_URL, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userRes, error: userErr } = await anon.auth.getUser(token);
        if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

        // Load Agora credentials — prefer kind-specific, then legacy "agora"
        const preferredKey = kind === "video" ? "agora_video" : "agora_voice";
        const { data: settings, error: sErr } = await anon
          .from("app_settings")
          .select("key,value")
          .in("key", [preferredKey, "agora"]);
        if (sErr) return json({ error: sErr.message }, 500);

        const byKey = new Map((settings ?? []).map((r) => [r.key, r.value]));
        const pick = (byKey.get(preferredKey) ?? byKey.get("agora") ?? {}) as {
          appId?: string;
          appCertificate?: string;
        };
        const appId = pick.appId?.trim();
        const appCertificate = pick.appCertificate?.trim();
        if (!appId || !appCertificate) {
          return json(
            { error: `Agora (${kind}) not configured. Ask admin to add App ID + Certificate in Admin Panel.` },
            503,
          );
        }

        const expireSeconds = 3600; // 1 hour
        const privilegeExpireTs = Math.floor(Date.now() / 1000) + expireSeconds;
        const rtcToken = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channel,
          uid,
          roleName === "audience" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER,
          privilegeExpireTs,
          privilegeExpireTs,
        );

        return json({ appId, token: rtcToken, uid, channel, expiresAt: privilegeExpireTs });
      },
    },
  },
});
