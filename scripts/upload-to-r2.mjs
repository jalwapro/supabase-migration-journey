// Upload local files to Cloudflare R2 (the project's only storage provider).
// Usage: bun scripts/upload-to-r2.mjs <prefix> <file...>
// Prints "<localPath>\t<publicUrl>" per line.
import { AwsClient } from "aws4fetch";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_BASE = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
const ENDPOINT = (process.env.R2_ENDPOINT ?? "").replace(/\/+$/, "");
const BUCKET = process.env.R2_BUCKET;

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4",
  ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
};

const client = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const [prefix, ...files] = process.argv.slice(2);
if (!prefix || files.length === 0) {
  console.error("usage: bun scripts/upload-to-r2.mjs <prefix> <file...>");
  process.exit(1);
}

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const key = `${prefix.replace(/^\/+|\/+$/g, "")}/${path.basename(file)}`;
  const body = await readFile(file);
  const res = await client.fetch(`${ENDPOINT}/${BUCKET}/${key}`, {
    method: "PUT",
    body,
    headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
  });
  if (!res.ok) {
    console.error(`FAILED ${file}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`${file}\t${PUBLIC_BASE}/${key}`);
}
