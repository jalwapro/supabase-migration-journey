/**
 * Admin-only push diagnostics endpoint.
 *
 * GET  /api/admin/push-test           → env + subscription counts for caller
 * POST /api/admin/push-test           → send a live test push to caller's
 *                                       registered subscriptions (web + FCM),
 *                                       pruning dead tokens along the way.
 *
 * Auth: Supabase bearer token; caller must have the `admin` role.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

const SUPABASE_URL = "https://vfuiqjxgyptjqhbmzigk.supabase.co";

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

async function authAdmin(request: Request): Promise<
  | { ok: true; userId: string; sb: SupabaseClient }
  | { ok: false; res: Response }
> {
  const serviceKey = process.env.SB_SERVICE_ROLE_KEY;
  if (!serviceKey) return { ok: false, res: json({ error: "server misconfigured" }, 500) };
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, res: json({ error: "unauthorized" }, 401) };
  const sb = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userRes?.user) return { ok: false, res: json({ error: "unauthorized" }, 401) };
  const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
    _user_id: userRes.user.id,
    _role: "admin",
  });
  if (roleErr) return { ok: false, res: json({ error: roleErr.message }, 500) };
  if (!isAdmin) return { ok: false, res: json({ error: "forbidden: admin only" }, 403) };
  return { ok: true, userId: userRes.user.id, sb };
}

function envHealth() {
  return {
    vapid_public: !!process.env.VAPID_PUBLIC_KEY,
    vapid_private: !!process.env.VAPID_PRIVATE_KEY,
    vapid_subject: !!process.env.VAPID_SUBJECT,
    push_webhook_secret: !!process.env.PUSH_WEBHOOK_SECRET,
    fcm_service_account: !!process.env.FCM_SERVICE_ACCOUNT_JSON,
    fcm_project_id: !!process.env.FCM_PROJECT_ID,
    firebase_web_config: !!process.env.FIREBASE_WEB_CONFIG_JSON,
  };
}

function configureVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subj, pub, priv);
}

export const Route = createFileRoute("/api/admin/push-test")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const auth = await authAdmin(request);
        if (!auth.ok) return auth.res;
        const { sb, userId } = auth;
        const { data: subs, error } = await sb
          .from("push_subscriptions")
          .select("id, platform, endpoint, fcm_token, user_agent, last_seen, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        const list = subs ?? [];
        return json({
          env: envHealth(),
          user_id: userId,
          subscriptions: list,
          counts: {
            total: list.length,
            web: list.filter((s) => s.endpoint && !s.fcm_token).length,
            fcm: list.filter((s) => s.fcm_token).length,
          },
        });
      },

      POST: async ({ request }) => {
        const auth = await authAdmin(request);
        if (!auth.ok) return auth.res;
        const { sb, userId } = auth;

        let body: { target_user_id?: string; title?: string; body?: string } = {};
        try { body = await request.json(); } catch { /* empty body allowed */ }
        const targetId = body.target_user_id || userId;
        const title = (body.title || "Jalwa push test").slice(0, 80);
        const message = (body.body || "If you can see this, notifications are live.").slice(0, 200);

        const { data: subs, error } = await sb
          .from("push_subscriptions")
          .select("id, platform, endpoint, p256dh, auth, fcm_token")
          .eq("user_id", targetId);
        if (error) return json({ error: error.message }, 500);
        const subList = (subs ?? []) as Array<{
          id: string;
          platform: string | null;
          endpoint: string | null;
          p256dh: string | null;
          auth: string | null;
          fcm_token: string | null;
        }>;
        if (subList.length === 0) {
          return json({ delivered: 0, failed: 0, pruned: 0, results: [], note: "no subscriptions" });
        }

        const webSubs = subList.filter((s) => s.endpoint && s.p256dh && s.auth && !s.fcm_token);
        const fcmSubs = subList.filter((s) => s.fcm_token);

        const payload = JSON.stringify({
          title,
          body: message,
          tag: "admin_test",
          data: { url: "/notifications", kind: "admin_test" },
        });

        const dead: string[] = [];
        const results: Array<{
          id: string;
          kind: "web" | "fcm";
          ok: boolean;
          status: number;
          error?: string;
        }> = [];

        if (webSubs.length > 0) {
          try {
            configureVapid();
            const settled = await Promise.allSettled(
              webSubs.map((s) =>
                webpush.sendNotification(
                  { endpoint: s.endpoint!, keys: { p256dh: s.p256dh!, auth: s.auth! } },
                  payload,
                ),
              ),
            );
            settled.forEach((r, i) => {
              const sub = webSubs[i];
              if (r.status === "fulfilled") {
                results.push({ id: sub.id, kind: "web", ok: true, status: r.value.statusCode });
              } else {
                const err = r.reason as { statusCode?: number; body?: string; message?: string };
                const status = err?.statusCode ?? 0;
                results.push({
                  id: sub.id,
                  kind: "web",
                  ok: false,
                  status,
                  error: err?.body || err?.message || "web push error",
                });
                if (status === 404 || status === 410) dead.push(sub.id);
              }
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            webSubs.forEach((s) => results.push({ id: s.id, kind: "web", ok: false, status: 0, error: msg }));
          }
        }

        if (fcmSubs.length > 0) {
          try {
            const { sendFcmMessage, isDeadFcmError } = await import("@/lib/fcm.server");
            const settled = await Promise.allSettled(
              fcmSubs.map((s) =>
                sendFcmMessage({
                  token: s.fcm_token!,
                  title,
                  body: message,
                  data: { url: "/notifications", kind: "admin_test" },
                }),
              ),
            );
            settled.forEach((r, i) => {
              const sub = fcmSubs[i];
              if (r.status === "fulfilled") {
                const v = r.value;
                results.push({ id: sub.id, kind: "fcm", ok: v.ok, status: v.status, error: v.ok ? undefined : v.error });
                if (!v.ok && isDeadFcmError(v.status, v.error)) dead.push(sub.id);
              } else {
                const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
                results.push({ id: sub.id, kind: "fcm", ok: false, status: 0, error: msg });
              }
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            fcmSubs.forEach((s) => results.push({ id: s.id, kind: "fcm", ok: false, status: 0, error: msg }));
          }
        }

        if (dead.length > 0) {
          await sb.from("push_subscriptions").delete().in("id", dead);
        }

        const delivered = results.filter((r) => r.ok).length;
        const failed = results.length - delivered;
        return json({
          delivered,
          failed,
          pruned: dead.length,
          web: webSubs.length,
          fcm: fcmSubs.length,
          results,
        });
      },
    },
  },
});
