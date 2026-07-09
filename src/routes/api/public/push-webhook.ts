import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";

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
        if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
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

        // Check user prefs
        const { data: prefs } = await supabaseAdmin
          .from("notification_prefs")
          .select("push_enabled, push")
          .eq("user_id", row.user_id)
          .maybeSingle();
        if (prefs && prefs.push_enabled === false) return Response.json({ skipped: "push disabled" });
        const kindPref = (prefs?.push as Record<string, boolean> | null)?.[row.kind];
        if (kindPref === false) return Response.json({ skipped: "kind disabled" });

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", row.user_id)
          .not("endpoint", "is", null);
        if (!subs || subs.length === 0) return Response.json({ delivered: 0 });

        configureVapid();

        const message = JSON.stringify({
          title: row.title,
          body: row.body ?? "",
          tag: row.kind,
          data: { url: "/notifications", notifId: row.id, kind: row.kind, ...(row.data ?? {}) },
        });

        const results = await Promise.allSettled(
          subs.map((s) =>
            webpush.sendNotification(
              { endpoint: s.endpoint!, keys: { p256dh: s.p256dh!, auth: s.auth! } },
              message,
            ),
          ),
        );

        // Prune dead subscriptions (404/410)
        const dead: string[] = [];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            const status = (r.reason as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) dead.push(subs[i].id);
          }
        });
        if (dead.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
        }

        return Response.json({
          delivered: results.filter((r) => r.status === "fulfilled").length,
          failed: results.filter((r) => r.status === "rejected").length,
          pruned: dead.length,
        });
      },
    },
  },
});
