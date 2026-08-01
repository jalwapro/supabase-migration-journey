// One-time / repeatable audit + migration: move every asset URL in the DB to Cloudflare R2.
// Usage: bun scripts/migrate-assets-to-r2.mjs [--dry]
import { AwsClient } from "aws4fetch";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const LOVABLE_ORIGIN = "https://cloud-to-soul.lovable.app";
const PUBLIC_BASE = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
const ENDPOINT = (process.env.R2_ENDPOINT ?? "").replace(/\/+$/, "");
const BUCKET = process.env.R2_BUCKET;

const client = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const sql = postgres(process.env.JALWA_DB_URL, { max: 4 });

// (table, [columns]) pairs that hold asset URLs
const TARGETS = [
  ["gifts", ["clip_path", "icon_path", "image_url", "sound_url", "icon"]],
  ["gift_categories", ["icon"]],
  ["chat_emojis", ["clip_path"]],
  ["entrance_effects", ["media_url", "sound_url", "thumbnail_url"]],
  ["themes", ["animation_url", "bg_image", "preview_url"]],
  ["theme_categories", ["icon_url"]],
  ["custom_themes", ["image_url"]],
  ["room_backgrounds", ["image_url"]],
  ["room_top_frames", ["media_url"]],
  ["profile_cards", ["bg_media_url", "thumbnail_url"]],
  ["spotlight_animations", ["bg_animation_url", "overlay_asset_url"]],
  ["vip_level_config", ["badge_url", "bubble_url", "entrance_url", "frame_url"]],
  ["banners", ["image", "image_url"]],
  ["ads", ["image_url"]],
  ["categories", ["icon"]],
  ["games", ["icon"]],
  ["app_settings", ["splash_image", "splash_video", "splash_video_poster"]],
  ["profiles", ["avatar"]],
  ["live_rooms", ["cover_url"]],
];

const MIME = {
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".json": "application/json", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".ogg": "audio/ogg", ".aac": "audio/aac", ".m4a": "audio/mp4",
  ".svga": "application/octet-stream",
};

function isR2(u) {
  return !!u && PUBLIC_BASE && u.startsWith(PUBLIC_BASE);
}

function migratable(u) {
  if (!u || typeof u !== "string") return false;
  const v = u.trim();
  if (!v || isR2(v)) return false;
  if (v.startsWith("data:") || v.startsWith("blob:")) return false;
  // relative local asset or remote http(s) asset with a known media extension
  const ext = path.extname(v.split("?")[0].split("#")[0]).toLowerCase();
  if (!MIME[ext]) return false;
  return v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://");
}

async function loadBytes(u) {
  const clean = u.split("?")[0].split("#")[0];
  if (u.startsWith("/")) {
    // local file in public/ — may be replaced by a .asset.json pointer
    const local = path.join(process.cwd(), "public", clean);
    try {
      return new Uint8Array(await readFile(local));
    } catch {
      try {
        const ptr = JSON.parse(await readFile(`${local}.asset.json`, "utf8"));
        return await fetchBytes(`${LOVABLE_ORIGIN}${ptr.url}`);
      } catch {
        return await fetchBytes(`${LOVABLE_ORIGIN}${clean}`);
      }
    }
  }
  return await fetchBytes(u);
}

async function fetchBytes(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

function keyFor(u) {
  const clean = u.split("?")[0].split("#")[0];
  const base = path.basename(clean);
  let folder = "assets";
  if (/\.(mp4|webm|mov)$/i.test(base)) folder = "gifts/videos";
  else if (/\.(mp3|wav|ogg|aac|m4a)$/i.test(base)) folder = "gifts/audio";
  else if (/\.(png|jpe?g|webp|gif|svg)$/i.test(base)) folder = "assets/images";
  else if (/\.(json|svga)$/i.test(base)) folder = "assets/data";
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${folder}/${safe}`;
}

const uploaded = new Map(); // source url -> public url

async function head(key) {
  const res = await client.fetch(`${ENDPOINT}/${BUCKET}/${key}`, { method: "HEAD" });
  return res.ok;
}

async function migrate(u) {
  if (uploaded.has(u)) return uploaded.get(u);
  const key = keyFor(u);
  const publicUrl = `${PUBLIC_BASE}/${key}`;
  if (await head(key)) {
    uploaded.set(u, publicUrl);
    return publicUrl;
  }
  const bytes = await loadBytes(u);
  const ext = path.extname(u.split("?")[0]).toLowerCase();
  const res = await client.fetch(`${ENDPOINT}/${BUCKET}/${key}`, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`upload failed ${res.status} for ${key}`);
  uploaded.set(u, publicUrl);
  return publicUrl;
}

let scanned = 0, moved = 0, failed = 0;

for (const [table, cols] of TARGETS) {
  let exists;
  try {
    exists = await sql`select 1 from information_schema.tables where table_schema='public' and table_name=${table}`;
  } catch { continue; }
  if (!exists.length) continue;

  const present = (
    await sql`select column_name from information_schema.columns where table_schema='public' and table_name=${table}`
  ).map((r) => r.column_name);
  const use = cols.filter((c) => present.includes(c));
  if (!use.length) continue;

  const rows = await sql`select id, ${sql.unsafe(use.join(", "))} from ${sql(table)}`;
  for (const row of rows) {
    for (const col of use) {
      const val = row[col];
      if (!migratable(val)) continue;
      scanned++;
      try {
        const next = await migrate(val.trim());
        if (!DRY) {
          await sql`update ${sql(table)} set ${sql(col)} = ${next} where id = ${row.id}`;
        }
        moved++;
        console.log(`✓ ${table}.${col} ${val} -> ${next}`);
      } catch (e) {
        failed++;
        console.warn(`✗ ${table}.${col} ${val}: ${e.message}`);
      }
    }
  }
}

console.log(`\nscanned=${scanned} migrated=${moved} failed=${failed} dry=${DRY}`);
await sql.end();
