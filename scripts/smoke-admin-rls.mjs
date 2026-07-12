#!/usr/bin/env node
/**
 * Admin gating smoke test.
 *
 * Verifies that admin-only tables/RPCs are:
 *   - reachable when signed in as an admin user
 *   - blocked (via RLS or has_role check) for a non-admin user
 *   - blocked for an anonymous (no session) client
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   USER_EMAIL=...  USER_PASSWORD=...  \
 *   node scripts/smoke-admin-rls.mjs
 *
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY from .env.
 * Exits non-zero if any assertion fails so it can be wired into CI.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// -- load .env (minimal parser, no dep) --------------------------------------
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const { ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD } = process.env;

if (!URL || !KEY) fail("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) fail("Missing ADMIN_EMAIL / ADMIN_PASSWORD env vars");
if (!USER_EMAIL || !USER_PASSWORD) fail("Missing USER_EMAIL / USER_PASSWORD env vars");

function client() {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function signIn(email, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client: c, userId: data.user.id };
}
function fail(msg) { console.error("✖", msg); process.exitCode = 1; }
function pass(msg) { console.log("✔", msg); }

// Admin surfaces to probe. Each entry is a single Data-API read or RPC that
// admin tabs rely on. `expectAdmin: "ok"` = row/data returned; `expectOther:
// "denied"` = permission error OR empty (has_role gate returns nothing).
const PROBES = [
  { label: "profiles.select (users tab)", run: (c) => c.from("profiles").select("id,username,coins,diamonds").limit(3) },
  { label: "recharge_requests.select",    run: (c) => c.from("recharge_requests").select("id,status").limit(3) },
  { label: "withdrawal_requests.select",  run: (c) => c.from("withdrawal_requests").select("id,status").limit(3) },
  { label: "admin_logs.select",           run: (c) => c.from("admin_logs").select("id").limit(3) },
  { label: "user_reports.select",         run: (c) => c.from("user_reports").select("id").limit(3) },
  { label: "user_roles.select",           run: (c) => c.from("user_roles").select("user_id,role").limit(3) },
  { label: "vip_admin_logs.select",       run: (c) => c.from("vip_admin_logs").select("id").limit(3) },
  { label: "support_tickets.select",      run: (c) => c.from("support_tickets").select("id").limit(3) },
  { label: "partners.select",             run: (c) => c.from("partners").select("id").limit(3) },
  { label: "rpc adjust_coins (0 delta)",  run: (c, uid) => c.rpc("adjust_coins", { p_user_id: uid, p_delta: 0, p_reason: "smoke" }) },
];

function isDenied(res) {
  if (res.error) {
    const m = (res.error.message || "").toLowerCase();
    return m.includes("permission denied") || m.includes("not allowed") ||
           m.includes("must be admin") || m.includes("unauthorized") ||
           m.includes("policy") || res.error.code === "42501" || res.error.code === "PGRST301";
  }
  // For has_role-gated tables, RLS silently returns 0 rows to non-admins.
  return Array.isArray(res.data) && res.data.length === 0;
}

async function run() {
  console.log("→ signing in admin + regular user…");
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  const user  = await signIn(USER_EMAIL, USER_PASSWORD);
  const anon  = client();

  // sanity: has_role
  const adminHas = await admin.client.rpc("has_role", { _user_id: admin.userId, _role: "admin" });
  const userHas  = await user.client.rpc("has_role",  { _user_id: user.userId,  _role: "admin" });
  if (adminHas.error || adminHas.data !== true) fail(`admin has_role should be true (got ${JSON.stringify(adminHas)})`);
  else pass("admin has_role('admin') = true");
  if (userHas.error || userHas.data === true)  fail(`regular user has_role should be false (got ${JSON.stringify(userHas)})`);
  else pass("regular user has_role('admin') = false");

  for (const p of PROBES) {
    const a = await p.run(admin.client, admin.userId);
    const u = await p.run(user.client,  user.userId);
    const n = await p.run(anon,         admin.userId);

    if (a.error) fail(`[admin]   ${p.label} — expected ok, got error: ${a.error.message}`);
    else         pass(`[admin]   ${p.label} — ok`);

    if (!isDenied(u)) fail(`[user]    ${p.label} — expected denied/empty, got ${JSON.stringify(u.data)?.slice(0,120)}`);
    else              pass(`[user]    ${p.label} — blocked`);

    if (!isDenied(n)) fail(`[anon]    ${p.label} — expected denied/empty, got ${JSON.stringify(n.data)?.slice(0,120)}`);
    else              pass(`[anon]    ${p.label} — blocked`);
  }

  await admin.client.auth.signOut();
  await user.client.auth.signOut();

  if (process.exitCode) console.error("\n✖ smoke test FAILED");
  else console.log("\n✔ all admin-gating probes passed");
}

run().catch((e) => { fail(e.message || String(e)); });
