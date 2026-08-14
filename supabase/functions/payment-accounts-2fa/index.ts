import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const ALLOWED = "jalwaapplive@gmail.com";
const ISSUER = "Jalwa Pro Payment Accounts";

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
function base32Encode(bytes: Uint8Array) { const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, value = 0, out = ""; for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += alphabet[(value << (5 - bits)) & 31]; return out; }
function base32Decode(input: string) { const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; const clean = input.replace(/=+$/g, "").toUpperCase(); let bits = 0, value = 0; const out: number[] = []; for (const c of clean) { const n = alphabet.indexOf(c); if (n < 0) throw new Error("Invalid TOTP secret"); value = (value << 5) | n; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
function timingSafeEqual(a: string, b: string) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
async function totp(secret: string, time = Date.now()) { const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]); const counter = Math.floor(time / 30000); const msg = new ArrayBuffer(8); const view = new DataView(msg); view.setUint32(0, Math.floor(counter / 0x100000000)); view.setUint32(4, counter >>> 0); const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg)); const offset = mac[mac.length - 1] & 15; const bin = ((mac[offset] & 127) << 24) | ((mac[offset + 1] & 255) << 16) | ((mac[offset + 2] & 255) << 8) | (mac[offset + 3] & 255); return String(bin % 1000000).padStart(6, "0"); }
async function verifyTotp(secret: string, code: string) { const normalized = String(code).replace(/\s/g, ""); if (!/^\d{6}$/.test(normalized)) return false; const now = Date.now(); for (const delta of [-30000, 0, 30000]) { if (timingSafeEqual(await totp(secret, now + delta), normalized)) return true; } return false; }
function randomSecret() { const bytes = new Uint8Array(20); crypto.getRandomValues(bytes); return base32Encode(bytes); }
function otpauth(email: string, secret: string) { return `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization"); if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== ALLOWED) return json({ error: "Access denied" }, 403);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, code } = await req.json();
    const { data: row } = await admin.from("admin_payment_2fa").select("secret,enabled").eq("user_id", user.id).maybeSingle();
    if (action === "status") return json({ configured: Boolean(row?.secret), enabled: Boolean(row?.enabled) });
    if (action === "setup") {
      if (row?.secret && row.enabled) return json({ error: "2FA is already enabled" }, 409);
      const secret = randomSecret(); const uri = otpauth(user.email!, secret);
      const { error } = await admin.from("admin_payment_2fa").upsert({ user_id: user.id, email: user.email!.toLowerCase(), secret, enabled: false, updated_at: new Date().toISOString() });
      if (error) throw error; return json({ secret, otpauth: uri });
    }
    if (action === "enable") {
      if (!row?.secret || !(await verifyTotp(row.secret, code))) return json({ error: "Invalid Authenticator code" }, 400);
      const { error } = await admin.from("admin_payment_2fa").update({ enabled: true, updated_at: new Date().toISOString() }).eq("user_id", user.id); if (error) throw error; return json({ enabled: true });
    }
    if (action === "verify") {
      if (!row?.secret || !row.enabled || !(await verifyTotp(row.secret, code))) return json({ verified: false, error: "Invalid Authenticator code" }, 401);
      return json({ verified: true, expiresInSeconds: 900 });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "2FA error" }, 500); }
});
