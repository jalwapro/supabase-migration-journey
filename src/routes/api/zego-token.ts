import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

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

export const Route = createFileRoute("/api/zego-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const appIdRaw = process.env.ZEGO_APP_ID;
        const serverSecret = process.env.ZEGO_SERVER_SECRET;
        if (!appIdRaw || !serverSecret) {
          console.error("[zego-token] ZEGO_APP_ID / ZEGO_SERVER_SECRET missing");
          return json({ error: "ZEGO not configured on server" }, 503);
        }
        const appId = Number(appIdRaw);
        if (!Number.isFinite(appId) || appId <= 0) {
          return json({ error: "ZEGO_APP_ID must be a positive integer" }, 500);
        }

        const serviceKey =
          process.env.SB_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SB_SECRET_KEY;
        if (!serviceKey) {
          console.error("[zego-token] no service key env var found");
          return json({ error: "server misconfigured: service key missing" }, 500);
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

        // Verify caller is signed in (bearer token from supabase)
        const auth = request.headers.get("authorization") ?? "";
        const bearer = auth.replace(/^Bearer\s+/i, "");
        if (!bearer) return json({ error: "unauthorized" }, 401);

        const sb = createClient(resolveSupabaseUrl(), serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userRes, error: userErr } = await sb.auth.getUser(bearer);
        if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

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
            { login: true, publish: roleName === "publisher" },
          );
        } catch (e) {
          console.error("[zego-token] generate failed", e);
          return json({ error: e instanceof Error ? e.message : "token failed" }, 500);
        }

        // Server URL: standard ZEGO Web SDK websocket for the app
        const serverUrl =
          process.env.ZEGO_SERVER_URL?.trim() ||
          `wss://webliveroom${appId}-api.coolzcloud.com/ws`;

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
