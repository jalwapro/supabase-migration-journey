import { useEffect, useRef } from "react";

export type ChromaKeyMode = "none" | "green" | "black" | "luma" | "checkerboard";

type Props = {
  src: string;
  chromakey?: ChromaKeyMode;
  className?: string;
};

function clamp(v: number) {
  return Math.max(0, Math.min(255, v));
}

/**
 * Plays a normal MP4/WebM frame asset through a canvas and removes its
 * backing screen per-pixel. This gives room-rank frames real transparency
 * instead of relying on an SVG/CSS filter (which cannot key video frames).
 */
export function ChromaKeyVideo({ src, chromakey = "none", className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let raf = 0;
    let disposed = false;

    const render = () => {
      if (disposed) return;

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          raf = requestAnimationFrame(render);
          return;
        }
        let image: ImageData;
        try {
          image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          // If R2/CORS prevents canvas pixel access, keep the native video
          // visible instead of leaving a blank frame.
          raf = requestAnimationFrame(render);
          return;
        }
        const p = image.data;

        const points = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
        ];
        const cornerColors = points.map(([x, y]) => {
          const i = (y * canvas.width + x) * 4;
          return [p[i], p[i + 1], p[i + 2]] as const;
        });

        for (let i = 0; i < p.length; i += 4) {
          const r = p[i];
          const g = p[i + 1];
          const b = p[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const greenDominance = g - Math.max(r, b);
          let alpha = 255;

          if (chromakey === "green") {
            // Higher green dominance means MORE background, therefore LESS alpha.
            const start = 18;
            const end = 72;
            alpha = greenDominance <= start ? 255 : 255 - clamp(((greenDominance - start) / (end - start)) * 255);
            if (g < 45 || g <= r * 1.08 || g <= b * 1.06) alpha = 255;
          } else if (chromakey === "black") {
            alpha = clamp((lum - 28) * 8);
          } else if (chromakey === "luma") {
            alpha = clamp((lum - 38) * 7);
          } else if (chromakey === "checkerboard") {
            // MP4/WebM checkerboards are baked into the video pixels. Use the
            // four corners to learn the actual two background shades, then
            // remove pixels close to either shade. This is more reliable than
            // a fixed gray threshold because video encoding shifts RGB values.
            const cornerDistance = Math.min(
              ...cornerColors.map(([cr, cg, cb]) =>
                Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2),
              ),
            );
            const chroma = max - min;
            const neutral = chroma < 70;
            const checkerLight = neutral && lum > 145;
            const checkerGray = neutral && lum >= 42 && lum <= 145;
            const nearBlackSquare = max < 55;
            const cornerMatched = cornerDistance < 52;
            alpha =
              cornerMatched || checkerLight || checkerGray || nearBlackSquare
                ? 0
                : 255;
          } else {
            const cornerDistance = Math.min(
            ...cornerColors.map(([cr, cg, cb]) =>
              Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2),
            ),
          );
          const cornerBg = cornerDistance < 58;
            const blackBg = max < 42;
            const greenBg = greenDominance > 18 && g > 48 && g > r * 1.10 && g > b * 1.08;
            if (cornerBg || blackBg || greenBg) alpha = 0;
            else if (lum < 78) alpha = clamp((lum - 42) * 7);
          }

          // Green spill suppression keeps edges from retaining a green halo.
          if (greenDominance > 8 && g > r * 1.06 && g > b * 1.04) {
            const neutral = Math.max(r, b);
            p[i + 1] = Math.min(g, neutral + 10);
          }

          // Preserve opaque, colourful foreground pixels.
          if (min < 8 && max > 90 && chromakey === "green") alpha = Math.max(alpha, 220);
          if (chromakey === "checkerboard") {
            // Saturated artwork (gold/orange/colored frame details) always wins
            // over the neutral checkerboard classification.
            if (max - min > 58) alpha = 255;
          }
          p[i + 3] = alpha;
        }

        ctx.putImageData(image, 0, 0);
      }

      raf = requestAnimationFrame(render);
    };

    const start = () => {
      void video.play().catch(() => undefined);
      raf = requestAnimationFrame(render);
    };

    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      video.removeEventListener("loadeddata", start);
    };
  }, [src, chromakey]);

  return (
    <div className={`pointer-events-none absolute -inset-[7%] z-30 h-[114%] w-[114%] overflow-visible ${className}`}>
      <video
        ref={videoRef}
        src={src}
        crossOrigin="anonymous"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain opacity-0"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full max-w-none object-contain select-none"
      />
    </div>
  );
}
