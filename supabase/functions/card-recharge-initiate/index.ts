import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "POST required" }), { status: 405, headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Support the new SAFEPAY_* names as well as the legacy names already used by
    // this project. Secrets remain server-side; never expose them to the browser.
    const safepaySecret = Deno.env.get("SAFEPAY_SECRET_KEY") || Deno.env.get("SAFE_PAY_SECRET_KEY");
    const safepayMerchantKey = Deno.env.get("SAFEPAY_PUBLIC_KEY") || Deno.env.get("SAFE_PAY_MERCHANT_API_KEY");
    const safepayBase = Deno.env.get("SAFEPAY_BASE_URL") || Deno.env.get("SAFE_PAY_BASE_URL") || "https://sandbox.api.getsafepay.com";
    const appBase = Deno.env.get("APP_BASE_URL") || "https://www.jalwa.pro";
    if (!safepaySecret || !safepayMerchantKey) throw new Error("Card payment gateway is not configured");

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Please login again");

    const body = await req.json();
    const packageId = String(body.packageId || "");
    if (!packageId) throw new Error("packageId is required");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: order, error: orderError } = await userClient.rpc("create_card_recharge_order", { _package_id: packageId });
    if (orderError || !order) throw new Error(orderError?.message || "Unable to create payment order");

    const response = await fetch(`${safepayBase}/order/payments/v3/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${safepaySecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_api_key: safepayMerchantKey,
        intent: "CYBERSOURCE",
        mode: "payment",
        currency: "PKR",
        amount: Math.round(Number(order.amount_pkr) * 100),
        metadata: { order_id: order.id },
      }),
    });
    const provider = await response.json();
    if (!response.ok) throw new Error(provider?.status?.message || provider?.message || "Payment gateway rejected the request");
    const tracker = provider?.data?.tracker?.token || provider?.tracker?.token;
    if (!tracker) throw new Error("Payment gateway did not return a tracker");

    const { error: updateError } = await admin.from("card_recharge_orders").update({ provider_tracker: tracker, provider_status: provider?.data?.tracker?.state || null }).eq("id", order.id).eq("user_id", userData.user.id).eq("status", "pending");
    if (updateError) throw updateError;

    const checkoutBase = safepayBase.includes("sandbox") ? "https://sandbox.api.getsafepay.com/checkout/pay" : "https://getsafepay.com/checkout/pay";
    const redirect = `${appBase.replace(/\/$/, "")}/recharge?card_payment=${encodeURIComponent(order.id)}`;
    const checkoutUrl = `${checkoutBase}?tracker=${encodeURIComponent(tracker)}&source=hosted&redirect_url=${encodeURIComponent(redirect)}&cancel_url=${encodeURIComponent(redirect)}`;
    return new Response(JSON.stringify({ ok: true, orderId: order.id, tracker, checkoutUrl }), { status: 200, headers: cors });
  } catch (error) {
    console.error("card-recharge-initiate", error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unable to start card payment" }), { status: 400, headers: cors });
  }
});
