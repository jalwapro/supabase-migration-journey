import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Content-Type": "application/json" };

function hex(bytes: Uint8Array) { return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function hmac(secret: string, message: string, hash: "SHA-256" | "SHA-512") {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}
function text(v: unknown) { return typeof v === "string" || typeof v === "number" ? String(v) : ""; }
function nestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  if (current && typeof current === "object" && "value" in (current as Record<string, unknown>)) current = (current as Record<string, unknown>).value;
  return current;
}
function findString(obj: unknown, keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  for (const value of Object.values(record)) {
    const found = findString(value, keys);
    if (found) return found;
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "POST required" }), { status: 405, headers: cors });
  try {
    const secret = Deno.env.get("SAFE_PAY_WEBHOOK_SECRET");
    if (!secret) throw new Error("Webhook secret is not configured");
    const raw = await req.text();
    const signature = (req.headers.get("X-SFPY-SIGNATURE") || "").replace(/^sha(256|512)=/i, "").trim().toLowerCase();
    const timestamp = req.headers.get("X-SFPY-TIMESTAMP") || "";
    if (!signature) return new Response(JSON.stringify({ ok: false, error: "Missing signature" }), { status: 401, headers: cors });

    const candidates = [
      await hmac(secret, timestamp ? `${timestamp}.${raw}` : raw, "SHA-256"),
      await hmac(secret, raw, "SHA-256"),
      await hmac(secret, raw, "SHA-512"),
    ];
    if (!candidates.includes(signature)) return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }), { status: 401, headers: cors });

    const payload = raw ? JSON.parse(raw) : {};
    const state = findString(payload, ["state", "status", "payment_status", "transaction_status"]).toLowerCase();
    const tracker = text(nestedValue(payload, ["tracker", "token"])) || findString(payload, ["tracker_token"]);
    const orderId = text(nestedValue(payload, ["metadata", "order_id"])) || findString(payload, ["order_id"]);
    const providerReference = text(nestedValue(payload, ["charge", "token"])) || findString(payload, ["reference", "transaction_id"]);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let order = null;
    if (orderId) order = (await supabase.from("card_recharge_orders").select("id,provider_tracker,status").eq("id", orderId).maybeSingle()).data;
    if (!order && tracker) order = (await supabase.from("card_recharge_orders").select("id,provider_tracker,status").eq("provider_tracker", tracker).maybeSingle()).data;
    if (!order) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: cors });

    const normalizedStatus = ["completed", "paid", "success", "succeeded", "tracker_ended"].includes(state) ? "completed" : state || "pending";
    const { error } = await supabase.rpc("credit_card_recharge", {
      _order_id: order.id,
      _provider_status: normalizedStatus,
      _provider_reference: providerReference || null,
      _provider_payload: payload,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, orderId: order.id, status: normalizedStatus }), { status: 200, headers: cors });
  } catch (error) {
    console.error("card-recharge-webhook", error);
    return new Response(JSON.stringify({ ok: false, error: "Webhook processing failed" }), { status: 400, headers: cors });
  }
});
