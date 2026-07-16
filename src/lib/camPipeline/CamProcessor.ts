/**
 * CamProcessor — takes a raw camera MediaStream and produces a processed
 * output MediaStream by drawing each frame into a canvas with a CSS
 * `filter` string applied. No ML models, no MediaPipe — just fast canvas
 * 2D compositing for color grading + beauty smoothing.
 *
 * If config is bypass (no filter, no beauty), we skip processor and
 * return the raw stream untouched (caller decides).
 */

import { buildFilterString } from "./filters";
import { AR_OVERLAYS, isAROverlayId, preloadOverlay, drawOverlay } from "./arOverlays";
import { FaceTracker } from "./faceTracker";

export interface CamPipelineConfig {
  filterId: string;
  beautyOn: boolean;
  /** 0..1 */
  beautyIntensity: number;
}

export function isBypass(cfg: CamPipelineConfig): boolean {
  return (!cfg.filterId || cfg.filterId === "none") && !cfg.beautyOn;
}

const OUT_W = 640;
const OUT_H = 480;
const FPS = 30;

export class CamProcessor {
  private srcVideo: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private outStream: MediaStream | null = null;
  private cfg: CamPipelineConfig;
  private started = false;
  private tracker: FaceTracker | null = null;
  private overlayBitmap: ImageBitmap | HTMLImageElement | null = null;
  private overlayLoadingFor: string | null = null;
  private t0 = performance.now();

  constructor(srcStream: MediaStream, cfg: CamPipelineConfig) {
    this.cfg = cfg;
    this.srcVideo = document.createElement("video");
    this.srcVideo.playsInline = true;
    this.srcVideo.muted = true;
    this.srcVideo.autoplay = true;
    this.srcVideo.setAttribute("playsinline", "");
    this.srcVideo.setAttribute("muted", "");
    // Attach off-screen so mobile browsers (esp. iOS Safari) reliably start
    // playback. A detached <video> often stays readyState<2, which would
    // freeze the canvas pipeline → filters appear to "do nothing".
    this.srcVideo.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none;";
    try { document.body.appendChild(this.srcVideo); } catch { /* ignore */ }
    this.srcVideo.srcObject = srcStream;

    this.canvas = document.createElement("canvas");
    this.canvas.width = OUT_W;
    this.canvas.height = OUT_H;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
  }

  updateConfig(cfg: CamPipelineConfig) {
    this.cfg = cfg;
    this.maybeInitAr();
  }

  private maybeInitAr() {
    const id = this.cfg.filterId;
    if (!isAROverlayId(id)) return;
    if (this.overlayLoadingFor !== id) {
      this.overlayLoadingFor = id;
      this.overlayBitmap = null;
      preloadOverlay(AR_OVERLAYS[id].src)
        .then((bmp) => {
          if (this.overlayLoadingFor === id) this.overlayBitmap = bmp;
        })
        .catch(() => { /* silent */ });
    }
    if (!this.tracker) {
      this.tracker = new FaceTracker();
      this.tracker.init().catch(() => { /* silent */ });
    }
  }

  async start(): Promise<MediaStream> {
    if (this.started && this.outStream) return this.outStream;
    this.started = true;
    await this.srcVideo.play().catch(() => {});
    this.outStream = this.canvas.captureStream(FPS);
    this.maybeInitAr();
    this.loop();
    return this.outStream;
  }

  stop() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.started = false;
    try { this.outStream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { this.srcVideo.pause(); } catch { /* ignore */ }
    try { this.srcVideo.srcObject = null; } catch { /* ignore */ }
    try { this.tracker?.dispose(); } catch { /* ignore */ }
    this.tracker = null;
    this.overlayBitmap = null;
    this.overlayLoadingFor = null;
    this.outStream = null;
  }

  getOutputStream(): MediaStream | null {
    return this.outStream;
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.srcVideo.readyState < 2) return;
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

    const srcW = src.videoWidth || w;
    const srcH = src.videoHeight || h;
    const scale = Math.max(w / srcW, h / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    this.ctx.save();
    this.ctx.filter = buildFilterString(cfg.filterId, cfg.beautyOn, cfg.beautyIntensity);
    this.ctx.drawImage(src, dx, dy, dw, dh);
    this.ctx.restore();
    this.ctx.filter = "none";

    // AR overlay pass
    if (isAROverlayId(cfg.filterId) && this.overlayBitmap && this.tracker) {
      const pose = this.tracker.update(src, performance.now() - this.t0);
      if (pose) {
        drawOverlay(
          this.ctx,
          this.overlayBitmap,
          AR_OVERLAYS[cfg.filterId],
          pose,
          w,
          h,
          false,
        );
      }
    }
  }
}
