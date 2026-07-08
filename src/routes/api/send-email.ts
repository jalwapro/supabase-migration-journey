/**
 * Admin-gated email send endpoint. Verifies caller's Supabase bearer token
 * and admin role, then sends via SMTP (Hostinger).
 *
 * POST /api/send-email
 * Body: { to, subject, html?, text? }
 * Header: Authorization: Bearer <supabase access_token>
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

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

export const Route = createFileRoute("/api/send-email")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const serviceKey = process.env.SB_SERVICE_ROLE_KEY;
        if (!serviceKey) return json({ error: "server misconfigured" }, 500);

        // Auth
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "unauthorized" }, 401);

        const sb = createClient(SUPABASE_URL, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userRes, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

        // Admin check
        const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
          _user_id: userRes.user.id,
          _role: "admin",
        });
        if (roleErr) return json({ error: roleErr.message }, 500);
        if (!isAdmin) return json({ error: "forbidden: admin only" }, 403);

        // Payload
        let body: {
          to?: string;
          subject?: string;
          html?: string;
          text?: string;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const to = String(body.to ?? "").trim();
        const subject = String(body.subject ?? "").trim();
        if (!to || !subject) return json({ error: "to and subject required" }, 400);
        if (!body.html && !body.text) return json({ error: "html or text required" }, 400);

        try {
          const { sendMailServer } = await import("@/lib/email.server");
          const result = await sendMailServer({
            to,
            subject,
            html: body.html,
            text: body.text,
          });
          return json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("send-email failed:", msg);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
