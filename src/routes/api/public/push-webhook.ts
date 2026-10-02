import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";
import { createHash } from "node:crypto";

type NotifRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: NotifRow;
  old_record?: NotifRow | null;
};

function configureVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subj, pub, priv);
}

export const Route = createFileRoute("/api/public/push-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-webhook-secret");
        const authorization = request.headers.get("authorization") || "";
        const apiKey = request.headers.get("apikey") || "";
        const serviceKey =
          process.env.SUPABASE_SECRET_KEY ||
          process.env.SB_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          "";
        const serviceAuthorized =
          !!serviceKey &&
          (authorization === `Bearer ${serviceKey}` || apiKey === serviceKey);

        let dbSecretAuthorized = false;
        if (secret) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const authAdmin = supabaseAdmin as any;
            const { data: config } = await authAdmin
              .schema("private")
              .from("push_webhook_config")
              .select("secret_hash")
              .eq("id", true)
              .maybeSingle();
            const hash = createHash("sha256").update(secret).digest("hex");
            dbSecretAuthorized = !!config?.secret_hash && config.secret_hash === hash;
          } catch (e) {
            console.error("Webhook secret verification failed:", e);
          }
        }

        const envSecretAuthorized =
          !!secret && !!process.env.PUSH_WEBHOOK_SECRET && secret === process.env.PUSH_WEBHOOK_SECRET;

        if (!serviceAuthorized && !dbSecretAuthorized && !envSecretAuthorized) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: WebhookPayload;
        try { payload = (await request.json()) as WebhookPayload; }
        catch { return new Response("Bad JSON", { status: 400 }); }

        const row = payload.record;
        if (!row || payload.type !== "INSERT" || payload.table !== "notifications") {
          return Response.json({ skipped: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const { data: prefs } = await admin
          .from("notification_prefs")
          .select("push_enabled, push")
          .eq("user_id", row.user_id)
          .maybeSingle();
        if (prefs && prefs.push_enabled === false) return Response.json({ skipped: "push disabled" });
        const kindPref = (prefs?.push as Record<string, boolean> | null)?.[row.kind];
        if (kindPref === false) return Response.json({ skipped: "kind disabled" });

        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("id, platform, endpoint, p256dh, auth, fcm_token")
          .eq("user_id", row.user_id);
        const subList = (subs ?? []) as Array<{
          id: string;
          platform: string | null;
          endpoint: string | null;
          p256dh: string | null;
          auth: string | null;
          fcm_token: string | null;
        }>;
        if (subList.length === 0) return Response.json({ delivered: 0 });

        const webSubs = subList.filter((s) => s.endpoint && s.p256dh && s.auth);
        const fcmSubs = subList.filter((s) => s.fcm_token);

        const message = JSON.stringify({
          title: row.title,
          body: row.body ?? "",
          tag: row.kind,
          data: { url: "/notifications", notifId: row.id, kind: row.kind, ...(row.data ?? {}) },
        });

        const dead: string[] = [];
        let delivered = 0;
        let failed = 0;

        if (webSubs.length > 0) {
          configureVapid();
          const results = await Promise.allSettled(
            webSubs.map((s) =>
              webpush.sendNotification(
                { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
                message,
              ),
            ),
          );
          results.forEach((r, i) => {
            if (r.status === "fulfilled") delivered++;
            else {
              failed++;
              const status = (r.reason as { statusCode?: number })?.statusCode;
              if (status === 404 || status === 410) dead.push(webSubs[i].id);
            }
          });
        }

        if (fcmSubs.length > 0) {
          try {
            const { sendFcmMessage, isDeadFcmError } = await import("@/lib/fcm.server");
            const dataMap: Record<string, string> = {
              url: "/notifications",
              notifId: row.id,
              kind: row.kind,
            };
            for (const [k, v] of Object.entries(row.data ?? {})) {
              dataMap[k] = typeof v === "string" ? v : JSON.stringify(v);
            }
            const results = await Promise.allSettled(
              fcmSubs.map((s) =>
                sendFcmMessage({
                  token: s.fcm_token as string,
                  title: row.title,
                  body: row.body ?? "",
                  data: dataMap,
                }),
              ),
            );
            results.forEach((r, i) => {
              if (r.status === "fulfilled" && r.value.ok) delivered++;
              else {
                failed++;
                if (r.status === "fulfilled" && isDeadFcmError(r.value.status, r.value.error)) {
                  dead.push(fcmSubs[i].id);
                }
              }
            });
          } catch (e) {
            failed += fcmSubs.length;
            console.error("FCM dispatch error:", e);
          }
        }

        if (dead.length) {
          await admin.from("push_subscriptions").delete().in("id", dead);
        }

        return Response.json({
          delivered,
          failed,
          pruned: dead.length,
          web: webSubs.length,
          fcm: fcmSubs.length,
        });

      },
    },
  },
});
