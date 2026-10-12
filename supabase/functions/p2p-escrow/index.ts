import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PUBLIC_KEY) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    // Verify the JWT using the public key. Never trust an actor/user id supplied by the client.
    const authClient = createClient(SUPABASE_URL, PUBLIC_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "INVALID_SESSION" }, 401);

    const body = await req.json().catch(() => null) as { action?: string; payload?: Record<string, unknown> } | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload
      : {};
    const allowed = new Set([
      "MARKETPLACE", "GET_AGENT", "GET_ORDER", "SAVE_AGENT_PROFILE", "REQUEST_WHATSAPP", "CREATE_ORDER",
      "BUYER_PAID", "APPEAL", "RELEASE_ORDER", "CANCEL_ORDER", "ADMIN_COMPLETE", "ADMIN_CANCEL",
      "ADMIN_APPROVE_WHATSAPP", "ADMIN_BAN_AGENT", "ADMIN_SAVE_SETTINGS", "ADMIN_OVERVIEW",
    ]);
    if (!allowed.has(action)) return json({ error: "INVALID_ACTION" }, 400);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rpcName = action === "MARKETPLACE" ? "p2p_marketplace_for_user" : "p2p_escrow_action";
    const rpcArgs = action === "MARKETPLACE" ? { actor_id: user.id } : { actor_id: user.id, action, payload };
    const { data, error } = await adminClient.rpc(rpcName, rpcArgs);
    if (error) {
      const message = error.message || "P2P_ACTION_FAILED";
      const status = /AUTH_REQUIRED|INVALID_SESSION|ADMIN_REQUIRED|NOT_ORDER_PARTICIPANT|CANNOT_BUY_FROM_SELF/i.test(message) ? 403
        : /NOT_FOUND|NOT_AVAILABLE|INSUFFICIENT|OUT_OF_RANGE|INVALID|MUST_BE|LIMIT|TRANSITION|REQUIRED|BANNED|ALREADY|CLOSED|COUNTRY_MISMATCH/i.test(message) ? 400
        : 500;
      return json({ error: message }, status);
    }
    return json({ data });
  } catch (error) {
    console.error("[p2p-escrow] request failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
