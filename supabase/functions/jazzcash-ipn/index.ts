import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST required" }), { status: 405, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    const raw = await req.text();
    let payload: Record<string, unknown> = {};

    if (contentType.includes("application/json")) {
      payload = raw ? JSON.parse(raw) : {};
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      payload = Object.fromEntries(new URLSearchParams(raw).entries());
    } else {
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }
    }

    // This endpoint intentionally does NOT credit coins from an unverified IPN.
    // IPN is only a notification. The existing backend verification flow must
    // confirm the transaction against JazzCash before any wallet credit occurs.
    const transactionId = String(
      payload.transactionId ?? payload.TransactionID ?? payload.pp_TxnRefNo ?? payload.pp_TxnId ?? ""
    );
    const status = String(
      payload.transactionStatus ?? payload.TransactionStatus ?? payload.pp_ResponseCode ?? payload.responseCode ?? ""
    );
    const amount = String(
      payload.transactionAmount ?? payload.TransactionAmount ?? payload.pp_Amount ?? payload.amount ?? ""
    );

    console.log(JSON.stringify({
      event: "jazzcash_ipn_received",
      transactionId,
      status,
      amount,
      receivedAt: new Date().toISOString(),
      payload,
    }));

    return new Response(JSON.stringify({
      ok: true,
      received: true,
      transactionId: transactionId || null,
    }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("jazzcash-ipn error", error);
    return new Response(JSON.stringify({ ok: false, error: "Invalid IPN payload" }), { status: 400, headers: corsHeaders });
  }
});
