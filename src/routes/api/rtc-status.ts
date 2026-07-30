import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";

/**
 * Admin-only view of which ZEGOCLOUD credential the server is actually using.
 * The AppID an admin previously configured lives in server environment secrets,
 * which the admin panel could not see — so the panel looked empty even though
 * RTC was working. This endpoint exposes (masked) env credentials and lets an
 * admin import them into the database pool with one click.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function supabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://vfuiqjxgyptjqhbmzigk.supabase.co"
  );
}

function serviceKey() {
  return (
    process.env.SB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SB_SECRET_KEY
  );
}

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
  const key = serviceKey();
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function requireAdmin(request: Request) {
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return null;
  const uid = await verifyBearer(bearer);
  if (!uid) return null;
  const key = serviceKey();
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.rpc("has_role", { _user_id: uid, _role: "admin" });
  return data === true ? { uid, sb } : null;
}

function mask(value: string | undefined) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export const Route = createFileRoute("/api/rtc-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (!admin) return json({ error: "forbidden" }, 403);

        const envAppId = process.env.ZEGO_APP_ID ?? "";
        const envSecret = process.env.ZEGO_SERVER_SECRET ?? "";
        const envServerUrl = process.env.ZEGO_SERVER_URL ?? "";

        const { data: pool } = await admin.sb.rpc("rtc_pick_credential");
        const picked = Array.isArray(pool) ? (pool[0] as { app_id?: number } | undefined) : undefined;
        const { data: single } = await admin.sb
          .from("rtc_credentials")
          .select("app_id")
          .eq("id", true)
          .maybeSingle();

        const source = picked?.app_id
          ? "pool"
          : (single as { app_id?: number } | null)?.app_id
            ? "database"
            : envAppId
              ? "environment"
              : "none";

        return json({
          source,
          activeAppId:
            picked?.app_id ??
            (single as { app_id?: number } | null)?.app_id ??
            (envAppId ? Number(envAppId) : null),
          env: {
            appId: envAppId ? Number(envAppId) : null,
            secretSet: Boolean(envSecret),
            secretHint: mask(envSecret),
            serverUrl: envServerUrl,
          },
        });
      },

      // Copies the environment ZEGO credentials into the rotation pool so the
      // admin can manage / see them like any manually added ID.
      POST: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (!admin) return json({ error: "forbidden" }, 403);

        const appId = Number(process.env.ZEGO_APP_ID ?? "");
        const secret = process.env.ZEGO_SERVER_SECRET ?? "";
        if (!Number.isFinite(appId) || appId <= 0 || !secret) {
          return json({ error: "No ZEGO credentials in server environment" }, 400);
        }

        const { data: rows } = await admin.sb
          .from("rtc_credential_pool")
          .select("slot,app_id")
          .order("slot");
        const list = (rows ?? []) as { slot: number; app_id: number }[];
        const existing = list.find((r) => Number(r.app_id) === appId);
        if (existing) return json({ ok: true, slot: existing.slot, alreadyPresent: true });

        let slot = 1;
        while (list.some((r) => r.slot === slot)) slot += 1;

        const { error } = await admin.sb.from("rtc_credential_pool").insert({
          slot,
          label: "Imported from server env",
          app_id: appId,
          server_secret: secret,
          server_url: process.env.ZEGO_SERVER_URL ?? "",
          minutes_limit: 10000,
          enabled: true,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, slot });
      },
    },
  },
});
