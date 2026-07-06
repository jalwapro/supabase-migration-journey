import { createFileRoute } from "@tanstack/react-router";
import { RtcTokenBuilder, RtcRole } from "agora-token";
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
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const channel = String(body.channel ?? "").trim();
        const uid = Number(body.uid ?? 0);
        const roleName = body.role === "audience" ? "audience" : "publisher";
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

        // Load Agora credentials from app_settings
        const { data: setting, error: sErr } = await anon
          .from("app_settings")
          .select("value")
          .eq("key", "agora")
          .maybeSingle();
        if (sErr) return json({ error: sErr.message }, 500);

        const v = (setting?.value ?? {}) as { appId?: string; appCertificate?: string };
        const appId = v.appId?.trim();
        const appCertificate = v.appCertificate?.trim();
        if (!appId || !appCertificate) {
          return json(
            { error: "Agora not configured. Ask admin to add App ID + Certificate in Admin Panel." },
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
