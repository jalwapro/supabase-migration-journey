import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function hmacSha256Hex(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function secureHashMessage(payload: Record<string, string>, salt: string) {
  return salt + Object.entries(payload)
    .filter(([key, value]) => key !== "pp_SecureHash" && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => "&" + value)
    .join("");
}

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function loadAdminConfig() {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!baseUrl || !serviceKey) return {} as Record<string, unknown>;
  const res = await fetch(baseUrl + "/rest/v1/app_kv?select=value&key=eq.payments", {
    headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
  });
  if (!res.ok) return {} as Record<string, unknown>;
  const rows = await res.json();
  return (rows?.[0]?.value ?? {}) as Record<string, unknown>;
}

async function parsePayload(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const raw = await req.text();
  if (contentType.includes("application/json")) return raw ? JSON.parse(raw) : {};
  if (contentType.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw).entries());
  try { return raw ? JSON.parse(raw) : {}; } catch { return Object.fromEntries(new URLSearchParams(raw).entries()); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

  try {
    const payload = await parsePayload(req) as Record<string, unknown>;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined) normalized[key] = String(value);
    }

    const transactionRef = String(normalized.pp_TxnRefNo ?? normalized.transactionId ?? normalized.TransactionID ?? "");
    const transactionStatus = String(normalized.pp_ResponseCode ?? normalized.responseCode ?? normalized.TransactionStatus ?? normalized.transactionStatus ?? "").trim();
    const amountRaw = String(normalized.pp_Amount ?? normalized.TransactionAmount ?? normalized.transactionAmount ?? normalized.amount ?? "").trim();
    const merchantId = String(normalized.pp_MerchantID ?? normalized.MerchantID ?? "");
    const receivedHash = String(normalized.pp_SecureHash ?? normalized.secureHash ?? normalized.SecureHash ?? "").trim().toUpperCase();

    const admin = await loadAdminConfig();
    const expectedMerchant = String(Deno.env.get("JAZZCASH_MERCHANT_ID") || admin.jazzcashMerchantId || "").trim();
    const integritySalt = String(Deno.env.get("JAZZCASH_INTEGRITY_SALT") || "").trim();

    if (!transactionRef || !amountRaw || !receivedHash) return json({ ok: false, error: "Invalid callback payload" }, 400);
    if (!expectedMerchant || !integritySalt) return json({ ok: false, error: "Gateway verification is not configured" }, 503);
    if (merchantId && merchantId !== expectedMerchant) return json({ ok: false, error: "Merchant mismatch" }, 401);

    const expectedHash = (await hmacSha256Hex(secureHashMessage(normalized, integritySalt), integritySalt)).toUpperCase();
    if (!safeEqual(expectedHash, receivedHash)) {
      console.error(JSON.stringify({ event: "jazzcash_ipn_invalid_hash", transactionRef }));
      return json({ ok: false, error: "Invalid secure hash" }, 401);
    }

    const status = transactionStatus === "000" ? "success" : "failed";
    const amountPkr = Number(amountRaw) / 100;
    if (!Number.isFinite(amountPkr) || amountPkr <= 0) return json({ ok: false, error: "Invalid payment amount" }, 400);

    const baseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!baseUrl || !serviceKey) return json({ ok: false, error: "Server configuration error" }, 503);

    const rpc = await fetch(baseUrl + "/rest/v1/rpc/gateway_credit_recharge_by_ref", {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        _provider: "jazzcash",
        _order_ref: transactionRef,
        _provider_txn: transactionRef,
        _status: status,
        _amount_pkr: amountPkr,
        _raw: payload,
      }),
    });

    const result = await rpc.json().catch(() => ({}));
    if (!rpc.ok) {
      console.error("jazzcash-ipn credit RPC failed", rpc.status, result);
      return json({ ok: false, error: "Payment could not be finalized" }, 500);
    }

    console.log(JSON.stringify({ event: "jazzcash_ipn_processed", transactionRef, status, amountPkr, result, receivedAt: new Date().toISOString() }));
    return json({ ok: true, received: true, transactionId: transactionRef, result });
  } catch (error) {
    console.error("jazzcash-ipn error", error);
    return json({ ok: false, error: "Invalid IPN payload" }, 400);
  }
});
