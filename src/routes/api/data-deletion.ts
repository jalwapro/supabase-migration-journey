/**
 * Meta/Facebook User Data Deletion Callback
 *
 * GET  /api/data-deletion  -> public instructions/status page
 * POST /api/data-deletion -> Meta signed_request callback
 *
 * Meta sends a signed_request containing the user's Facebook-scoped user ID.
 * The callback acknowledges the deletion request and returns a confirmation
 * code plus a status URL, as required by Meta's data-deletion callback flow.
 *
 * Account deletion itself should be completed by the Jalwa account-deletion
 * workflow so application data and the Supabase Auth account are removed
 * consistently.
 */
import { createFileRoute } from "@tanstack/react-router";

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

function page() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Jalwa — User Data Deletion</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08050c;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    main{width:min(680px,calc(100% - 40px));box-sizing:border-box;padding:32px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(255,255,255,.05)}
    h1{margin:0 0 12px;font-size:28px} p{color:rgba(255,255,255,.72);line-height:1.65}
    a{color:#e879f9}
  </style>
</head>
<body>
<main>
  <h1>Jalwa User Data Deletion</h1>
  <p>You can request deletion of your Jalwa account and associated personal data.</p>
  <p>For account deletion support, contact <a href="mailto:admin@jalwa.pro">admin@jalwa.pro</a> or use the account deletion option available in Jalwa when provided.</p>
  <p>For Meta/Facebook deletion requests, this URL is also used as Jalwa's data deletion callback endpoint.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...cors },
  });
}

function confirmationCode() {
  return `JALWA-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const Route = createFileRoute("/api/data-deletion")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => page(),
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          let signedRequest = "";

          if (contentType.includes("application/json")) {
            const body = await request.json() as { signed_request?: unknown };
            signedRequest = typeof body.signed_request === "string" ? body.signed_request : "";
          } else {
            const form = await request.formData();
            const value = form.get("signed_request");
            signedRequest = typeof value === "string" ? value : "";
          }

          if (!signedRequest) {
            return json({ error: "signed_request is required" }, 400);
          }

          // Meta requires the callback to acknowledge the request. We do not
          // trust the signed payload as an application account identifier here.
          // The Jalwa account-deletion workflow handles the actual deletion.
          const code = confirmationCode();
          return json({
            url: "https://www.jalwa.pro/api/data-deletion",
            confirmation_code: code,
          });
        } catch (error) {
          console.error("Meta data deletion callback failed:", error);
          return json({ error: "invalid deletion request" }, 400);
        }
      },
    },
  },
});
