import { useEffect, useRef } from "react";

export type ChromaKeyMode = "none" | "green" | "black" | "white" | "luma" | "checkerboard" | "custom";

type Props = {
  src: string;
  chromakey?: ChromaKeyMode;
  color?: string;
  tolerance?: number;
  softness?: number;
  className?: string;
};

function clamp(v: number) { return Math.max(0, Math.min(255, v)); }

function hexRgb(hex?: string): [number, number, number] {
  const raw = (hex ?? "#00ff00").replace("#", "").trim();
  const value = raw.length === 3 ? raw.split("").map((x) => x + x).join("") : raw.padEnd(6, "0");
  return [parseInt(value.slice(0, 2), 16) || 0, parseInt(value.slice(2, 4), 16) || 0, parseInt(value.slice(4, 6), 16) || 0];
}

function keyAlpha(r: number, g: number, b: number, mode: ChromaKeyMode, color?: string, tolerance = 48, softness = 12) {
  if (mode === "none") return 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (mode === "green") color = "#00ff00";
  if (mode === "black") color = "#000000";
  if (mode === "white") color = "#ffffff";
  if (mode === "custom") {
    const [cr, cg, cb] = hexRgb(color);
    const d = Math.hypot(r - cr, g - cg, b - cb);
    if (d <= tolerance) return 0;
    if (d <= tolerance + softness) return clamp(((d - tolerance) / Math.max(1, softness)) * 255);
    return 255;
  }
  if (mode === "black") return clamp((lum - tolerance) * (255 / Math.max(1, softness + 1)));
  if (mode === "luma") return clamp((lum - 38) * 7);
  if (mode === "white") return clamp((255 - lum - tolerance) * (255 / Math.max(1, softness + 1)));
  if (mode === "green") {
    const greenDominance = g - Math.max(r, b);
    const start = Math.max(8, tolerance * 0.35);
    const end = start + Math.max(18, tolerance);
    if (g < 45 || g <= r * 1.08 || g <= b * 1.06) return 255;
    return greenDominance <= start ? 255 : 255 - clamp(((greenDominance - start) / (end - start)) * 255);
  }
  return 255;
}

function processPixels(image: ImageData, mode: ChromaKeyMode, color?: string, tolerance = 48, softness = 12) {
  const p = image.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i + 3] = keyAlpha(p[i], p[i + 1], p[i + 2], mode, color, tolerance, softness);
  }
  return image;
}

/** Canvas-based manual chroma key for animated frame assets. */
export function ChromaKeyVideo({ src, chromakey = "none", color, tolerance = 48, softness = 12, className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let visible = true;
    let lastVideoTime = -1;
    const MAX_PROCESS_WIDTH = 720;

    // Decorative frame processing is capped at ~15fps and 720px wide to avoid
    // sustained Android CPU heat when several animated frames are mounted.
    const schedule = () => {
      if (disposed || !visible) return;
      timer = window.setTimeout(render, 66);
    };

    const render = () => {
      if (disposed || !visible) return;
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const scale = Math.min(1, MAX_PROCESS_WIDTH / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        try {
          ctx.drawImage(video, 0, 0, width, height);
          const image = ctx.getImageData(0, 0, width, height);
          ctx.putImageData(processPixels(image, chromakey, color, tolerance, softness), 0, 0);
        } catch { /* CORS/decoder errors are retried on the next scheduled frame. */ }
      }
      schedule();
    };

    const start = () => {
      void video.play().catch(() => undefined);
      schedule();
    };

    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true;
          if (visible && !timer) schedule();
          if (!visible && timer) {
            window.clearTimeout(timer);
            timer = null;
          }
        }, { threshold: 0.01 })
      : null;

    observer?.observe(canvas);
    if (video.readyState >= 2) start(); else video.addEventListener("loadeddata", start, { once: true });
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      timer = null;
      observer?.disconnect();
      video.removeEventListener("loadeddata", start);
    };
  }, [src, chromakey, color, tolerance, softness]);

  return (
    <div className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${className}`}>
      <video ref={videoRef} src={src} crossOrigin="anonymous" autoPlay loop muted playsInline aria-hidden className="absolute inset-0 h-full w-full object-contain opacity-0" />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full max-w-none object-contain select-none" />
    </div>
  );
}

/** Canvas-based manual chroma key for uploaded PNG/WebP/JPG frame assets. */
export function ChromaKeyImage({ src, color, tolerance = 48, softness = 12, className = "" }: Omit<Props, "chromakey">) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let disposed = false;
    img.onload = () => {
      if (disposed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      try {
        ctx.drawImage(img, 0, 0);
        ctx.putImageData(processPixels(ctx.getImageData(0, 0, canvas.width, canvas.height), "custom", color, tolerance, softness), 0, 0);
      } catch { /* CORS errors leave the canvas empty rather than painting a solid key color. */ }
    };
    img.src = src;
    return () => { disposed = true; };
  }, [src, color, tolerance, softness]);
  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full object-contain select-none ${className}`} />;
}
