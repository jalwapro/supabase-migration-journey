import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
const serviceKey = () => process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const Route = createFileRoute("/api/admin-user-ban")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const key = serviceKey();
        if (!key) return json({ error: "Server auth administration is not configured" }, 503);
        const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\\s+/i, "").trim();
        if (!bearer) return json({ error: "Authentication required" }, 401);

        let body: { userId?: string; banned?: boolean; reason?: string };
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const userId = String(body.userId ?? "").trim();
        const reason = String(body.reason ?? "").trim().slice(0, 1000);
        if (!isUuid(userId) || typeof body.banned !== "boolean") return json({ error: "Valid userId and banned flag are required" }, 400);
        if (body.banned && reason.length < 5) return json({ error: "Please provide a ban reason (at least 5 characters)." }, 400);

        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: authData, error: authError } = await admin.auth.getUser(bearer);
        if (authError || !authData.user) return json({ error: "Invalid or expired admin session" }, 401);
        if (authData.user.id === userId) return json({ error: "You cannot ban your own admin account" }, 400);

        const [{ data: roleRows, error: roleError }, { data: target, error: targetError }] = await Promise.all([
          admin.from("user_roles").select("role").eq("user_id", authData.user.id).in("role", ["admin", "super_admin"]),
          admin.auth.admin.getUserById(userId),
        ]);
        if (roleError) return json({ error: "Could not verify admin permissions" }, 500);
        if (!(roleRows ?? []).length) return json({ error: "Admins only" }, 403);
        if (targetError || !target.user) return json({ error: "Target user not found" }, 404);

        if (body.banned) {
          const { error: profileError } = await admin.from("profiles").update({ status: "banned", ban_reason: reason }).eq("id", userId);
          if (profileError) return json({ error: "Could not update profile status", detail: profileError.message }, 500);
          const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
          if (banError) {
            await admin.from("profiles").update({ status: "active", ban_reason: null }).eq("id", userId);
            return json({ error: "Supabase Auth ban failed", detail: banError.message }, 500);
          }
        } else {
          const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
          if (unbanError) return json({ error: "Supabase Auth unban failed", detail: unbanError.message }, 500);
          const { error: profileError } = await admin.from("profiles").update({ status: "active", ban_reason: null }).eq("id", userId);
          if (profileError) {
            await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
            return json({ error: "Could not update profile status", detail: profileError.message }, 500);
          }
        }

        return json({ ok: true, userId, status: body.banned ? "banned" : "active", reason: body.banned ? reason : null });
      },
    },
  },
});
