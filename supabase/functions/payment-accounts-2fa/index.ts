import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticator } from "https://esm.sh/otplib@12.0.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const ALLOWED = "jalwaapplive@gmail.com";
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization"); if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== ALLOWED) return json({ error: "Access denied" }, 403);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, code } = await req.json();
    const { data: row } = await admin.from("admin_payment_2fa").select("secret,enabled").eq("user_id", user.id).maybeSingle();
    if (action === "status") return json({ configured: Boolean(row?.secret), enabled: Boolean(row?.enabled) });
    if (action === "setup") {
      if (row?.secret && row.enabled) return json({ error: "2FA is already enabled" }, 409);
      const secret = authenticator.generateSecret(); const otpauth = authenticator.keyuri(user.email!, "Jalwa Pro Payment Accounts", secret);
      const { error } = await admin.from("admin_payment_2fa").upsert({ user_id: user.id, email: user.email!.toLowerCase(), secret, enabled: false, updated_at: new Date().toISOString() });
      if (error) throw error; return json({ secret, otpauth });
    }
    if (action === "enable") {
      if (!row?.secret || !code || !authenticator.check(String(code).replace(/\s/g, ""), row.secret)) return json({ error: "Invalid Authenticator code" }, 400);
      const { error } = await admin.from("admin_payment_2fa").update({ enabled: true, updated_at: new Date().toISOString() }).eq("user_id", user.id); if (error) throw error; return json({ enabled: true });
    }
    if (action === "verify") {
      if (!row?.secret || !row.enabled || !code || !authenticator.check(String(code).replace(/\s/g, ""), row.secret)) return json({ verified: false, error: "Invalid Authenticator code" }, 401);
      return json({ verified: true, expiresInSeconds: 900 });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "2FA error" }, 500); }
});
