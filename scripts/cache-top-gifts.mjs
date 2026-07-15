#!/usr/bin/env node
/**
 * cache-top-gifts.mjs
 *
 * Downloads the top-N most-sent gift clips into `public/gifts/` so they
 * load instantly (TikTok-style) instead of stalling on first cold fetch
 * from the Lovable CDN. Also merges each slug into
 * `src/lib/giftMedia.ts`'s LOCAL_GIFT_FILENAMES set so
 * `resolvePlayableGiftUrl()` starts serving the local copy.
 *
 * Usage:
 *   node scripts/cache-top-gifts.mjs          # top 20
 *   node scripts/cache-top-gifts.mjs 40       # top 40
 *
 * Requires (from .env, auto-loaded):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_GIFTS = resolve(ROOT, "public/gifts");
const GIFT_MEDIA_TS = resolve(ROOT, "src/lib/giftMedia.ts");

// --- Load .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) ---
function loadEnv() {
  const path = resolve(ROOT, ".env");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const LIMIT = Math.max(1, Math.min(100, Number(process.argv[2]) || 20));
const LOVABLE_ORIGIN = "https://cloud-to-soul.lovable.app";

function absolutize(url) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ORIGIN}${url}`;
  return url;
}

function extOf(url, clipType) {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.(mp4|webm)$/i);
  if (m) return m[1].toLowerCase();
  if (clipType === "mp4" || clipType === "webm") return clipType;
  return "mp4";
}

function baseOf(url) {
  const clean = url.split("?")[0].split("#")[0];
  const filename = clean.split("/").pop() || "";
  return filename.replace(/\.(mp4|webm)$/i, "");
}

async function callRpc() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_top_sent_gifts`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit_n: LIMIT }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RPC get_top_sent_gifts failed [${res.status}]: ${body}`);
  }
  return res.json();
}

// Repo hard-caps committed files at 10 MB. Skip anything larger so builds
// don't fail — those clips stay on the CDN with normal preload.
const MAX_BYTES = 10 * 1024 * 1024;

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    throw new Error(`too large (${(buf.length / 1024 / 1024).toFixed(1)} MB > 10 MB cap)`);
  }
  writeFileSync(destPath, buf);
  return buf.length;
}

function mergeLocalGiftFilenames(newSlugs) {
  const src = readFileSync(GIFT_MEDIA_TS, "utf8");
  const setRegex = /const LOCAL_GIFT_FILENAMES = new Set\(\[([\s\S]*?)\]\);/;
  const m = src.match(setRegex);
  if (!m) throw new Error("LOCAL_GIFT_FILENAMES set not found in giftMedia.ts");
  const existing = new Set(
    [...m[1].matchAll(/"([^"]+)"/g)].map((mm) => mm[1]),
  );
  const before = existing.size;
  for (const s of newSlugs) existing.add(s);
  if (existing.size === before) return { added: 0, total: existing.size };
  const sorted = [...existing].sort();
  const block =
    "const LOCAL_GIFT_FILENAMES = new Set([\n" +
    sorted.map((s) => `  "${s}",`).join("\n") +
    "\n]);";
  writeFileSync(GIFT_MEDIA_TS, src.replace(setRegex, block));
  return { added: existing.size - before, total: existing.size };
}

async function main() {
  console.log(`⬇  Fetching top ${LIMIT} most-sent gifts...`);
  const rows = await callRpc();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("ℹ  No gift_sends yet — nothing to cache.");
    return;
  }

  if (!existsSync(PUBLIC_GIFTS)) mkdirSync(PUBLIC_GIFTS, { recursive: true });

  const cachedSlugs = [];
  let skipped = 0;
  let downloaded = 0;
  let totalBytes = 0;

  for (const row of rows) {
    const clip = row.clip_path;
    if (!clip || !/\.(mp4|webm)(\?|#|$)/i.test(clip)) {
      console.log(`  · skip (no mp4/webm): ${row.name} → ${clip ?? "null"}`);
      skipped++;
      continue;
    }
    const base = baseOf(clip);
    const ext = extOf(clip, row.clip_type);
    const dest = resolve(PUBLIC_GIFTS, `${base}.${ext}`);
    cachedSlugs.push(base);

    if (existsSync(dest) && statSync(dest).size > 1024) {
      console.log(`  ✓ ${row.name.padEnd(28)}  cached  (${base}.${ext}, ${row.sends} sends)`);
      continue;
    }
    const url = absolutize(clip);
    try {
      const bytes = await download(url, dest);
      totalBytes += bytes;
      downloaded++;
      console.log(
        `  ⬇ ${row.name.padEnd(28)}  ${(bytes / 1024).toFixed(0).padStart(5)} KB  (${row.sends} sends)`,
      );
    } catch (err) {
      console.log(`  ✗ ${row.name}: ${err.message}`);
      skipped++;
    }
  }

  const merged = mergeLocalGiftFilenames(cachedSlugs);
  console.log("");
  console.log(`✅ Done. downloaded=${downloaded}  skipped=${skipped}  bytes=${(totalBytes / 1024).toFixed(0)} KB`);
  console.log(`   LOCAL_GIFT_FILENAMES: +${merged.added} new, ${merged.total} total`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
