/**
 * CamProcessor — takes a raw camera MediaStream and produces a processed
 * output MediaStream at ~30fps with:
 *   - background layer: none | blur | image (via MediaPipe selfie segmenter)
 *   - beauty smoothing (canvas filter) on the person layer
 *   - face stickers (via MediaPipe face landmarker) drawn on top
 *
 * If config.bypass is true (none + none + no beauty), we just return the
 * input stream untouched to avoid wasting battery.
 */

import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import { getFaceLandmarker, getSegmenter } from "./mediapipe";
import { BG_BY_ID, loadBgImage } from "./backgrounds";
import { STICKER_BY_ID, computeFaceMetrics, drawSticker } from "./stickers";

export interface CamPipelineConfig {
  stickerId: string;
  backgroundId: string;
  /** Optional user-uploaded background image URL (object URL). */
  customBgUrl: string | null;
  beautyOn: boolean;
  /** 0..1 */
  beautyIntensity: number;
}

export function isBypass(cfg: CamPipelineConfig): boolean {
  const bgKind = cfg.customBgUrl ? "image" : BG_BY_ID[cfg.backgroundId]?.kind ?? "none";
  const stickerNone = !cfg.stickerId || cfg.stickerId === "none";
  return bgKind === "none" && stickerNone && !cfg.beautyOn;
}

const OUT_W = 640;
const OUT_H = 480;
const FPS = 30;

export class CamProcessor {
  private srcVideo: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private maskCanvas: HTMLCanvasElement;
  private bgCanvas: HTMLCanvasElement;
  private personCanvas: HTMLCanvasElement;
  private maskTmpCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private maskCtx: CanvasRenderingContext2D;
  private bgCtx: CanvasRenderingContext2D;
  private personCtx: CanvasRenderingContext2D;
  private maskTmpCtx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private outStream: MediaStream | null = null;
  private cfg: CamPipelineConfig;
  private segmenter: ImageSegmenter | null = null;
  private landmarker: FaceLandmarker | null = null;
  private started = false;
  private frameIdx = 0;
  private lastPersonMaskFrame = 0;

  constructor(srcStream: MediaStream, cfg: CamPipelineConfig) {
    this.cfg = cfg;
    this.srcVideo = document.createElement("video");
    this.srcVideo.playsInline = true;
    this.srcVideo.muted = true;
    this.srcVideo.autoplay = true;
    this.srcVideo.srcObject = srcStream;

    this.canvas = document.createElement("canvas");
    this.canvas.width = OUT_W;
    this.canvas.height = OUT_H;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;

    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = OUT_W;
    this.maskCanvas.height = OUT_H;
    this.maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;

    this.bgCanvas = document.createElement("canvas");
    this.bgCanvas.width = OUT_W;
    this.bgCanvas.height = OUT_H;
    this.bgCtx = this.bgCanvas.getContext("2d", { alpha: false })!;

    // Reusable person layer (previously re-allocated every frame → GC storms on Android)
    this.personCanvas = document.createElement("canvas");
    this.personCanvas.width = OUT_W;
    this.personCanvas.height = OUT_H;
    this.personCtx = this.personCanvas.getContext("2d")!;

    // Reusable tiny canvas for putImageData of the raw seg mask
    this.maskTmpCanvas = document.createElement("canvas");
    this.maskTmpCanvas.width = OUT_W;
    this.maskTmpCanvas.height = OUT_H;
    this.maskTmpCtx = this.maskTmpCanvas.getContext("2d")!;
  }

  updateConfig(cfg: CamPipelineConfig) {
    this.cfg = cfg;
  }

  async start(): Promise<MediaStream> {
    if (this.started && this.outStream) return this.outStream;
    this.started = true;

    await this.srcVideo.play().catch(() => {});

    // Lazy-init models
    try {
      const needsSeg = this.cfg.backgroundId !== "none" || !!this.cfg.customBgUrl;
      const needsFace = this.cfg.stickerId && this.cfg.stickerId !== "none";
      const promises: Promise<unknown>[] = [];
      if (needsSeg) promises.push(getSegmenter().then((s) => (this.segmenter = s)));
      if (needsFace) promises.push(getFaceLandmarker().then((l) => (this.landmarker = l)));
      await Promise.all(promises);
    } catch (e) {
      console.warn("[camPipeline] model init failed, continuing without", e);
    }

    // Pre-warm: try to load any other model in background so config changes
    // later feel instant.
    void getSegmenter().then((s) => (this.segmenter = s)).catch(() => {});
    void getFaceLandmarker().then((l) => (this.landmarker = l)).catch(() => {});

    this.outStream = this.canvas.captureStream(FPS);
    this.loop();
    return this.outStream;
  }

