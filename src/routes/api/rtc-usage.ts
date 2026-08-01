import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";

// Reports consumed ZEGO minutes (or an outright quota failure) for an AppID so
// the credential pool can rotate to the next ID automatically.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function resolveSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://vfuiqjxgyptjqhbmzigk.supabase.co"
  );
}

// Usage reporting mutates rotation state (it can retire an AppID), so it must
// never be callable anonymously — otherwise anyone could exhaust every slot.
async function verifyBearer(bearer: string): Promise<string | null> {
  const secret =
    process.env.SUPABASE_JWT_SECRET || process.env.SB_JWT_SECRET || process.env.JWT_SECRET;
  if (secret) {
    try {
      const { payload } = await jwtVerify(bearer, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  }
  const key =
    process.env.SB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SB_SECRET_KEY;
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(resolveSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data?.user) return null;
  return data.user.id;
}

export const Route = createFileRoute("/api/rtc-usage")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!bearer || !(await verifyBearer(bearer))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
        }
        let body: { appId?: number | string; minutes?: number; exhausted?: boolean };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: cors });
        }
        const appId = Number(body.appId);
        if (!Number.isFinite(appId) || appId <= 0) {
          return new Response(JSON.stringify({ error: "appId required" }), { status: 400, headers: cors });
        }
        const minutes = Math.min(Math.max(Number(body.minutes) || 0, 0), 24 * 60);

        const serviceKey =
          process.env.SB_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SB_SECRET_KEY;
        if (!serviceKey) return new Response(JSON.stringify({ ok: false }), { status: 200, headers: cors });

        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(resolveSupabaseUrl(), serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        if (body.exhausted) {
          await sb.rpc("rtc_mark_exhausted", { _app_id: appId });
          return new Response(JSON.stringify({ ok: true, exhausted: true }), { status: 200, headers: cors });
        }

        const { data } = await sb.rpc("rtc_report_usage", { _app_id: appId, _minutes: minutes });
        return new Response(JSON.stringify({ ok: true, exhausted: data === true }), { status: 200, headers: cors });
      },
    },
  },
});
