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
        const serviceKey =
          process.env.SB_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SB_SECRET_KEY;
        if (!serviceKey) {
          console.error("[agora-token] no service key env var found");
          return json({ error: "server misconfigured: service key missing" }, 500);
        }


        let body: {
          channel?: string;
          uid?: number;
          role?: "publisher" | "audience";
          kind?: "voice" | "video" | "pk";
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const channel = String(body.channel ?? "").trim();
        const uid = Number(body.uid ?? 0);
        const roleName = body.role === "audience" ? "audience" : "publisher";
        const kind: "voice" | "video" | "pk" =
          body.kind === "video" ? "video" : body.kind === "pk" ? "pk" : "voice";
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

        // Token lives ~1h, reserve 60 minutes of quota against the pool.
        const expireSeconds = 3600;
        const reserveMinutes = 60;

        let appId: string | undefined;
        let appCertificate: string | undefined;
        let poolSlot: number | null = null;

        // 0) Env-var override (highest priority) — set for voice via AGORA_APP_ID_NEW / AGORA_APP_CERT_NEW
        const envId = process.env.AGORA_APP_ID_NEW?.trim();
        const envCert = process.env.AGORA_APP_CERT_NEW?.trim();
        if (envId && envCert) {
          appId = envId;
          appCertificate = envCert;
        }

        // 1) Try the auto-rotating slot pool for this kind
        if (!appId || !appCertificate) {
          const { data: slotRows } = await anon.rpc("consume_agora_slot", {
            _kind: kind,
            _minutes: reserveMinutes,
          });
          const slot = Array.isArray(slotRows) ? slotRows[0] : slotRows;
          if (slot?.app_id && slot?.app_certificate) {
            appId = String(slot.app_id).trim();
            appCertificate = String(slot.app_certificate).trim();
            poolSlot = Number(slot.slot_index);
          }
        }


        // 2) Fallback to legacy single-key settings (agora_voice / agora_video / agora)
        if (!appId || !appCertificate) {
          const preferredKey =
            kind === "video" ? "agora_video" : kind === "pk" ? "agora_pk" : "agora_voice";
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
          appId = pick.appId?.trim();
          appCertificate = pick.appCertificate?.trim();
        }

        if (!appId || !appCertificate) {
          return json(
            { error: `Agora (${kind}) not configured. Admin panel me Agora Slots add karo.` },
            503,
          );
        }

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

        return json({ appId, token: rtcToken, uid, channel, expiresAt: privilegeExpireTs, slot: poolSlot });

      },
    },
  },
});