  stop() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.started = false;
    try {
      this.outStream?.getTracks().forEach((t) => t.stop());
    } catch { /* ignore */ }
    try { this.srcVideo.pause(); } catch { /* ignore */ }
    try { this.srcVideo.srcObject = null; } catch { /* ignore */ }
    this.outStream = null;
  }

  getOutputStream(): MediaStream | null {
    return this.outStream;
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.srcVideo.readyState < 2) return;
    // Throttle to ~24fps to reduce CPU load on low-end Android
    this.frameIdx++;
    if (this.frameIdx % 5 === 0) return; // skip 1 in 5 frames
    try {
      this.drawFrame();
    } catch (e) {
      const rec = this as unknown as { _lastErrLog?: number };
      const now = performance.now();
      if (!rec._lastErrLog || now - rec._lastErrLog > 2000) {
        console.warn("[camPipeline] frame error", e);
        rec._lastErrLog = now;
      }
    }
  };

  private drawFrame() {
    const w = OUT_W;
    const h = OUT_H;
    const src = this.srcVideo;
    const cfg = this.cfg;

    const bgPreset = BG_BY_ID[cfg.backgroundId];
    const useCustomBg = !!cfg.customBgUrl;
    const bgKind: "none" | "blur" | "image" = useCustomBg
      ? "image"
      : bgPreset?.kind ?? "none";

    // Compute source video draw rect (cover fit, mirrored self-view).
    const srcW = src.videoWidth || w;
    const srcH = src.videoHeight || h;
    const scale = Math.max(w / srcW, h / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    // 1. Draw background layer to bgCanvas
    if (bgKind === "image") {
      const url = useCustomBg ? cfg.customBgUrl! : bgPreset!.url!;
      const img = loadBgImage(url);
      this.bgCtx.filter = "none";
      if (img.complete && img.naturalWidth > 0) {
        // cover fit
        const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * s;
        const ih = img.naturalHeight * s;
        this.bgCtx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      } else {
        this.bgCtx.fillStyle = "#111";
        this.bgCtx.fillRect(0, 0, w, h);
      }
    } else if (bgKind === "blur") {
      this.bgCtx.filter = `blur(${bgPreset?.blur ?? 12}px)`;
      this.bgCtx.save();
      this.bgCtx.translate(w, 0);
      this.bgCtx.scale(-1, 1);
      this.bgCtx.drawImage(src, w - dx - dw, dy, dw, dh);
      this.bgCtx.restore();
      this.bgCtx.filter = "none";
    }

    // 2. If any bg replacement, run segmentation to get person mask
    let personMaskReady = false;
    if (bgKind !== "none" && this.segmenter) {
      try {
        const result = this.segmenter.segmentForVideo(src, performance.now());
        const catMask = result.categoryMask;
        if (catMask) {
          const mw = catMask.width;
          const mh = catMask.height;
          const data = catMask.getAsUint8Array();
          const img = this.maskCtx.createImageData(mw, mh);
          // Selfie segmenter: 0 = background, non-zero = person
          for (let i = 0; i < data.length; i++) {
            const isPerson = data[i] === 0 ? 0 : 255;
            const j = i * 4;
            img.data[j] = 255;
            img.data[j + 1] = 255;
            img.data[j + 2] = 255;
            img.data[j + 3] = isPerson;
          }
          // Draw to mask canvas at native size, then scale
          const tmp = document.createElement("canvas");
          tmp.width = mw;
          tmp.height = mh;
          tmp.getContext("2d")!.putImageData(img, 0, 0);
          this.maskCtx.clearRect(0, 0, w, h);
          this.maskCtx.filter = "blur(3px)"; // soften edges
          this.maskCtx.drawImage(tmp, 0, 0, w, h);
          this.maskCtx.filter = "none";
          personMaskReady = true;
          try { catMask.close(); } catch { /* ignore */ }
        }
      } catch (e) {
        // segmentation failed — fall back to no bg
        console.warn("[camPipeline] segment fail", e);
      }
    }

    // 3. Composite output frame
    this.ctx.save();
    this.ctx.filter = "none";
    // Fill with bg or default
    if (bgKind !== "none") {
      this.ctx.drawImage(this.bgCanvas, 0, 0, w, h);
    }

    // Person layer: raw video, mirrored, with optional beauty filter
    const personCanvas = document.createElement("canvas");
    personCanvas.width = w;
    personCanvas.height = h;
    const pctx = personCanvas.getContext("2d")!;
    pctx.save();
    pctx.translate(w, 0);
    pctx.scale(-1, 1);
    if (cfg.beautyOn) {
      const b = Math.max(0, Math.min(1, cfg.beautyIntensity));
      // Subtle beauty: slight blur + brightness/saturation lift.
      pctx.filter = `blur(${(0.5 + b * 1.5).toFixed(2)}px) brightness(${(1 + b * 0.06).toFixed(2)}) saturate(${(1 + b * 0.15).toFixed(2)}) contrast(${(1 + b * 0.04).toFixed(2)})`;
    }
    pctx.drawImage(src, w - dx - dw, dy, dw, dh);
    pctx.restore();
    pctx.filter = "none";

    if (personMaskReady && bgKind !== "none") {
      // Keep only person pixels using mask alpha
      pctx.globalCompositeOperation = "destination-in";
      pctx.drawImage(this.maskCanvas, 0, 0, w, h);
      pctx.globalCompositeOperation = "source-over";
    }

    if (bgKind === "none") {
      // No background layer — just draw person full frame
      this.ctx.drawImage(personCanvas, 0, 0, w, h);
    } else {
      this.ctx.drawImage(personCanvas, 0, 0, w, h);
    }
    this.ctx.restore();

    // 4. Face stickers on top (in mirrored coords)
    const sticker = STICKER_BY_ID[cfg.stickerId];
    if (sticker && sticker.id !== "none" && this.landmarker) {
      try {
        const r = this.landmarker.detectForVideo(src, performance.now());
        const faces = r.faceLandmarks;
        if (faces && faces.length > 0) {
          // Mirror landmark X because we mirrored the video
          const mirrored = faces[0].map((p) => ({ x: 1 - p.x, y: p.y }));
          // Scale into our output canvas coords
          const scaledLandmarks = mirrored.map((p) => {
            const px = (p.x * srcW * scale) + dx;
            const py = (p.y * srcH * scale) + dy;
            return { x: px / w, y: py / h };
          });
          const metrics = computeFaceMetrics(scaledLandmarks, w, h);
          if (metrics) drawSticker(this.ctx, sticker, metrics);
        }
      } catch (e) {
        console.warn("[camPipeline] face detect fail", e);
      }
    }
  }
}
