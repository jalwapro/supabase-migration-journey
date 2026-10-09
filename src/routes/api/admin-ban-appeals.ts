import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vfuiqjxgyptjqhbmzigk.supabase.co";
const serviceKey = () => process.env.SB_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SECRET_KEY;

async function authorize(request: Request) {
  const key = serviceKey();
  if (!key) return { error: json({ error: "Server auth administration is not configured" }, 503) } as const;
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { error: json({ error: "Authentication required" }, 401) } as const;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user) return { error: json({ error: "Invalid or expired admin session" }, 401) } as const;
  const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).in("role", ["admin", "super_admin"]);
  if (roleError) return { error: json({ error: "Could not verify admin permissions" }, 500) } as const;
  if (!(roles ?? []).length) return { error: json({ error: "Admins only" }, 403) } as const;
  return { admin, user: data.user } as const;
}

export const Route = createFileRoute("/api/admin-ban-appeals")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const auth = await authorize(request);
        if ("error" in auth) return auth.error;
        const { data, error } = await auth.admin.from("user_ban_appeals")
          .select("id,user_id,email,appeal_message,status,admin_response,created_at,reviewed_at")
          .order("created_at", { ascending: false }).limit(100);
        if (error) return json({ error: "Could not load appeals", detail: error.message }, 500);
        const ids = [...new Set((data ?? []).map((a) => a.user_id))];
        const { data: profiles, error: profileError } = ids.length
          ? await auth.admin.from("profiles").select("id,username,full_name,user_code").in("id", ids)
          : { data: [], error: null };
        if (profileError) return json({ error: "Could not load appeal user details" }, 500);
        const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
        return json({ appeals: (data ?? []).map((a) => ({ ...a, profile: byId.get(a.user_id) ?? null })) });
      },
      POST: async ({ request }) => {
        const auth = await authorize(request);
        if ("error" in auth) return auth.error;
        let body: { appealId?: string; status?: string; response?: string };
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const appealId = String(body.appealId ?? "");
        const status = body.status;
        const response = String(body.response ?? "").trim().slice(0, 1000);
        if (!/^[0-9a-f-]{36}$/i.test(appealId) || !["approved", "rejected"].includes(status ?? "")) {
          return json({ error: "Valid appeal ID and review decision are required" }, 400);
        }
        const { error } = await auth.admin.from("user_ban_appeals").update({
          status, admin_response: response || null, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id,
        }).eq("id", appealId);
        if (error) return json({ error: "Could not save appeal review", detail: error.message }, 500);
        return json({ ok: true });
      },
    },
  },
});
