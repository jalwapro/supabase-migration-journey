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

function makeSecureHash(payload: Record<string, string>, salt: string) {
  const values = Object.entries(payload)
    .filter(([key, value]) => key !== "pp_SecureHash" && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => `&${value}`)
    .join("");
  return hmacSha256Hex(`${salt}${values}`, salt);
}

async function loadAdminConfig() {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!baseUrl || !serviceKey) return {} as Record<string, unknown>;
  const res = await fetch(`${baseUrl}/rest/v1/app_kv?select=value&key=eq.payments`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return {} as Record<string, unknown>;
  const rows = await res.json();
  return (rows?.[0]?.value ?? {}) as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

  try {
    const body = await req.json();
    const amountPkr = Number(body.amountPkr);
    const mobileNumber = String(body.mobileNumber ?? "").trim();
    const cnicLast6 = String(body.cnicLast6 ?? "").trim();
    const transactionRef = String(body.transactionRef ?? "").trim();
    const billReference = String(body.billReference ?? "").trim();
    const description = String(body.description ?? "Jalwa Pro recharge").trim();

    if (!Number.isFinite(amountPkr) || amountPkr <= 0) return json({ ok: false, error: "Invalid amount" }, 400);
    if (!/^03\d{9}$/.test(mobileNumber)) return json({ ok: false, error: "Invalid JazzCash mobile number" }, 400);
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(transactionRef)) return json({ ok: false, error: "Invalid transaction reference" }, 400);

    const admin = await loadAdminConfig();
    if (!Boolean(admin.jazzcashApiEnabled)) {
      return json({ ok: false, error: "JazzCash automatic gateway is disabled in Admin → Payment Accounts" }, 409);
    }

    const apiUrl = String(admin.jazzcashApiUrl || Deno.env.get("JAZZCASH_API_URL") || "").trim();
    const merchantId = String(admin.jazzcashMerchantId || Deno.env.get("JAZZCASH_MERCHANT_ID") || "").trim();
    const password = Deno.env.get("JAZZCASH_PASSWORD")?.trim() || "";
    const integritySalt = Deno.env.get("JAZZCASH_INTEGRITY_SALT")?.trim() || "";

    if (!apiUrl || !merchantId || !password || !integritySalt) {
      return json({ ok: false, error: "JazzCash automatic gateway is not fully configured. Add API URL and Merchant ID in Admin, and keep Password/Integrity Salt in backend secrets." }, 503);
    }

    // The documented JazzCash Mobile Account REST APIs require pp_CNIC.
    // We do not fake or bypass a gateway-required field.
    if (!/^\d{6}$/.test(cnicLast6)) {
      return json({ ok: false, error: "The configured JazzCash Mobile Account API requires the customer's last 6 CNIC digits." }, 400);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const txnDateTime = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
    const expiry = new Date(now.getTime() + 30 * 60 * 1000);
    const txnExpiry = `${expiry.getUTCFullYear()}${pad(expiry.getUTCMonth() + 1)}${pad(expiry.getUTCDate())}${pad(expiry.getUTCHours())}${pad(expiry.getUTCMinutes())}${pad(expiry.getUTCSeconds())}`;

    const payload: Record<string, string> = {
      pp_Version: "2.0",
      pp_TxnType: "MWALLET",
      pp_Language: "EN",
      pp_MerchantID: merchantId,
      pp_SubMerchantID: "",
      pp_Password: password,
      pp_TxnRefNo: transactionRef,
      pp_MobileNumber: mobileNumber,
      pp_CNIC: cnicLast6,
      pp_Amount: String(Math.round(amountPkr * 100)),
      pp_DiscountedAmount: "",
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: billReference || transactionRef,
      pp_Description: description,
      pp_TxnExpiryDateTime: txnExpiry,
      pp_SecureHash: "",
      ppmpf_1: "JALWA",
      ppmpf_2: transactionRef,
      ppmpf_3: "",
      ppmpf_4: "",
      ppmpf_5: "",
    };

    payload.pp_SecureHash = await makeSecureHash(payload, integritySalt);

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let response: unknown = text;
    try { response = JSON.parse(text); } catch { /* keep raw response */ }

    return json({ ok: upstream.ok, upstreamStatus: upstream.status, transactionRef, response }, upstream.ok ? 200 : 502);
  } catch (error) {
    console.error("jazzcash-initiate error", error);
    return json({ ok: false, error: "JazzCash request failed" }, 500);
  }
});
