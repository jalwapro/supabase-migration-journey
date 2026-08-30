import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(key: Uint8Array | ArrayBuffer, data: string | Uint8Array) {
  const raw = key instanceof ArrayBuffer ? key : key;
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const out = await crypto.subtle.sign("HMAC", cryptoKey, typeof data === "string" ? enc.encode(data) : data);
  return new Uint8Array(out);
}

async function sha256(data: Uint8Array) {
  return hex(await crypto.subtle.digest("SHA-256", data));
}

async function signingKey(secret: string, date: string, region: string, service: string) {
  const kDate = await hmac(enc.encode("AWS4" + secret), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Authentication required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Authentication required");

    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "voice-room-slides").replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "voice-room-slides";
    if (!(file instanceof File)) throw new Error("Image file is required");
    if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
    if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8MB or smaller");

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKey = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME") || "jalwa";
    const publicBase = (Deno.env.get("R2_PUBLIC_URL") || Deno.env.get("R2_PUBLIC_BASE_URL") || "").replace(/\/$/, "");
    if (!accountId || !accessKey || !secretKey || !publicBase) {
      throw new Error("R2 upload is not configured on the server");
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;
    const body = new Uint8Array(await file.arrayBuffer());
    const region = "auto";
    const service = "s3";
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const path = `/${encodePath(bucket)}/${encodePath(key)}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = await sha256(body);
    const canonicalHeaders = `content-type:${file.type}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [req.method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${date}/${region}/${service}/aws4_request`;
    const canonicalHash = await sha256(enc.encode(canonicalRequest));
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${canonicalHash}`;
    const keyBytes = await signingKey(secretKey, date, region, service);
    const signature = hex(await hmac(keyBytes, stringToSign));
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(`https://${host}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "Host": host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
      body,
    });
    if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);

    const url = `${publicBase}/${key}`;
    return new Response(JSON.stringify({ url, key, size: file.size, content_type: file.type, uploaded_by: user.id }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
