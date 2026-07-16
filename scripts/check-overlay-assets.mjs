#!/usr/bin/env node
/**
 * Overlay Quality Check
 * ---------------------
 * Scans PNG overlays before they are uploaded to the Lovable CDN and flags:
 *   - missing files
 *   - non-PNG / corrupt files
 *   - fully transparent images (alpha coverage below threshold)
 *   - visible-pixel coverage too low (mostly-empty stickers)
 *   - suspicious dimensions or file size
 *
 * Usage:
 *   node scripts/check-overlay-assets.mjs <dir-or-file> [--min-alpha=0.02] [--min-size=2048]
 *
 * Examples:
 *   node scripts/check-overlay-assets.mjs /tmp/ar
 *   node scripts/check-overlay-assets.mjs /tmp/ar/laser-eyes.png --min-alpha=0.05
 *
 * Exit codes:
 *   0 = all overlays passed
 *   1 = one or more overlays failed (do NOT upload)
 *   2 = bad invocation
 */
import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { extname, join, basename, resolve } from "node:path";
import { inflateSync } from "node:zlib";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: check-overlay-assets.mjs <dir-or-file> [--min-alpha=0.02] [--min-size=2048]");
  process.exit(2);
}

// Defaults tuned for sticker-style PNGs (small subject on transparent bg).
// visibleFrac is the primary signal; meanAlpha stays low as a soft check.
const opts = { minAlpha: 0.003, minSize: 4096, minVisibleFrac: 0.005 };
const targets = [];
for (const a of args) {
  if (a.startsWith("--min-alpha=")) opts.minAlpha = Number(a.split("=")[1]);
  else if (a.startsWith("--min-size=")) opts.minSize = Number(a.split("=")[1]);
  else if (a.startsWith("--min-visible=")) opts.minVisibleFrac = Number(a.split("=")[1]);
  else targets.push(a);
}

// --- collect .png files ---
function collect(pathArg) {
  const p = resolve(pathArg);
  if (!existsSync(p)) return [{ path: p, missing: true }];
  const s = statSync(p);
  if (s.isDirectory()) {
    return readdirSync(p)
      .filter((f) => extname(f).toLowerCase() === ".png")
      .map((f) => ({ path: join(p, f) }));
  }
  return [{ path: p }];
}

const files = targets.flatMap(collect);
if (files.length === 0) {
  console.error("no .png files found");
  process.exit(2);
}

// --- minimal PNG parser: read IHDR + concatenate IDAT + inflate ---
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parsePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("not a PNG (bad signature)");
  }
  let off = 8;
  let ihdr = null;
  const idats = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.subarray(off, off + 4).toString("ascii"); off += 4;
    const data = buf.subarray(off, off + len); off += len;
    off += 4; // CRC
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data.readUInt8(8),
        colorType: data.readUInt8(9),
        interlace: data.readUInt8(12),
      };
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") break;
  }
  if (!ihdr) throw new Error("no IHDR chunk");
  return { ihdr, idat: Buffer.concat(idats) };
}

// Sample alpha coverage. Only supports the common case: 8-bit RGBA
// (colorType 6) non-interlaced, which is what imagegen/lovable-assets output.
// For other formats we skip the pixel check and only verify file validity.
function alphaCoverage({ ihdr, idat }) {
  if (ihdr.colorType !== 6 || ihdr.bitDepth !== 8 || ihdr.interlace !== 0) {
    return null; // unsupported for pixel analysis
  }
  const raw = inflateSync(idat);
  const { width, height } = ihdr;
  const stride = width * 4 + 1; // +1 filter byte per scanline
  if (raw.length < stride * height) return null;

  // Sample up to ~10k pixels evenly (skip filter reconstruction — sampling
  // raw pixel bytes tells us alpha density well enough for a QA check).
  const sampleRows = Math.min(height, 200);
  const sampleCols = Math.min(width, 200);
  const rowStep = Math.max(1, Math.floor(height / sampleRows));
  const colStep = Math.max(1, Math.floor(width / sampleCols));

  let visible = 0;
  let opaque = 0;
  let total = 0;
  let alphaSum = 0;
  for (let y = 0; y < height; y += rowStep) {
    const rowOff = y * stride + 1; // skip filter byte
    for (let x = 0; x < width; x += colStep) {
      const a = raw[rowOff + x * 4 + 3];
      total++;
      alphaSum += a;
      if (a > 8) visible++;
      if (a > 240) opaque++;
    }
  }
  return {
    meanAlpha: alphaSum / total / 255,
    visibleFrac: visible / total,
    opaqueFrac: opaque / total,
    width, height,
  };
}

// --- run checks ---
const results = [];
for (const f of files) {
  const name = basename(f.path);
  const issues = [];
  if (f.missing) {
    results.push({ name, path: f.path, ok: false, issues: ["file missing"] });
    continue;
  }
  let stat;
  try { stat = statSync(f.path); } catch (e) {
    results.push({ name, path: f.path, ok: false, issues: [`stat failed: ${e.message}`] });
    continue;
  }
  if (stat.size < opts.minSize) issues.push(`file too small (${stat.size}B < ${opts.minSize}B)`);

  let parsed;
  try {
    parsed = parsePng(readFileSync(f.path));
  } catch (e) {
    results.push({ name, path: f.path, ok: false, size: stat.size, issues: [...issues, e.message] });
    continue;
  }

  let cov = null;
  try { cov = alphaCoverage(parsed); } catch (e) {
    issues.push(`decode failed: ${e.message}`);
  }

  if (cov) {
    if (cov.meanAlpha < opts.minAlpha) {
      issues.push(`nearly transparent (meanAlpha=${cov.meanAlpha.toFixed(3)} < ${opts.minAlpha})`);
    }
    if (cov.visibleFrac < opts.minVisibleFrac) {
      issues.push(`too few visible pixels (${(cov.visibleFrac * 100).toFixed(2)}%)`);
    }
    if (cov.width < 128 || cov.height < 128) {
      issues.push(`dimensions too small (${cov.width}x${cov.height})`);
    }
  }

  results.push({
    name,
    path: f.path,
    ok: issues.length === 0,
    size: stat.size,
    dims: parsed.ihdr.width + "x" + parsed.ihdr.height,
    coverage: cov,
    issues,
  });
}

// --- report ---
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("STATUS", 8) + pad("NAME", 28) + pad("SIZE", 10) + pad("DIMS", 12) + pad("VISIBLE%", 10) + "ISSUES");
console.log("-".repeat(90));
let failed = 0;
for (const r of results) {
  const status = r.ok ? "✓ pass" : "✗ FAIL";
  const vis = r.coverage ? (r.coverage.visibleFrac * 100).toFixed(1) + "%" : "-";
  console.log(
    pad(status, 8) +
      pad(r.name, 28) +
      pad(r.size ? r.size + "B" : "-", 10) +
      pad(r.dims || "-", 12) +
      pad(vis, 10) +
      (r.issues.join("; ") || ""),
  );
  if (!r.ok) failed++;
}
console.log("-".repeat(90));
console.log(`${results.length - failed}/${results.length} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
