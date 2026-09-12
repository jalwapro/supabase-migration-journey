import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Content-Type": "application/json" };

function hex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

function deepFind(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) if (record[key] !== undefined) return record[key];
  for (const value of Object.values(record)) {
    const found = deepFind(value, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "POST required" }), { status: 405, headers: cors });

  try {
    const webhookSecret = Deno.env.get("SAFE_PAY_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("Webhook secret is not configured");

    const raw = await req.text();
    const signature = req.headers.get("X-SFPY-SIGNATURE") || "";
    const timestamp = req.headers.get("X-SFPY-TIMESTAMP") || "";
    if (!signature) return new Response(JSON.stringify({ ok: false, error: "Missing signature" }), { status: 401, headers: cors });

    const signed = timestamp ? `${timestamp}.${raw}` : raw;
    const expected = await hmacSha256(webhookSecret, signed);
    const provided = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    if (provided !== expected) return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }), { status: 401, headers: cors });

    const payload = raw ? JSON.parse(raw) : {};
    const state = String(
      deepFind(payload, ["state", "status", "payment_status", "transaction_status"]) || "",
    ).toLowerCase();
    const tracker = String(deepFind(payload, ["tracker", "tracker_token"]) || "");
    const orderId = String(deepFind(payload, ["order_id"]) || "");
    const providerReference = String(deepFind(payload, ["charge", "token", "reference", "transaction_id"]) || "") || null;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let order = null;
    if (orderId) {
      const result = await supabase.from("card_recharge_orders").select("id,provider_tracker,status").eq("id", orderId).maybeSingle();
      order = result.data;
    }
    if (!order && tracker) {
      const result = await supabase.from("card_recharge_orders").select("id,provider_tracker,status").eq("provider_tracker", tracker).maybeSingle();
      order = result.data;
    }
    if (!order) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: cors });

    const success = ["completed", "paid", "success", "succeeded", "tracker_ended"].includes(state);
    const normalizedStatus = success ? "completed" : state || "pending";

    const { error } = await supabase.rpc("credit_card_recharge", {
      _order_id: order.id,
      _provider_status: normalizedStatus,
      _provider_reference: providerReference,
      _provider_payload: payload,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, orderId: order.id, status: normalizedStatus }), { status: 200, headers: cors });
  } catch (error) {
    console.error("card-recharge-webhook", error);
    return new Response(JSON.stringify({ ok: false, error: "Webhook processing failed" }), { status: 400, headers: cors });
  }
});
