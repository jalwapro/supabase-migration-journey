/**
 * One-shot SMTP verification endpoint. Gated by SMTP_VERIFY_TOKEN.
 * Public prefix so it works without Lovable auth wall on published site.
 *
 * POST /api/public/smtp-verify
 * Header: x-verify-token: <SMTP_VERIFY_TOKEN>
 * Body: { to?: string }  // defaults to SMTP_USER
 */
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/smtp-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SMTP_VERIFY_TOKEN;
        if (!expected) return json({ error: "verify token not configured" }, 500);
        const provided = request.headers.get("x-verify-token") ?? "";
        if (provided !== expected) return json({ error: "unauthorized" }, 401);

        let body: { to?: string } = {};
        try {
          body = await request.json();
        } catch {
          /* body optional */
        }
        const to = (body.to ?? process.env.SMTP_USER ?? "").trim();
        if (!to) return json({ error: "no recipient" }, 400);

        try {
          const { verifySmtpConnection, sendMailServer } = await import(
            "@/lib/email.server"
          );

          const connOk = await verifySmtpConnection();

          const result = await sendMailServer({
            to,
            subject: "✅ Jalwa SMTP test — " + new Date().toISOString(),
            html: `
              <div style="font-family:system-ui,sans-serif;padding:24px;background:#f7f7f7">
                <div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.06)">
                  <h1 style="color:#8b5cf6;margin:0 0 12px">Jalwa SMTP Test ✨</h1>
                  <p style="color:#333;line-height:1.6">
                    SMTP configuration is working correctly.<br/>
                    From: <b>${process.env.SMTP_FROM ?? process.env.SMTP_USER}</b><br/>
                    Host: <b>${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</b>
                  </p>
                  <p style="color:#999;font-size:12px;margin-top:24px">
                    Time: ${new Date().toISOString()}
                  </p>
                </div>
              </div>
            `,
            text: "Jalwa SMTP test successful.",
          });

          return json({ connectionOk: connOk, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("smtp-verify failed:", msg);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
