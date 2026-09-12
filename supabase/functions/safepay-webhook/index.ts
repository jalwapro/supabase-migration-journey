import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-sfpy-signature",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase service configuration is missing");

    const raw = await req.text();
    if (!raw) throw new Error("Empty webhook body");

    // Safepay can be configured to sign webhooks. If a webhook secret is present,
    // verify the HMAC before touching the wallet. This keeps the endpoint safe in
    // environments where signature verification is configured, while still allowing
    // the existing Safepay dashboard webhook flow when no secret is configured yet.
    const webhookSecret = Deno.env.get("SAFEPAY_WEBHOOK_SECRET") || Deno.env.get("SAFE_PAY_WEBHOOK_SECRET");
    const signature = req.headers.get("X-SFPY-SIGNATURE") || req.headers.get("x-sfpy-signature");
    if (webhookSecret) {
      if (!signature) return json({ ok: false, error: "Missing webhook signature" }, 401);
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const normalized = signature.replace(/^sha256=/i, "").trim();
      let bytes: Uint8Array;
      try {
        const binary = atob(normalized);
        bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      } catch {
        bytes = new Uint8Array(normalized.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);
      }
      const valid = await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(raw));
      if (!valid) return json({ ok: false, error: "Invalid webhook signature" }, 401);
    }

    const payload = JSON.parse(raw);
    const notification = payload?.notification ?? payload?.data?.notification ?? payload?.data ?? payload;
    const tracker = String(notification?.tracker ?? payload?.tracker ?? "").trim();
    const status = normalizeStatus(notification?.state ?? notification?.status ?? payload?.state ?? payload?.status);
    const reference = String(notification?.reference ?? payload?.reference ?? notification?.transaction_reference ?? "").trim() || null;

    if (!tracker) return json({ ok: false, error: "Missing tracker" }, 400);
    if (!status) return json({ ok: false, error: "Missing payment state" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: order, error: lookupError } = await admin
      .from("card_recharge_orders")
      .select("id, provider_tracker, status")
      .eq("provider_tracker", tracker)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!order) return json({ ok: false, error: "Unknown tracker" }, 404);

    const { data: settled, error: settleError } = await admin.rpc("credit_card_recharge", {
      _order_id: order.id,
      _provider_status: status,
      _provider_reference: reference,
      _provider_payload: payload,
    });
    if (settleError) throw settleError;

    return json({ ok: true, orderId: order.id, status: settled?.status ?? order.status });
  } catch (error) {
    console.error("safepay-webhook", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Webhook processing failed" }, 400);
  }
});
