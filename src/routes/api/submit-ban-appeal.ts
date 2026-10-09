import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
const serviceKey = () => process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const Route = createFileRoute("/api/submit-ban-appeal")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const key = serviceKey();
        if (!key) return json({ error: "Appeal service is not configured" }, 503);

        let body: { userId?: string; email?: string; message?: string };
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const userId = String(body.userId ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        const message = String(body.message ?? "").trim();
        if (!isUuid(userId) || !email.includes("@") || message.length < 10 || message.length > 2000) {
          return json({ error: "Enter the banned account email and an appeal of 10–2000 characters." }, 400);
        }

        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
        if (authError || !authData.user || (authData.user.email ?? "").toLowerCase() !== email) {
          return json({ error: "Account ID and email do not match." }, 403);
        }
        const { data: profile, error: profileError } = await admin.from("profiles").select("status").eq("id", userId).maybeSingle();
        if (profileError) return json({ error: "Could not verify account status." }, 500);
        if (profile?.status !== "banned") return json({ error: "This account is not currently marked as banned." }, 409);

        const { data: existing, error: existingError } = await admin
          .from("user_ban_appeals").select("id,status,created_at")
          .eq("user_id", userId).eq("status", "pending").limit(1).maybeSingle();
        if (existingError) return json({ error: "Could not check existing appeals." }, 500);
        if (existing) return json({ ok: true, alreadySubmitted: true, message: "Your appeal request has already been submitted and is pending review." });

        const { error: insertError } = await admin.from("user_ban_appeals").insert({
          user_id: userId, email, appeal_message: message,
        });
        if (insertError) return json({ error: "Could not submit appeal", detail: insertError.message }, 500);
        return json({ ok: true, message: "Your appeal request has been submitted." });
      },
    },
  },
});
