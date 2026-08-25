import { normalizeRenderConfig, type GiftRenderConfig } from "@/lib/giftRender";
import { supabase } from "@/integrations/supabase/client";

export type EntrancePublishInput = {
  id: string;
  mediaUrl: string;
  mediaType?: string | null;
  durationMs?: number | null;
  renderConfig: unknown;
};

export type EntrancePublishResult = {
  publishedRenderUrl: string;
  bytes: number;
  durationMs: number;
};

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((x) => MediaRecorder.isTypeSupported(x)) ?? "video/webm";
}

function waitForVideo(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Entrance source video could not be loaded. Check the media URL/CORS.")); };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("canplay", done);
      video.removeEventListener("error", fail);
    };
    if (video.readyState >= 2) return resolve();
    video.addEventListener("loadedmetadata", done, { once: true });
    video.addEventListener("canplay", done, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.load();
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cfg: GiftRenderConfig,
  width: number,
  height: number,
  work: HTMLCanvasElement,
) {
  ctx.clearRect(0, 0, width, height);

  const sw = video.videoWidth || width;
  const sh = video.videoHeight || height;
  const cropL = Math.max(0, Math.min(sw - 1, cfg.cropLeft));
  const cropR = Math.max(0, Math.min(sw - cropL - 1, cfg.cropRight));
  const cropT = Math.max(0, Math.min(sh - 1, cfg.cropTop));
  const cropB = Math.max(0, Math.min(sh - cropT - 1, cfg.cropBottom));
  const srcW = Math.max(1, sw - cropL - cropR);
  const srcH = Math.max(1, sh - cropT - cropB);

  const targetW = cfg.width ?? width;
  const targetH = cfg.height ?? height;
  let dw = targetW;
  let dh = targetH;
  if (cfg.fit === "contain" || cfg.fit === "cover" || cfg.fit === "original") {
    const sx = targetW / srcW;
    const sy = targetH / srcH;
    const scale = cfg.fit === "cover" ? Math.max(sx, sy) : cfg.fit === "original" ? 1 : Math.min(sx, sy);
    dw = srcW * scale;
    dh = srcH * scale;
  }
  dw *= cfg.scale * cfg.scaleX * cfg.zoom;
  dh *= cfg.scale * cfg.scaleY * cfg.zoom;

  const anchorX = cfg.anchor.includes("left") ? 0 : cfg.anchor.includes("right") ? width : width / 2;
  const anchorY = cfg.anchor.includes("top") ? 0 : cfg.anchor.includes("bottom") ? height : height / 2;
  const xBase = cfg.anchor === "left" || cfg.anchor === "right" ? anchorX : anchorX - dw / 2;
  const yBase = cfg.anchor === "top" || cfg.anchor === "bottom" ? anchorY : anchorY - dh / 2;
  const unitX = cfg.positionUnit === "percent" ? width / 100 : 1;
  const unitY = cfg.positionUnit === "percent" ? height / 100 : 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, cfg.opacity / 100));
  ctx.filter = `brightness(${Math.max(0, 1 + cfg.brightness / 100)}) contrast(${Math.max(0, 1 + cfg.contrast / 100)}) saturate(${Math.max(0, cfg.saturation)}) hue-rotate(${cfg.hue}deg)`;
  ctx.translate(xBase + cfg.positionX * unitX + dw / 2, yBase + cfg.positionY * unitY + dh / 2);
  ctx.rotate((cfg.rotation * Math.PI) / 180);
  ctx.scale(cfg.flipH ? -1 : 1, cfg.flipV ? -1 : 1);
  ctx.drawImage(video, cropL, cropT, srcW, srcH, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  // Apply chroma as a baked black/transparent-looking key colour. The room
  // playback layer still receives the original chroma mode and can key it.
  if (cfg.chromaMode !== "off") {
    const w = work.width = width;
    const h = work.height = height;
    const wctx = work.getContext("2d", { willReadFrequently: true })!;
    wctx.clearRect(0, 0, w, h);
    wctx.drawImage(ctx.canvas, 0, 0);
    const image = wctx.getImageData(0, 0, w, h);
    const p = image.data;
    const tolerance = Math.max(0.05, Math.min(1, cfg.greenTolerance / 100));
    const mode = cfg.chromaMode;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i]! / 255, g = p[i + 1]! / 255, b = p[i + 2]! / 255;
      const key = mode === "green" || (mode === "auto" && g > r * 1.25 && g > b * 1.15)
        ? Math.max(0, g - Math.max(r, b))
        : mode === "blue" ? Math.max(0, b - Math.max(r, g))
        : mode === "black" ? 1 - Math.max(r, g, b)
        : mode === "white" ? Math.min(r, g, b)
        : 0;
      if (key > tolerance) p[i + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
  }
}

export async function publishEntranceRender(input: EntrancePublishInput): Promise<EntrancePublishResult> {
  const cfg = normalizeRenderConfig(input.renderConfig);
  if (!input.mediaUrl) throw new Error("This entrance has no source media.");
  if (typeof MediaRecorder === "undefined") throw new Error("This browser does not support video rendering.");

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = input.mediaUrl;
  video.style.position = "fixed";
  video.style.left = "-10000px";
  document.body.appendChild(video);

  try {
    await waitForVideo(video);
    const width = 540;
    const height = 960;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const work = document.createElement("canvas");

    const stream = canvas.captureStream(30);
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    const sourceDuration = Number.isFinite(video.duration) ? video.duration * 1000 : (input.durationMs ?? 2500);
    const durationMs = Math.max(250, Math.min(cfg.endMs ?? sourceDuration, 15_000));
    const startAt = Math.max(0, cfg.delayMs);
    const loopCount = cfg.loop ? Math.max(1, cfg.loopCount || 1) : 1;

    recorder.start(250);
    await sleep(startAt);

    for (let loop = 0; loop < loopCount; loop++) {
      video.currentTime = 0;
      await video.play();
      const end = performance.now() + durationMs;
      while (performance.now() < end && !video.ended) {
        drawFrame(ctx, video, cfg, width, height, work);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      video.pause();
      if (!cfg.loop) break;
    }

    if (cfg.holdMs > 0) {
      const end = performance.now() + Math.min(cfg.holdMs, 5000);
      while (performance.now() < end) {
        drawFrame(ctx, video, cfg, width, height, work);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
    stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("Renderer produced an empty video.");
    if (blob.size > 80 * 1024 * 1024) throw new Error("Rendered video exceeds the 80MB storage limit.");

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error("Admin session expired. Please sign in again.");

    const version = Date.now().toString(36);
    const path = `entrance-effects/rendered/${input.id}/${version}.webm`;
    const sign = await fetch("/api/r2-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ path, contentType: "video/webm", size: blob.size }),
    });
    const signed = await sign.json() as { uploadUrl?: string; publicUrl?: string; error?: string };
    if (!sign.ok || !signed.uploadUrl || !signed.publicUrl) throw new Error(signed.error || "Could not create R2 upload URL.");

    const upload = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/webm" },
      body: blob,
    });
    if (!upload.ok) throw new Error(`R2 upload failed (${upload.status}).`);

    const { error } = await supabase
      .from("entrance_effects")
      .update({ published_render_url: signed.publicUrl, published_render_at: new Date().toISOString(), published_render_version: version } as never)
      .eq("id", input.id);
    if (error) throw error;

    return { publishedRenderUrl: signed.publicUrl, bytes: blob.size, durationMs };
  } finally {
    video.remove();
  }
}
