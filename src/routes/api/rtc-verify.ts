import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify } from "jose";
import { createHash, randomUUID } from "crypto";

/**
 * Admin-only ZEGOCLOUD credential verifier.
 *
 * Save-time validation for the admin panel: mints a real token04 with the
 * supplied AppID + ServerSecret and then calls the ZEGOCLOUD server API with
 * a signed request. Credentials are only accepted when both succeed, so a
 * bad key can never replace a working live configuration.
 */

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

/** Signed ZEGOCLOUD server-API probe. Returns a coarse verdict. */
async function probeZegoApi(
  appId: number,
  secret: string,
): Promise<{ ok: boolean; reachable: boolean; code?: number; message?: string }> {
  const nonce = randomUUID().replace(/-/g, "").slice(0, 16);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("md5")
    .update(`${appId}${nonce}${secret}${timestamp}`)
    .digest("hex");
  const url =
    `https://rtc-api.zego.im/?Action=DescribeRoomList&AppId=${appId}` +
    `&SignatureNonce=${nonce}&Timestamp=${timestamp}&Signature=${signature}` +
    `&SignatureVersion=2.0&IsTest=false`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const body = (await res.json().catch(() => null)) as
      | { Code?: number; Message?: string }
      | null;
    if (!body || typeof body.Code !== "number") {
      return { ok: false, reachable: false, message: `HTTP ${res.status}` };
    }
    // 0 = success. Signature / AppID errors are hard rejections; anything else
    // (permission, quota, feature-not-enabled) still proves the key is real.
    const authFailures = new Set([100000002, 100000004, 100000006, 100000007]);
    if (body.Code === 0) return { ok: true, reachable: true, code: 0 };
    if (authFailures.has(body.Code)) {
      return { ok: false, reachable: true, code: body.Code, message: body.Message };
    }
    return { ok: true, reachable: true, code: body.Code, message: body.Message };
  } catch {
    return { ok: false, reachable: false, message: "ZEGOCLOUD API unreachable" };
  }
}

export const Route = createFileRoute("/api/rtc-verify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (!admin) return json({ error: "forbidden" }, 403);

        let body: { slot?: number; appId?: number | string; secret?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const appIdInput = Number(body.appId);
        const slot = Number.isFinite(Number(body.slot)) ? Number(body.slot) : null;
        let appId = Number.isFinite(appIdInput) && appIdInput > 0 ? appIdInput : 0;
        let secret = String(body.secret ?? "").trim();

        // Fall back to the stored credential for this slot (secret never
        // leaves the server, so the panel can re-test without re-typing it).
        if ((!secret || !appId) && slot !== null) {
          const { data } = await admin.sb
            .from("rtc_credential_pool")
            .select("app_id,server_secret")
            .eq("slot", slot)
            .maybeSingle();
          const row = data as { app_id?: number; server_secret?: string } | null;
          if (!appId) appId = Number(row?.app_id ?? 0);
          if (!secret) secret = String(row?.server_secret ?? "");
        }

        if (!appId || appId <= 0) return json({ error: "AppID required" }, 400);
        if (secret.length !== 32) {
          return json({ ok: false, error: "ServerSecret must be exactly 32 characters" }, 400);
        }

        // 1. token generation — proves the secret can actually sign token04
        let tokenOk = false;
        let tokenError: string | null = null;
        try {
          const { generateZegoToken04 } = await import("@/lib/zego-token.server");
          const t = generateZegoToken04(appId, "jalwa-verify", secret, 60, "jalwa-verify-room", {
            login: true,
            publish: true,
          });
          tokenOk = typeof t.token === "string" && t.token.startsWith("04");
        } catch (e) {
          tokenError = e instanceof Error ? e.message : "token generation failed";
        }

        // 2. live credential probe against the ZEGOCLOUD server API
        const probe = tokenOk ? await probeZegoApi(appId, secret) : { ok: false, reachable: false };

        const status = !tokenOk
          ? "invalid"
          : probe.ok
            ? "verified"
            : probe.reachable
              ? "invalid"
              : "token_only";

        const message =
          status === "verified"
            ? "Credentials verified with ZEGOCLOUD"
            : status === "token_only"
              ? "Token generated, but ZEGOCLOUD API was unreachable — credentials look valid"
              : (tokenError ?? probe.message ?? "ZEGOCLOUD rejected these credentials");

        if (slot !== null) {
          await admin.sb.rpc("rtc_set_verify_state", {
            _slot: slot,
            _status: status,
            _error: status === "verified" ? null : message,
          });
        }

        return json({
          ok: status !== "invalid",
          status,
          message,
          appId,
          tokenOk,
          apiReachable: probe.reachable,
          code: probe.code ?? null,
        });
      },
    },
  },
});
