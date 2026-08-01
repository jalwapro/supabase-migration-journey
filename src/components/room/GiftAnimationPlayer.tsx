import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveLuxuryGiftMp4Url } from "@/lib/luxuryGiftMp4";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { playGiftAudioCue, playGiftWhooshCue, unlockGiftAudio, useGiftAudioPrefs } from "@/lib/giftAudio";
import { trackGiftPlayback } from "@/lib/giftTelemetry";
import SvgaPlayer from "./SvgaPlayer";


/**
 * TikTok-style full-screen gift animation player.
 * Plays incoming gifts one-by-one as a rich full-screen animation with:
 *  - Sender chip (top-left)
 *  - Big gift clip (SVG/MP4) or emoji in the center
 *  - Receiver DP below the gift
 */

type Play = {
  key: string;
  senderName: string;
  senderAvatar: string | null;
  receiverId?: string | null;
  receiverIds?: (string | null)[] | null;
  receiverName: string;
  receiverAvatar: string | null;
  giftId?: string | null;
  giftName: string;
  giftEmoji: string;
  giftImageUrl?: string | null;
  giftClipUrl: string | null;
  giftClipType: string | null;
  coins: number;
  diamonds: number;
  quantity: number;
  animation: string;
  soundUrl?: string | null;
  chromakey?: string | null;
  local?: boolean;
  /** Higher priority pre-empts a lower-priority gift already on screen. */
  priority?: number;
  /** Per-gift audio gain (0–1) configured by admins. */
  audioVolume?: number;
  /** Wall-clock ms when this play entered the queue (telemetry). */
  enqueuedAt?: number;
  /** Cumulative combo count (running total per sender+gift) — for train mode. */
  comboTotal?: number;
  /** Train wagons to render for this play (0 = normal flyer swarm). */
  trainWagons?: number;
};

const COMBO_IDLE_MS = 1800;
const TRAIN_UNIT = 10;
const MAX_TRAIN_WAGONS = 20;

const PLAY_MS = 3200;
const VIDEO_PLAY_MS = 3800;
const MAX_GIFT_Z_INDEX = 2147483647;
const GIFT_PORTAL_ID = "jalwa-gift-animation-layer";
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_MP4_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/82be6f35-cb0c-44fc-8232-8514da26b101/royal-rose.mp4`;
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;

function isRoyalRoseGift(name: string | null | undefined) {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return normalized === "royal rose" || (normalized.includes("royal") && normalized.includes("rose"));
}

// Royal Crown gift ships with a placeholder DP baked into the SVGA/MP4;
// we overlay the actual receiver's avatar in the crown's DP slot.
function isRoyalCrownGift(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  return n.includes("royal") && n.includes("crown");
}

function isJalwaSpaceshipGift(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  return n.includes("spaceship") || (n.includes("galaxy") && n.includes("party"));
}

// Gifts rendered on a pure-black background — we screen-blend them so the black
// disappears against the room and only the effect shows. Also implies the MP4
// already carries baked-in audio, so we should unmute the video element.
const POPULAR_MP4_GIFT_NAMES = new Set([
  "heart","like","balloon","cake","fire","star","butterfly","sunflower","bunny","music note",
]);
function isBlackBgGift(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("money gun") || n.includes("hand heart")) return false;
  if (n.startsWith("jalwa ")) return true;
  if (POPULAR_MP4_GIFT_NAMES.has(n)) return true;
  return false;
}


function resolveGiftClipUrl(url: string | null) {
  if (!url) return null;
  const optimizedUrl = resolvePlayableGiftUrl(resolveLuxuryGiftMp4Url(url) ?? url) ?? url;
  if (optimizedUrl.startsWith("/__l5e/")) return optimizedUrl;
  return optimizedUrl;
}

function ensureGiftPortalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(GIFT_PORTAL_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = GIFT_PORTAL_ID;
    document.body.appendChild(root);
  }
  root.className = "jalwa-gift-animation-layer";
  root.setAttribute("data-gift-portal", "true");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = String(MAX_GIFT_Z_INDEX);
  root.style.pointerEvents = "none";
  root.style.isolation = "isolate";
  root.style.contain = "layout paint style";
  return root;
}

function getSafeGiftEmoji(emoji: string | null | undefined, icon: string | null | undefined) {
  if (emoji) return emoji;
  if (icon && !isAssetUrlLike(icon)) return icon;
  return "🎁";
}

function getEffectiveGiftClip(p: Play) {
  if (isRoyalRoseGift(p.giftName) || p.giftClipUrl?.includes("royal-rose")) {
    return {
      url: ROYAL_ROSE_MP4_URL,
      type: "mp4",
    };
  }

  const url = resolveGiftClipUrl(p.giftClipUrl);
  const lower = (url ?? "").split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  const inferredType = lower.endsWith(".webm")
    ? "webm"
    : lower.endsWith(".mp4")
      ? "mp4"
      : lower.endsWith(".svga")
        ? "svga"
        : lower.endsWith(".svg")
          ? "svg"
          : p.giftClipType;

  return {
    url,
    type: inferredType,
  };
}



function giftSignature(p: Play) {
  // NOTE: receiverName is intentionally excluded so a single local dispatch
  // (multi-receiver "send to all") suppresses every per-row realtime insert
  // that follows — otherwise viewers would see the gift play N separate times.
  return `${p.senderName}|${p.giftName}|${p.quantity}|${p.coins}`;
}

function AnimatedGiftVideo({
  src,
  type,
  onReady,
  onDone,
  onDuration,
  fallbackEmoji,
  fallbackImage,
  withSound = false,
  volume = 1,
  suppressEmojiFallback = false,
  screenBlend = false,
  lumaKey = false,
  greenKey = false,
  forceKey = false,
}: {
  src: string;
  type: string | null;
  onReady: () => void;
  onDone: () => void;
  onDuration?: (ms: number) => void;
  fallbackEmoji: string;
  fallbackImage: string | null;
  withSound?: boolean;
  /** 0..1 — scales the boosted gain; comes from the user's gift-audio volume pref. */
  volume?: number;
  suppressEmojiFallback?: boolean;
  screenBlend?: boolean;
  lumaKey?: boolean;
  greenKey?: boolean;
  /** Admin set the chromakey explicitly — never let runtime detection override it. */
  forceKey?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readyOnceRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [detectedKey, setDetectedKey] = useState<"green" | "luma" | "none" | null>(null);
  const detectedKeyRef = useRef<"green" | "luma" | "none" | "unknown" | null>(null);

  // NOTE: we intentionally do NOT route audio through the Web Audio API
  // (createMediaElementSource) here — that requires the media response to
  // carry permissive CORS headers, and Supabase Storage's public bucket
  // does not reliably send those for range requests. Without them, Web
  // Audio silently outputs zeroes (and setting `crossOrigin` on the
  // <video> to try to satisfy it makes the browser abort the whole
  // fetch instead, breaking playback entirely). Native <video> playback
  // has no such restriction — cross-origin video plays with full audio
  // regardless of CORS — so we just unmute the element directly.
  const applyVolume = useCallback((video: HTMLVideoElement) => {
    if (withSound) {
      video.muted = false;
      video.volume = Math.max(0, Math.min(1, volume));
    } else {
      video.muted = true;
      video.volume = 0;
    }
  }, [withSound, volume]);

  useEffect(() => {
    readyOnceRef.current = false;
    setReady(false);
    setFailed(false);
    detectedKeyRef.current = null;
    setDetectedKey(null);
    const video = videoRef.current;
    if (!video) return;
    // Start muted (safest for autoplay); startPlayback flips this once play() is attempted.
    video.muted = true;
    video.volume = 0;
    // Do NOT call video.load() — the JSX `src` prop + `key` remount already
    // triggers a single fetch. A manual load() here causes a second request
    // and a visible stutter on first play.
  }, [src, withSound]);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    applyVolume(video);
    video.play().catch(() => {
      // If unmuted autoplay is blocked (rare — sending a gift IS a user gesture),
      // retry muted so at least the visual plays.
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [applyVolume]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  // Inspect the first frame's border pixels to decide the real backdrop of this
  // clip. Admin metadata is often wrong/stale, and a mislabelled clip renders a
  // solid green screen over the room — detection makes that impossible.
  const detectBackdrop = useCallback(() => {
    if (detectedKeyRef.current !== null) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const w = 48;
      const h = Math.max(8, Math.round((video.videoHeight / video.videoWidth) * w));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const samples: Array<[number, number]> = [];
      for (let x = 0; x < w; x += 1) {
        samples.push([x, 0], [x, h - 1]);
      }
      for (let y = 0; y < h; y += 1) {
        samples.push([0, y], [w - 1, y]);
      }
      let green = 0;
      let dark = 0;
      for (const [x, y] of samples) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 24) continue; // already transparent (webm alpha)
        if (g > 70 && g > r * 1.35 && g > b * 1.35) green += 1;
        else if (r + g + b < 96) dark += 1;
      }
      const total = samples.length;
      const mode: "green" | "luma" | "none" =
        green / total > 0.35 ? "green" : dark / total > 0.55 ? "luma" : "none";
      detectedKeyRef.current = mode;
      setDetectedKey(mode);
    } catch {
      // Cross-origin clip: canvas is tainted, keep the metadata-driven mode.
      detectedKeyRef.current = "unknown";
    }
  }, []);

  const markReady = useCallback(() => {
    detectBackdrop();
    setReady(true);
    if (!readyOnceRef.current) {
      readyOnceRef.current = true;
      onReady();
    }
    startPlayback();
  }, [detectBackdrop, onReady, startPlayback]);

  if (failed) {
    return <GiftFallbackVisual emoji={fallbackEmoji} image={fallbackImage} onReady={onReady} suppressEmoji={suppressEmojiFallback} name={fallbackEmoji} />;
  }

  // Admin metadata wins when it was set explicitly (forceKey) — EXCEPT when the
  // runtime frame analysis proves the clip has no key-able backdrop. Keying a
  // full-scene clip erases it completely, which reads as "the gift never played".
  const det = forceKey ? (detectedKey === "none" ? "none" : null) : detectedKey;
  const greenKeyEff = det !== "none" && (det === "green" || (!det && greenKey));
  const lumaKeyEff = det !== "none" && !greenKeyEff && (det === "luma" || (!det && lumaKey));
  const screenBlendEff = !greenKeyEff && !lumaKeyEff && det !== "none" && screenBlend;


  const filterParts: string[] = [];
  // #jalwa-green-key removes BOTH a green backdrop and a black backdrop, so the
  // admin "luma" setting also uses it — a luma-tagged clip shot on green must
  // still key out cleanly. Screen-blend keeps the softer luminance-only filter.
  if (greenKeyEff || lumaKeyEff) filterParts.push("url(#jalwa-green-key)");
  else if (screenBlendEff) filterParts.push("url(#jalwa-luma-key)");
  filterParts.push(
    screenBlendEff || lumaKeyEff || greenKeyEff
      ? "brightness(1.42) saturate(1.32) contrast(1.18) drop-shadow(0 20px 54px rgba(255, 210, 90, 0.72))"
      : "brightness(1.22) saturate(1.22) contrast(1.06) drop-shadow(0 20px 54px rgba(255, 210, 90, 0.58))",
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[120] grid place-items-center bg-transparent"
    >
      {(
        <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <filter id="jalwa-luma-key" colorInterpolationFilters="sRGB">
              {/* Compute luminance into the alpha channel */}
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0.2126 0.7152 0.0722 0 0"
              />
              {/* Boost alpha contrast so dark background pixels fall to 0 */}
              <feComponentTransfer>
                <feFuncA type="linear" slope="5.2" intercept="-0.48" />
              </feComponentTransfer>
            </filter>

            {/* Real chroma key: kills the green backdrop AND any pure-black
                backdrop, then suppresses green spill on the subject edges. */}
            <filter id="jalwa-green-key" colorInterpolationFilters="sRGB">
              {/* 1. alpha from "greenness": pure green -> 0, everything else -> 1 */}
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        1 -1.35 1 0 0.12"
                result="gkRaw"
              />
              <feComponentTransfer in="gkRaw" result="gk">
                <feFuncA type="linear" slope="6" intercept="-0.12" />
              </feComponentTransfer>

              {/* 2. alpha from luminance so black-backdrop clips key out too */}
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0.2126 0.7152 0.0722 0 0"
                result="lumaRaw"
              />
              <feComponentTransfer in="lumaRaw" result="lk">
                <feFuncA type="linear" slope="7" intercept="-0.12" />
              </feComponentTransfer>

              {/* 3. keep only pixels that pass both tests */}
              <feComposite in="gk" in2="lk" operator="in" result="keyed" />

              {/* 4. green spill suppression on the surviving subject */}
              <feColorMatrix
                in="keyed"
                type="matrix"
                values="1    0    0    0 0
                        0.28 0.58 0.28 0 0
                        0    0    1    0 0
                        0    0    0    1 0"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/* No placeholder while video buffers — avoids static PNG/emoji flash before the clip plays. */}
      <video
        key={src}
        ref={videoRef}
        src={src}
        playsInline
        disablePictureInPicture
        preload="auto"
        autoPlay
        muted
        onLoadedData={startPlayback}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          // Clamp: some encodes report Infinity / bogus durations which would
          // otherwise freeze the gift slot forever on slower devices.
          if (onDuration && isFinite(d) && d > 0) onDuration(Math.min(15000, Math.ceil(d * 1000)));
        }}

        onCanPlayThrough={() => {
          startPlayback();
        }}
        onPlaying={markReady}
        onError={() => {
          setFailed(true);
          onReady();
        }}
        onEnded={onDone}
        className="gift-anim-video gift-transparent-video absolute inset-0 h-full w-full scale-110 object-contain"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? "scale(1.1)" : "scale(1.02)",
          transition: "opacity 320ms ease-out, transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
          background: "transparent",
          willChange: "opacity, transform",
          mixBlendMode: !lumaKey && !greenKey && screenBlend ? "screen" : undefined,
          filter: filterParts.join(" "),
        }}
      />
    </div>
  );
}


const GIFT_ANIM_MAP: Array<{ match: RegExp; cls: string }> = [
  { match: /heart|kiss|rose|love/i, cls: "gift-anim-heartbeat" },
  { match: /like|thumb/i, cls: "gift-anim-bouncy" },
  { match: /fire|flame/i, cls: "gift-anim-flicker" },
  { match: /star|sparkle/i, cls: "gift-anim-spin-glow" },
  { match: /ring|diamond|crystal|crown/i, cls: "gift-anim-shimmer" },
  { match: /balloon|butterfly|feather/i, cls: "gift-anim-float" },
  { match: /cake|candy|chocolate|ice\s?cream|coffee/i, cls: "gift-anim-wobble" },
  { match: /teddy|bear/i, cls: "gift-anim-tilt" },
  { match: /rocket|spaceship/i, cls: "gift-anim-launch" },
];

function pickGiftAnimClass(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "gift-anim-pop";
  for (const row of GIFT_ANIM_MAP) if (row.match.test(n)) return row.cls;
  return "gift-anim-pop";
}

function GiftFallbackVisual({
  emoji,
  image,
  onReady,
  suppressEmoji = false,
  name = "",
}: {
  emoji: string;
  image: string | null;
  onReady: () => void;
  suppressEmoji?: boolean;
  name?: string;
}) {
  const readyOnceRef = useRef(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const markReady = useCallback(() => {
    if (readyOnceRef.current) return;
    readyOnceRef.current = true;
    onReady();
  }, [onReady]);

  useEffect(() => {
    readyOnceRef.current = false;
    setImageFailed(false);
    setImageLoaded(false);
    if (!image) markReady();
  }, [image, markReady]);

  const animClass = pickGiftAnimClass(name || emoji);

  if (image && !imageFailed) {
    return (
      <div className="relative grid min-h-[42vh] place-items-center">
        {/* Sparkle particles behind the gift for constant motion */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="gift-anim-sparkle absolute block h-2 w-2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,220,120,0.9)]"
              style={{
                left: `${(i * 83) % 100}%`,
                top: `${(i * 47) % 100}%`,
                animationDelay: `${(i * 180) % 2400}ms`,
              }}
            />
          ))}
        </div>
        <img
          src={image}
          alt=""
          onLoad={() => {
            setImageLoaded(true);
            markReady();
          }}
          onError={() => {
            setImageFailed(true);
            markReady();
          }}
          className={`gift-anim-emoji ${animClass} relative h-[72dvh] max-h-[760px] w-auto max-w-[118vw] object-contain drop-shadow-[0_16px_54px_rgba(255,180,60,0.9)]`}
        />
      </div>
    );
  }

  if (suppressEmoji) {
    return null;
  }

  return (
    <span
      className={`gift-anim-emoji ${animClass} block leading-none drop-shadow-[0_8px_32px_rgba(255,180,60,0.7)]`}
      style={{ fontSize: "10rem" }}
    >
      {emoji || "🎁"}
    </span>
  );
}

function AnimatedGiftImage({
  src,
  onReady,
  fallbackEmoji,
  fallbackImage,
  suppressEmojiFallback = false,
  name = "",
}: {
  src: string;
  onReady: () => void;
  fallbackEmoji: string;
  fallbackImage: string | null;
  suppressEmojiFallback?: boolean;
  name?: string;
}) {
  const primary = src || fallbackImage;
  return (
    <GiftFallbackVisual
      emoji={fallbackEmoji}
      image={primary}
      onReady={onReady}
      suppressEmoji={suppressEmojiFallback}
      name={name}
    />
  );
}

function SpaceshipGiftVisual({ onReady }: { onReady: () => void }) {
  const readyOnceRef = useRef(false);

  useEffect(() => {
    if (readyOnceRef.current) return;
    readyOnceRef.current = true;
    onReady();
  }, [onReady]);

  return (
    <div className="jalwa-spaceship-fx pointer-events-none absolute inset-0 z-[180] overflow-hidden" aria-hidden="true">
      <div className="jalwa-spaceship-warp" />
      {Array.from({ length: 28 }).map((_, index) => (
        <i key={`star-${index}`} className={`jalwa-spaceship-star jalwa-spaceship-star-${(index % 7) + 1}`} />
      ))}
      <div className="jalwa-spaceship-ring jalwa-spaceship-ring-a" />
      <div className="jalwa-spaceship-ring jalwa-spaceship-ring-b" />
      <svg className="jalwa-spaceship-ship" viewBox="0 0 520 420" role="img" aria-label="Jalwa spaceship gift">
        <defs>
          <linearGradient id="spaceshipGold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff8d6" />
            <stop offset="0.28" stopColor="#f4c24f" />
            <stop offset="0.55" stopColor="#9b5b10" />
            <stop offset="1" stopColor="#ffe792" />
          </linearGradient>
          <linearGradient id="spaceshipSteel" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.38" stopColor="#b8c0ca" />
            <stop offset="0.72" stopColor="#414b58" />
            <stop offset="1" stopColor="#f6f8ff" />
          </linearGradient>
          <radialGradient id="spaceshipGlass" cx="50%" cy="38%" r="70%">
            <stop offset="0" stopColor="#e8fbff" />
            <stop offset="0.45" stopColor="#3ab7ff" />
            <stop offset="1" stopColor="#071235" />
          </radialGradient>
          <filter id="spaceshipGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#ffc247" floodOpacity="0.75" />
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#ff2fb3" floodOpacity="0.45" />
          </filter>
        </defs>
        <g className="jalwa-spaceship-ship-inner" filter="url(#spaceshipGlow)">
          <path d="M260 48 C210 58 188 86 178 128 C208 114 238 108 260 108 C282 108 312 114 342 128 C332 86 310 58 260 48Z" fill="url(#spaceshipGlass)" stroke="#f8e7aa" strokeWidth="7" />
          <path d="M52 205 C120 136 197 112 260 120 C323 112 400 136 468 205 C393 206 331 219 287 250 C276 258 244 258 233 250 C189 219 127 206 52 205Z" fill="url(#spaceshipSteel)" stroke="#f7d87a" strokeWidth="7" />
          <path d="M82 205 C132 166 190 148 260 150 C330 148 388 166 438 205 C368 205 315 217 283 240 C270 249 250 249 237 240 C205 217 152 205 82 205Z" fill="url(#spaceshipGold)" opacity="0.92" />
          <path d="M176 196 C205 164 236 150 260 150 C284 150 315 164 344 196 C327 228 301 255 260 263 C219 255 193 228 176 196Z" fill="url(#spaceshipSteel)" stroke="#f9d36c" strokeWidth="5" />
          <path d="M212 282 C225 246 295 246 308 282 C296 310 224 310 212 282Z" fill="#25110a" stroke="#ffc85a" strokeWidth="6" />
          <path className="jalwa-spaceship-flame-main" d="M230 302 C244 346 252 375 260 402 C268 375 276 346 290 302 C274 318 246 318 230 302Z" fill="#ffd36b" />
          <path className="jalwa-spaceship-flame-core" d="M245 300 C252 331 256 352 260 371 C264 352 268 331 275 300 C266 309 254 309 245 300Z" fill="#ffffff" />
          <ellipse cx="129" cy="210" rx="29" ry="18" fill="#111827" stroke="#f4c24f" strokeWidth="5" />
          <ellipse cx="391" cy="210" rx="29" ry="18" fill="#111827" stroke="#f4c24f" strokeWidth="5" />
          <circle className="jalwa-spaceship-engine" cx="119" cy="224" r="14" fill="#fff2b4" />
          <circle className="jalwa-spaceship-engine" cx="401" cy="224" r="14" fill="#fff2b4" />
          <path d="M222 132 C236 122 284 122 298 132" fill="none" stroke="#ffffff" strokeWidth="5" opacity="0.82" strokeLinecap="round" />
        </g>
      </svg>
      {Array.from({ length: 18 }).map((_, index) => (
        <b key={`spark-${index}`} className={`jalwa-spaceship-spark jalwa-spaceship-spark-${(index % 6) + 1}`} />
      ))}
    </div>
  );
}

/**
 * Locate the receiver's on-screen DP element (a seat tile carrying
 * `data-user-dp={userId}`). Falls back to bottom-center if not found.
 */
function findReceiverDpRect(receiverId: string | null | undefined): DOMRect | null {
  if (typeof document === "undefined") return null;
  if (receiverId) {
    const el = document.querySelector(`[data-user-dp="${CSS.escape(receiverId)}"]`);
    if (el) return (el as HTMLElement).getBoundingClientRect();
  }
  // Fallback: host seat (index 0) is the primary receiver in most rooms.
  const host = document.querySelector('[data-seat-index="0"]');
  if (host) return (host as HTMLElement).getBoundingClientRect();
  return null;
}

/**
 * TikTok-style small-gift flyer: shows the gift at center, then a copy flies
 * to each receiver's DP for every unit of quantity (with slight stagger),
 * and disappears there while a coin-drop cue plays per landing.
 */
function SmallGiftFlyer({
  emoji,
  image,
  quantity,
  trainWagons = 0,
  comboTotal = 0,
  receiverIds,
  fallbackReceiverId,
  volume,
  onReady,
}: {
  emoji: string;
  image: string | null;
  quantity: number;
  trainWagons?: number;
  comboTotal?: number;
  receiverIds: (string | null | undefined)[];
  fallbackReceiverId?: string | null;
  volume: number;
  onReady: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const readyOnce = useRef(false);

  useEffect(() => {
    if (readyOnce.current) return;
    readyOnce.current = true;
    onReady();
  }, [onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const targets: string[] = (receiverIds && receiverIds.length > 0
      ? receiverIds
      : [fallbackReceiverId ?? null]
    ).filter((v): v is string => !!v);
    const effectiveTargets = targets.length > 0 ? targets : [""];
    const qty = Math.max(1, Math.min(99, Math.floor(quantity || 1)));
    let soundFired = false;

    // ------------------------------------------------------------------
    // 🎰 Slot-Machine Combo hero
    // A dark neon slot-panel appears center-screen containing:
    //  • the gift icon in a spinning reel
    //  • a rolling ×N counter (uses comboTotal when combo is active)
    //  • JACKPOT flash + coin rain when comboTotal >= 10
    // The gift then streams to every receiver DP (existing flyer logic).
    // ------------------------------------------------------------------
    const displayCount = Math.max(quantity, comboTotal || 0);
    // Only fire JACKPOT on the tap that CROSSES the 10 threshold — not on
    // every subsequent tap. Prevents stacked banners/coin rain at 10+ combo.
    const prevTotal = Math.max(0, (comboTotal || 0) - quantity);
    const isJackpot = displayCount >= 10 && prevTotal < 10;
    const isCombo = quantity > 1 || (comboTotal || 0) > 1 || effectiveTargets.length > 1;
    // Hero slot panel is disabled: a basic gift must fly straight to the
    // receiver's DP with no intro box in front of it.
    const skipHeroPanel = true;
    const HERO_INTRO_MS = 0;
    const HERO_HOLD_MS = 0;

    // Slot panel (fixed position, centered) — disabled.
    const panel = document.createElement("div");
    let rafId = 0;
    if (!skipHeroPanel) {

    panel.style.cssText =
      `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.6);` +
      `pointer-events:none;z-index:2147483646;opacity:0;` +
      `display:flex;align-items:center;gap:14px;padding:14px 22px 14px 16px;` +
      `border-radius:22px;` +
      `background:linear-gradient(145deg,rgba(20,6,40,.92) 0%,rgba(50,10,70,.92) 60%,rgba(90,20,60,.92) 100%);` +
      `border:2px solid rgba(255,215,120,.9);` +
      `box-shadow:0 0 0 2px rgba(255,105,180,.35),0 20px 60px rgba(0,0,0,.55),0 0 60px rgba(255,180,80,.45);` +
      `backdrop-filter:blur(6px);will-change:transform,opacity;`;

    // Reel window (holds the gift icon spinning in)
    const reel = document.createElement("div");
    reel.style.cssText =
      `position:relative;width:96px;height:96px;border-radius:16px;overflow:hidden;` +
      `background:radial-gradient(circle at 50% 40%,rgba(255,220,140,.28) 0%,rgba(0,0,0,.55) 70%);` +
      `border:1.5px solid rgba(255,215,120,.7);` +
      `box-shadow:inset 0 0 24px rgba(255,180,80,.35),inset 0 -8px 18px rgba(0,0,0,.5);` +
      `display:grid;place-items:center;`;
    const reelInner = document.createElement("div");
    reelInner.style.cssText = `width:100%;height:100%;display:grid;place-items:center;will-change:transform;`;
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "";
      img.style.cssText =
        "width:86%;height:86%;object-fit:contain;" +
        "filter:drop-shadow(0 6px 14px rgba(0,0,0,.6)) drop-shadow(0 0 14px rgba(255,220,140,.9));";
      img.onerror = () => {
        img.remove();
        const es = document.createElement("span");
        es.textContent = emoji || "🎁";
        es.style.cssText = `font-size:64px;line-height:1;filter:drop-shadow(0 6px 12px rgba(0,0,0,.6));`;
        reelInner.appendChild(es);
      };
      reelInner.appendChild(img);
    } else {
      const es = document.createElement("span");
      es.textContent = emoji || "🎁";
      es.style.cssText = `font-size:64px;line-height:1;filter:drop-shadow(0 6px 12px rgba(0,0,0,.6));`;
      reelInner.appendChild(es);
    }
    reel.appendChild(reelInner);
    reelInner.animate(
      [
        { transform: "translateY(-140%) rotate(-25deg)", opacity: 0 },
        { transform: "translateY(18%) rotate(6deg)", opacity: 1, offset: 0.6 },
        { transform: "translateY(-6%) rotate(-2deg)", opacity: 1, offset: 0.8 },
        { transform: "translateY(0) rotate(0)", opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.3,1.2)", fill: "forwards" },
    );

    // Scanline sweep across reel
    const scan = document.createElement("div");
    scan.style.cssText =
      `position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(255,230,160,.55) 50%,transparent 60%);` +
      `mix-blend-mode:screen;pointer-events:none;`;
    reel.appendChild(scan);
    scan.animate(
      [{ transform: "translateY(-100%)" }, { transform: "translateY(100%)" }],
      { duration: 900, iterations: Infinity, easing: "linear" },
    );

    // ×N rolling counter
    const counterWrap = document.createElement("div");
    counterWrap.style.cssText =
      `display:flex;align-items:baseline;gap:2px;font-family:'Orbitron','Impact',system-ui,sans-serif;` +
      `font-weight:900;letter-spacing:1px;`;
    const times = document.createElement("span");
    times.textContent = "×";
    times.style.cssText =
      `font-size:32px;color:#ffd166;text-shadow:0 0 12px rgba(255,180,80,.9),0 2px 4px rgba(0,0,0,.6);`;
    const num = document.createElement("span");
    num.textContent = "0";
    num.style.cssText =
      `font-size:56px;line-height:1;` +
      `background:linear-gradient(180deg,#fff6c9 0%,#ffd166 45%,#ff8ec4 100%);` +
      `-webkit-background-clip:text;background-clip:text;color:transparent;` +
      `text-shadow:0 4px 14px rgba(255,120,180,.55);will-change:transform;`;
    counterWrap.appendChild(times);
    counterWrap.appendChild(num);

    panel.appendChild(reel);
    panel.appendChild(counterWrap);
    host.appendChild(panel);

    // Panel entry
    panel.animate(
      [
        { transform: "translate(-50%,-50%) scale(.55) rotate(-4deg)", opacity: 0 },
        { transform: "translate(-50%,-50%) scale(1.08) rotate(1deg)", opacity: 1, offset: 0.65 },
        { transform: "translate(-50%,-50%) scale(1) rotate(0)", opacity: 1 },
      ],
      { duration: HERO_INTRO_MS + 80, easing: "cubic-bezier(.2,.7,.3,1.25)", fill: "forwards" },
    );

    // Roll counter from 0 → displayCount
    const rollStart = performance.now();
    const rollDuration = Math.min(600, 220 + displayCount * 12);
    const step = (now: number) => {
      const t = Math.min(1, (now - rollStart) / rollDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.max(1, Math.round(eased * displayCount));
      num.textContent = String(v);
      num.style.transform = `scale(${1 + (1 - t) * 0.15})`;
      if (t < 1) rafId = requestAnimationFrame(step);
      else num.style.transform = "scale(1)";
    };
    rafId = requestAnimationFrame(step);
    } // end if (!isComboContinuation) — hero slot panel + counter

    // Jackpot flash + banner + coin rain
    let jackpotEls: HTMLElement[] = [];
    if (isJackpot) {
      const flash = document.createElement("div");
      flash.style.cssText =
        `position:fixed;inset:0;pointer-events:none;z-index:2147483644;` +
        `background:radial-gradient(circle at 50% 50%,rgba(255,220,140,.55) 0%,rgba(255,120,200,.25) 40%,transparent 70%);` +
        `opacity:0;mix-blend-mode:screen;`;
      host.appendChild(flash);
      flash.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
        { duration: 700, easing: "ease-out", fill: "forwards" },
      ).onfinish = () => flash.remove();
      jackpotEls.push(flash);

      const banner = document.createElement("div");
      banner.textContent = "JACKPOT!";
      banner.style.cssText =
        `position:fixed;left:50%;top:calc(50% - 92px);transform:translate(-50%,-50%);` +
        `pointer-events:none;z-index:2147483647;` +
        `font-family:'Orbitron','Impact',sans-serif;font-weight:900;font-size:38px;letter-spacing:3px;` +
        `background:linear-gradient(180deg,#fff6c9 0%,#ffd166 40%,#ff6ec7 100%);` +
        `-webkit-background-clip:text;background-clip:text;color:transparent;` +
        `text-shadow:0 6px 22px rgba(255,120,180,.7),0 0 28px rgba(255,220,140,.9);` +
        `opacity:0;will-change:transform,opacity;`;
      host.appendChild(banner);
      banner.animate(
        [
          { transform: "translate(-50%,-50%) scale(.4) rotate(-8deg)", opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1.2) rotate(3deg)", opacity: 1, offset: 0.4 },
          { transform: "translate(-50%,-50%) scale(1) rotate(0)", opacity: 1, offset: 0.7 },
          { transform: "translate(-50%,-50%) scale(1.1) rotate(0)", opacity: 0 },
        ],
        { duration: 1100, easing: "cubic-bezier(.2,.7,.3,1.25)", fill: "forwards" },
      ).onfinish = () => banner.remove();
      jackpotEls.push(banner);

      // Coin rain toward each receiver
      effectiveTargets.forEach((tid, idx) => {
        window.setTimeout(() => spawnCoinRain(host, tid, 14), 180 + idx * 60);
      });
    }


    // Rhythmic combo stream — tighter for high qty so it feels alive
    const trailStagger = isCombo ? Math.max(22, 60 - qty * 2) : 0;
    const flyerStartDelay = HERO_INTRO_MS + HERO_HOLD_MS;

    const cleanupTimers: number[] = [];
    let lastLaunchDelay = 0;
    effectiveTargets.forEach((targetId, tIdx) => {
      for (let i = 0; i < qty; i++) {
        const delay = flyerStartDelay + i * trailStagger + tIdx * 28;
        lastLaunchDelay = Math.max(lastLaunchDelay, delay);
        const isFirstOfEvent = !soundFired && i === 0 && tIdx === 0;
        if (isFirstOfEvent) soundFired = true;
        const t = window.setTimeout(() => {
          spawnFlyer(host, {
            emoji,
            image,
            targetId,
            volume,
            fireOnce: isFirstOfEvent,
          });
        }, delay);
        cleanupTimers.push(t);
      }
    });

    // Fade slot panel after the last flyer has launched (only if we made one)
    const panelFadeAt = lastLaunchDelay + 240;
    const panelFadeTimer = skipHeroPanel ? 0 : window.setTimeout(() => {
      const fade = panel.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: "translate(-50%,-50%) scale(.55) rotate(-4deg)", opacity: 0 },
        ],
        { duration: 260, easing: "cubic-bezier(.4,.2,.6,1)", fill: "forwards" },
      );
      fade.onfinish = () => panel.remove();
    }, panelFadeAt);
    if (panelFadeTimer) cleanupTimers.push(panelFadeTimer);

    return () => {
      cleanupTimers.forEach((t) => clearTimeout(t));
      if (rafId) cancelAnimationFrame(rafId);
      try { panel.remove(); jackpotEls.forEach((el) => el.remove()); } catch { /* noop */ }
    };
  }, [emoji, image, quantity, trainWagons, comboTotal, receiverIds, fallbackReceiverId, volume]);


  return <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}

function spawnCoinRain(host: HTMLElement, targetId: string, count: number) {
  if (typeof document === "undefined") return;
  const rect = findReceiverDpRect(targetId);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const endX = rect ? rect.left + rect.width / 2 : vw / 2;
  const endY = rect ? rect.top + rect.height / 2 : vh - 80;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement("div");
    const size = 18 + Math.random() * 10;
    const startX = vw / 2 + (Math.random() - 0.5) * 160;
    const startY = vh / 2 - 40 + (Math.random() - 0.5) * 40;
    coin.style.cssText =
      `position:fixed;left:${startX}px;top:${startY}px;width:${size}px;height:${size}px;` +
      `border-radius:9999px;pointer-events:none;z-index:2147483645;` +
      `background:radial-gradient(circle at 35% 30%,#fff6c9 0%,#ffd166 45%,#c8891a 100%);` +
      `box-shadow:0 0 12px rgba(255,200,80,.9),inset 0 -2px 4px rgba(120,60,0,.5);` +
      `will-change:transform,opacity;`;
    host.appendChild(coin);
    const delay = i * 32 + Math.random() * 60;
    const dur = 620 + Math.random() * 240;
    const spinDir = Math.random() > 0.5 ? 1 : -1;
    coin.animate(
      [
        { transform: `translate(0,0) rotate(0)`, opacity: 0 },
        { transform: `translate(0,-30px) rotate(${spinDir * 180}deg)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${endX - startX}px,${endY - startY}px) rotate(${spinDir * 720}deg)`, opacity: 0.9, offset: 0.95 },
        { transform: `translate(${endX - startX}px,${endY - startY}px) scale(.3)`, opacity: 0 },
      ],
      { duration: dur, delay, easing: "cubic-bezier(.4,.1,.7,1)", fill: "forwards" },
    ).onfinish = () => coin.remove();
  }
}

function spawnFlyer(
  host: HTMLElement,
  opts: { emoji: string; image: string | null; targetId: string; volume: number; fireOnce?: boolean },
) {
  if (typeof document === "undefined") return;
  const rect = findReceiverDpRect(opts.targetId);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const startX = vw / 2;
  const startY = vh * 0.52;
  const endX = rect ? rect.left + rect.width / 2 : vw / 2;
  const endY = rect ? rect.top + rect.height / 2 : vh - 80;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.max(1, Math.hypot(dx, dy));
  const perpX = -dy / len;
  const perpY = dx / len;
  const arcSide = (Math.abs(hashStr(opts.targetId || "")) % 2 === 0) ? 1 : -1;
  const arc = arcSide * Math.min(90, len * 0.22);
  const midX = (startX + endX) / 2 + perpX * arc;
  const midY = (startY + endY) / 2 + perpY * arc;
  const duration = 620;

  // -------- Fluid glowing tail (SVG path with stroke-dash reveal) --------
  const tailSvgNS = "http://www.w3.org/2000/svg";
  const tail = document.createElementNS(tailSvgNS, "svg");
  tail.setAttribute("width", String(vw));
  tail.setAttribute("height", String(vh));
  tail.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  tail.style.cssText =
    `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;` +
    `pointer-events:none;z-index:2147483645;overflow:visible;`;
  const gradId = `jgTail-${Math.random().toString(36).slice(2, 8)}`;
  const defs = document.createElementNS(tailSvgNS, "defs");
  const grad = document.createElementNS(tailSvgNS, "linearGradient");
  grad.setAttribute("id", gradId);
  grad.setAttribute("x1", String(startX));
  grad.setAttribute("y1", String(startY));
  grad.setAttribute("x2", String(endX));
  grad.setAttribute("y2", String(endY));
  grad.setAttribute("gradientUnits", "userSpaceOnUse");
  grad.innerHTML =
    `<stop offset="0%" stop-color="#FFE58A" stop-opacity="0"/>` +
    `<stop offset="40%" stop-color="#FFC24D" stop-opacity="0.85"/>` +
    `<stop offset="100%" stop-color="#FF4FA8" stop-opacity="1"/>`;
  defs.appendChild(grad);
  tail.appendChild(defs);

  const path = document.createElementNS(tailSvgNS, "path");
  const d = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", `url(#${gradId})`);
  path.setAttribute("stroke-width", "6");
  path.setAttribute("stroke-linecap", "round");
  path.style.filter = "drop-shadow(0 0 8px rgba(255,190,110,.9))";
  tail.appendChild(path);
  host.appendChild(tail);

  // approximate path length for dash reveal (chord + small arc bulge)
  const chord = Math.hypot(endX - startX, endY - startY);
  const pathLen = chord + Math.abs(arc) * 1.2;
  path.setAttribute("stroke-dasharray", `${pathLen} ${pathLen}`);
  path.setAttribute("stroke-dashoffset", String(pathLen));

  // Tail draws in, then fades out from the tail-end
  path.animate(
    [
      { strokeDashoffset: pathLen, opacity: 0.0 },
      { strokeDashoffset: pathLen * 0.35, opacity: 0.95, offset: 0.35 },
      { strokeDashoffset: -pathLen * 0.9, opacity: 0.9, offset: 0.9 },
      { strokeDashoffset: -pathLen, opacity: 0 },
    ],
    { duration: duration + 120, easing: "cubic-bezier(.4,.2,.2,1)", fill: "forwards" },
  ).onfinish = () => tail.remove();

  // -------- Comet head: the gift itself, no card/frame ------------------
  const size = 132;
  const half = size / 2;
  const el = document.createElement("div");
  el.style.cssText =
    `position:fixed;left:0;top:0;width:${size}px;height:${size}px;` +
    `will-change:transform,opacity;pointer-events:none;z-index:2147483646;` +
    `display:grid;place-items:center;overflow:visible;`;

  // Warm glow behind
  const halo = document.createElement("div");
  halo.style.cssText =
    `position:absolute;inset:-30%;border-radius:9999px;` +
    `background:radial-gradient(circle at 50% 50%, rgba(255,235,170,.95) 0%, rgba(255,170,90,.55) 40%, rgba(255,100,180,.28) 70%, transparent 100%);` +
    `filter:blur(4px);`;
  el.appendChild(halo);

  if (opts.image) {
    const img = document.createElement("img");
    img.src = opts.image;
    img.alt = "";
    img.style.cssText =
      "position:relative;width:100%;height:100%;object-fit:contain;" +
      "filter:drop-shadow(0 6px 14px rgba(0,0,0,.7)) drop-shadow(0 0 14px rgba(255,220,140,.95));";
    img.onerror = () => {
      img.remove();
      const es = document.createElement("span");
      es.textContent = opts.emoji || "🎁";
      es.style.cssText = `position:relative;font-size:${Math.round(size * 0.72)}px;line-height:1;filter:drop-shadow(0 6px 12px rgba(0,0,0,.65));`;
      el.appendChild(es);
    };
    el.appendChild(img);
  } else {
    const es = document.createElement("span");
    es.textContent = opts.emoji || "🎁";
    es.style.cssText = `position:relative;font-size:${Math.round(size * 0.72)}px;line-height:1;filter:drop-shadow(0 6px 12px rgba(0,0,0,.65));`;
    el.appendChild(es);
  }
  host.appendChild(el);

  if (opts.fireOnce) {
    try { playGiftWhooshCue(Math.min(0.5, opts.volume)); } catch { /* noop */ }
  }

  // Rotation follows the tangent direction — cinematic
  const rot = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

  const anim = el.animate(
    [
      { transform: `translate(${startX - half}px, ${startY - half}px) scale(0.4) rotate(${rot * 0.2}deg)`, opacity: 0, offset: 0 },
      { transform: `translate(${startX - half}px, ${startY - half}px) scale(1.15) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${midX - half}px, ${midY - half}px) scale(0.95) rotate(${rot * 0.8}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${endX - half}px, ${endY - half}px) scale(0.5) rotate(${rot}deg)`, opacity: 1, offset: 0.94 },
      { transform: `translate(${endX - half}px, ${endY - half}px) scale(0.1) rotate(${rot}deg)`, opacity: 0, offset: 1 },
    ],
    { duration, easing: "cubic-bezier(.3,.6,.3,1)", fill: "forwards" },
  );

  anim.onfinish = () => {
    spawnLandingBurst(host, endX, endY);
    el.remove();
  };
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function spawnLandingBurst(host: HTMLElement, x: number, y: number) {
  // Two concentric rings — clean, no confetti dots (looked cluttered)
  const mk = (size: number, delay: number, dur: number, color: string) => {
    const ring = document.createElement("div");
    ring.style.cssText =
      `position:fixed;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;` +
      `border-radius:9999px;pointer-events:none;z-index:2147483645;` +
      `border:2px solid ${color};box-shadow:0 0 24px ${color};opacity:0;`;
    host.appendChild(ring);
    window.setTimeout(() => {
      ring.animate(
        [
          { transform: "scale(0.35)", opacity: 0.95 },
          { transform: "scale(1.6)", opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      ).onfinish = () => ring.remove();
    }, delay);
  };
  mk(120, 0, 520, "rgba(255,220,140,.9)");
  mk(90, 90, 480, "rgba(255,120,200,.85)");

  // Soft golden bloom
  const bloom = document.createElement("div");
  const bs = 130;
  bloom.style.cssText =
    `position:fixed;left:${x - bs / 2}px;top:${y - bs / 2}px;width:${bs}px;height:${bs}px;` +
    `border-radius:9999px;pointer-events:none;z-index:2147483644;` +
    `background:radial-gradient(circle, rgba(255,220,140,.7) 0%, rgba(255,120,200,.35) 45%, transparent 72%);` +
    `filter:blur(6px);opacity:0;`;
  host.appendChild(bloom);
  bloom.animate(
    [
      { transform: "scale(0.5)", opacity: 0.9 },
      { transform: "scale(1.4)", opacity: 0 },
    ],
    { duration: 540, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
  ).onfinish = () => bloom.remove();
}

/**
 * Gift TRAIN — plays every 10-combo. A locomotive with N wagons rolls
 * across the screen left→right, each wagon carrying the gift icon.
 * Wagons grow with combo (1 wagon per 10 units, capped).
 */
function spawnGiftTrain(
  host: HTMLElement,
  opts: { emoji: string; image: string | null; wagons: number; volume: number },
): () => void {
  if (typeof document === "undefined") return () => {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const laneY = vh * 0.55;
  const wagonSize = Math.max(56, Math.min(78, Math.round(vw / 8)));
  const wagons = Math.max(1, Math.min(20, opts.wagons));
  const gap = 8;
  // Locomotive + wagons; total width used for start/end offscreen calc.
  const trainWidth = (wagons + 1) * (wagonSize + gap);
  const duration = 2400 + wagons * 80;

  const rail = document.createElement("div");
  rail.style.cssText =
    `position:fixed;left:0;top:${laneY - wagonSize / 2}px;width:${trainWidth}px;height:${wagonSize}px;` +
    `pointer-events:none;z-index:2147483646;display:flex;align-items:center;gap:${gap}px;` +
    `will-change:transform;filter:drop-shadow(0 12px 22px rgba(0,0,0,.55)) drop-shadow(0 0 18px rgba(255,200,110,.75));`;

  const makeCar = (isLoco: boolean) => {
    const car = document.createElement("div");
    car.style.cssText =
      `width:${wagonSize}px;height:${wagonSize}px;display:grid;place-items:center;position:relative;` +
      `border-radius:18px;` +
      `background:radial-gradient(circle at 30% 30%, rgba(255,235,170,.35), rgba(255,120,200,.18) 55%, transparent 78%);`;
    // Bobbing
    car.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-4px)" }, { transform: "translateY(0)" }],
      { duration: 380, iterations: Infinity, easing: "ease-in-out" },
    );
    if (isLoco) {
      const loco = document.createElement("span");
      loco.textContent = "🚂";
      loco.style.cssText = `font-size:${Math.round(wagonSize * 0.86)}px;line-height:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.55));`;
      car.appendChild(loco);
    } else if (opts.image) {
      const img = document.createElement("img");
      img.src = opts.image;
      img.alt = "";
      img.style.cssText =
        `width:${Math.round(wagonSize * 0.86)}px;height:${Math.round(wagonSize * 0.86)}px;object-fit:contain;` +
        `filter:drop-shadow(0 4px 10px rgba(0,0,0,.55)) drop-shadow(0 0 10px rgba(255,220,140,.9));`;
      img.onerror = () => {
        img.remove();
        const es = document.createElement("span");
        es.textContent = opts.emoji || "🎁";
        es.style.cssText = `font-size:${Math.round(wagonSize * 0.72)}px;line-height:1;`;
        car.appendChild(es);
      };
      car.appendChild(img);
    } else {
      const es = document.createElement("span");
      es.textContent = opts.emoji || "🎁";
      es.style.cssText = `font-size:${Math.round(wagonSize * 0.72)}px;line-height:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.55));`;
      car.appendChild(es);
    }
    return car;
  };

  rail.appendChild(makeCar(true));
  for (let i = 0; i < wagons; i++) rail.appendChild(makeCar(false));
  host.appendChild(rail);

  // Steam puffs above locomotive
  const puffs: HTMLDivElement[] = [];
  const puffTimer = window.setInterval(() => {
    const puff = document.createElement("div");
    puff.style.cssText =
      `position:fixed;left:0;top:${laneY - wagonSize}px;width:22px;height:22px;border-radius:9999px;` +
      `background:radial-gradient(circle,rgba(255,255,255,.85),rgba(255,255,255,0));pointer-events:none;` +
      `z-index:2147483645;will-change:transform,opacity;`;
    host.appendChild(puff);
    puffs.push(puff);
    puff.animate(
      [
        { transform: `translate(${lastLocoX()}px, 0) scale(0.6)`, opacity: 0.9 },
        { transform: `translate(${lastLocoX() - 20}px, -50px) scale(1.4)`, opacity: 0 },
      ],
      { duration: 900, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => puff.remove();
  }, 140);

  let currentTx = -trainWidth;
  const lastLocoX = () => currentTx + wagonSize / 2;

  const anim = rail.animate(
    [
      { transform: `translateX(-${trainWidth}px)` },
      { transform: `translateX(${vw}px)` },
    ],
    { duration, easing: "cubic-bezier(.4,.15,.55,.9)", fill: "forwards" },
  );
  // Track x for steam puff positioning
  const rafTick = () => {
    const t = anim.currentTime;
    if (typeof t === "number") {
      const pct = Math.max(0, Math.min(1, t / duration));
      currentTx = -trainWidth + (vw + trainWidth) * pct;
    }
    if (anim.playState === "running") requestAnimationFrame(rafTick);
  };
  requestAnimationFrame(rafTick);

  // Whistle-ish whoosh at start
  try { playGiftWhooshCue(Math.min(0.55, opts.volume)); } catch { /* noop */ }

  const doneTimer = window.setTimeout(() => {
    window.clearInterval(puffTimer);
    rail.remove();
    puffs.forEach((p) => p.remove());
  }, duration + 100);

  return () => {
    window.clearInterval(puffTimer);
    window.clearTimeout(doneTimer);
    try { anim.cancel(); } catch { /* noop */ }
    try { rail.remove(); } catch { /* noop */ }
    puffs.forEach((p) => { try { p.remove(); } catch { /* noop */ } });
  };
}



function isSmallGiftPlay(p: Play) {
  if (isJalwaSpaceshipGift(p.giftName)) return false;
  if (isRoyalRoseGift(p.giftName)) return false;
  if (isRoyalCrownGift(p.giftName)) return false;
  return (p.coins ?? 0) <= 300;
}

function smallPlayDurationMs(p: Play) {
  const q = Math.max(1, Math.min(99, p.quantity || 1));
  const perStagger = q > 1 ? Math.max(24, 70 - q * 3) : 0;
  const receivers = Math.max(1, (p.receiverIds?.length ?? 1));
  return 300 + perStagger * q + receivers * 22 + 900;
}

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  // Small gifts play IN PARALLEL — they never block the big-gift slot and
  // never block each other (TikTok-style: many taps = many concurrent flyers).
  const [smallPlays, setSmallPlays] = useState<Play[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const currentRef = useRef<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const localGiftRef = useRef<Map<string, number>>(new Map());
  // Multi-receiver coalescing buffer: realtime `gift_sends` INSERTs arrive
  // one-per-row when a user sends to "All". We buffer inserts sharing
  // sender+gift+quantity for a short window and dispatch ONE aggregated Play
  // with every receiverId — so all seats' DPs are hit simultaneously.
  const coalesceRef = useRef<Map<string, { play: Play; timer: number; ids: string[] }>>(new Map());
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [soundPulseKey, setSoundPulseKey] = useState<string | null>(null);
  const audioPrefs = useGiftAudioPrefs();

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    const root = ensureGiftPortalRoot();
    setPortalRoot(root);
    return () => {
      if (root && root.childElementCount === 0) root.remove();
    };
  }, []);

  useEffect(() => {
    const unlock = () => unlockGiftAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Combo tracker (cumulative per sender+gift) — drives train mode.
  const comboRef = useRef<Map<string, { count: number; lastAt: number }>>(new Map());

  const computeCombo = useCallback((p: Play): { total: number; wagons: number } => {
    const sig = `${p.senderName}|${p.giftName}`;
    const now = Date.now();
    const prev = comboRef.current.get(sig);
    const qty = Math.max(1, Math.floor(p.quantity || 1));
    const total = prev && now - prev.lastAt < COMBO_IDLE_MS ? prev.count + qty : qty;
    comboRef.current.set(sig, { count: total, lastAt: now });
    const wagons = Math.min(MAX_TRAIN_WAGONS, Math.floor(total / TRAIN_UNIT));
    return { total, wagons };
  }, []);

  const pushSmallPlay = useCallback((p: Play) => {
    setSmallPlays((prev) => {
      const next = prev.length >= 8 ? prev.slice(-7) : prev;
      return [...next, p];
    });
    const ttl = smallPlayDurationMs(p) + 200;
    window.setTimeout(() => {
      setSmallPlays((prev) => prev.filter((x) => x.key !== p.key));
    }, ttl);
  }, []);

  const enqueueOne = useCallback((p: Play) => {
    if (isSmallGiftPlay(p)) {
      const { total, wagons } = computeCombo(p);
      pushSmallPlay({ ...p, comboTotal: total, trainWagons: wagons });
      return;
    }
    preloadGiftVideo(getEffectiveGiftClip(p).url);
    const incoming = { ...p, enqueuedAt: Date.now() };
    const active = currentRef.current;
    const pr = incoming.priority ?? 0;

    // A markedly higher-priority gift (e.g. a 100k-coin flagship) pre-empts a
    // cheap animation already on screen instead of waiting behind it.
    if (active && pr > 0 && pr >= (active.priority ?? 0) + 10) {
      trackGiftPlayback({
        roomId, giftId: active.giftId, eventKey: active.key, status: "skipped",
      });
      currentRef.current = incoming;
      setCurrent(incoming);
      return;
    }

    if (active) {
      // Bounded, priority-ordered waiting room (highest priority plays next).
      setQueue((q) =>
        [...q, incoming]
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.enqueuedAt ?? 0) - (b.enqueuedAt ?? 0))
          .slice(0, 4),
      );
    } else {
      currentRef.current = incoming;
      setCurrent(incoming);
    }
  }, [pushSmallPlay, computeCombo, roomId]);

  const enqueue = useCallback((p: Play) => {
    if (seenRef.current.has(p.key)) return;
    const signature = giftSignature(p);
    const localUntil = localGiftRef.current.get(signature) ?? 0;
    if (!p.local && localUntil > Date.now()) return;
    if (p.local) localGiftRef.current.set(signature, Date.now() + 9000);
    seenRef.current.add(p.key);

    trackGiftPlayback({ roomId, giftId: p.giftId, eventKey: p.key, status: "delivered" });
    enqueueOne({
      ...p,
      quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
    });
  }, [enqueueOne, roomId]);


  useEffect(() => {
    const onLocalGift = (event: Event) => {
      const detail = (event as CustomEvent<Play>).detail;
      if (!detail?.key) return;
      enqueue(detail);
    };
    window.addEventListener("jalwa:gift-sent", onLocalGift);
    return () => window.removeEventListener("jalwa:gift-sent", onLocalGift);
  }, [enqueue]);

type GiftSendRow = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  gift_id: string;
  quantity: number;
  coins_spent: number;
  diamonds_earned: number;
  created_at?: string | null;
  sender_username: string | null;
  sender_avatar: string | null;
  receiver_username: string | null;
  receiver_avatar: string | null;
  gift_name: string | null;
  gift_emoji: string | null;
  gift_icon: string | null;
  gift_animation: string | null;
  gift_clip_path: string | null;
  gift_clip_type: string | null;
  gift_image_url: string | null;
  gift_sound_url: string | null;
  gift_chromakey: string | null;
  gift_audio_url?: string | null;
  gift_priority?: number | null;
  gift_audio_volume?: number | string | null;
};

  // Maps a denormalized gift_sends row → Play, with multi-receiver coalescing.
  const handleGiftRow = useCallback((r: GiftSendRow) => {
    const play: Play = {
      key: `sd-${r.id}`,
      senderName: r.sender_username ?? "Guest",
      senderAvatar: r.sender_avatar ?? null,
      receiverId: r.receiver_id ?? null,
      receiverIds: r.receiver_id ? [r.receiver_id] : null,
      receiverName: r.receiver_username ?? "Host",
      receiverAvatar: r.receiver_avatar ?? null,
      giftName: r.gift_name ?? "Gift",
      giftEmoji: getSafeGiftEmoji(r.gift_emoji, r.gift_icon),
      giftImageUrl: resolveGiftImageUrl(r.gift_image_url ?? (isAssetUrlLike(r.gift_icon) ? r.gift_icon : null)),
      giftClipUrl: r.gift_clip_path ?? r.gift_image_url ?? (isAssetUrlLike(r.gift_icon) ? r.gift_icon : null),
      giftClipType: r.gift_clip_path ? r.gift_clip_type : (r.gift_image_url || isAssetUrlLike(r.gift_icon) ? "image" : null),
      coins: r.coins_spent ?? 0,
      diamonds: r.diamonds_earned ?? 0,
      quantity: r.quantity ?? 1,
      animation: r.gift_animation ?? "pop",
      soundUrl: r.gift_sound_url ?? null,
      chromakey: r.gift_chromakey ?? "auto",
    };
    if (seenRef.current.has(play.key)) return;
    // Coalesce multi-receiver sends into ONE simultaneous play.
    const bucketKey = `${r.sender_id}|${r.gift_id}|${r.quantity}|${r.coins_spent}`;
    const existing = coalesceRef.current.get(bucketKey);
    if (existing) {
      if (r.receiver_id && !existing.ids.includes(r.receiver_id)) {
        existing.ids.push(r.receiver_id);
        existing.play.receiverIds = [...existing.ids];
      }
      return;
    }
    const ids = r.receiver_id ? [r.receiver_id] : [];
    const entry = { play, ids, timer: 0 };
    entry.timer = window.setTimeout(() => {
      coalesceRef.current.delete(bucketKey);
      enqueue(entry.play);
    }, 220);
    coalesceRef.current.set(bucketKey, entry);
  }, [enqueue]);

  // realtime subscriptions (+ resilient reconnect and polling backstop)
  useEffect(() => {
    let disposed = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let retry: number | undefined;
    let attempts = 0;
    let poll: number | undefined;
    let lastSeenAt = new Date(Date.now() - 5000).toISOString();

    // Backstop: if the websocket is unhealthy on this device (flaky mobile
    // network, backgrounded tab, blocked ws), gifts sent from other devices
    // would never render. Poll recent rows until realtime recovers.
    const pollOnce = async () => {
      const since = lastSeenAt;
      const { data } = await supabase
        .from("gift_sends")
        .select(
          "id,sender_id,receiver_id,gift_id,quantity,coins_spent,diamonds_earned,created_at," +
            "sender_username,sender_avatar,receiver_username,receiver_avatar," +
            "gift_name,gift_emoji,gift_icon,gift_animation,gift_clip_path,gift_clip_type," +
            "gift_image_url,gift_sound_url,gift_chromakey,gift_audio_url,gift_priority,gift_audio_volume",
        )
        .eq("room_id", roomId)
        .gt("created_at", since)
        .order("created_at", { ascending: true })
        .limit(10);
      if (disposed || !data?.length) return;
      for (const row of data) {
        const created = (row as { created_at?: string }).created_at;
        if (created && created > lastSeenAt) lastSeenAt = created;
        handleGiftRow(row as unknown as GiftSendRow);
      }
    };

    const startPolling = () => {
      if (poll || disposed) return;
      poll = window.setInterval(() => { void pollOnce(); }, 5000);
    };
    const stopPolling = () => {
      if (poll) { clearInterval(poll); poll = undefined; }
    };

    const connect = () => {
      if (disposed) return;
      ch = supabase
        .channel(`gift-anim-${roomId}-${Math.random().toString(36).slice(2, 8)}`)
        // PERF: gift_sends is fully denormalized (migration 0121) — no extra
        // lookups per viewer per gift.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
          (payload) => {
            const row = payload.new as GiftSendRow & { created_at?: string };
            if (row.created_at && row.created_at > lastSeenAt) lastSeenAt = row.created_at;
            handleGiftRow(row);
          },
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            attempts = 0;
            stopPolling();
            // Catch up on anything missed while the socket was down.
            void pollOnce();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            startPolling();
            const delay = Math.min(15000, 1000 * 2 ** attempts++);
            if (ch) { const dead = ch; ch = null; void supabase.removeChannel(dead); }
            retry = window.setTimeout(connect, delay);
          }
        });
    };

    connect();
    // If the tab was backgrounded (mobile), realtime often silently drops —
    // reconcile on resume.
    const onVisible = () => { if (document.visibilityState === "visible") void pollOnce(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (retry) clearTimeout(retry);
      stopPolling();
      if (ch) void supabase.removeChannel(ch);
      coalesceRef.current.forEach((e) => clearTimeout(e.timer));
      coalesceRef.current.clear();
    };
  }, [roomId, handleGiftRow]);


  // Advance queue → current when idle.
  useEffect(() => {
    if (current || queue.length === 0) return;
    currentRef.current = queue[0];
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  const giftClip = current ? getEffectiveGiftClip(current) : { url: null, type: null };
  const giftClipUrl = giftClip.url;
  const hasVideo = !!giftClipUrl && ["mp4", "webm"].includes(giftClip.type ?? "");
  const hasSvga = !!giftClipUrl && (giftClip.type === "svga" || giftClipUrl.toLowerCase().endsWith(".svga"));
  const hasSvg = !!giftClipUrl && !hasVideo && !hasSvga;
  const isRoyalRose = isRoyalRoseGift(current?.giftName);
  const isSpaceship = isJalwaSpaceshipGift(current?.giftName);
  const isPremiumLong = /royal\s*lion|lion\s*king|spaceship|galaxy\s*party/i.test(current?.giftName ?? "");
  // Admin-controlled chromakey (auto|none|screen|luma|green) overrides the heuristic.
  const chromakeyMode = (current?.chromakey ?? "auto") as "auto" | "none" | "screen" | "luma" | "green";
  const autoBlackBg = isBlackBgGift(current?.giftName) || hasVideo || hasSvga;
  const isBlackBg =
    chromakeyMode === "screen" || chromakeyMode === "luma"
      ? true
      : chromakeyMode === "none"
        ? false
        : autoBlackBg;
  // Small/cheap gifts (Tier 1, ≤300 coins): always render as tiny fast flyer
  // to receiver DP + coin-drop cue. We deliberately ignore any video/svga
  // clip attached to these gifts — small tier must feel uniform and snappy,
  // never a heavyweight cinematic clip.
  const isSmallGift =
    !!current &&
    !isSpaceship &&
    !isRoyalRose &&
    !isRoyalCrownGift(current.giftName) &&
    (current.coins ?? 0) <= 300;

  // Premium/Luxury/VIP: real sample sounds. Jalwa signature chime as fallback.
  const isPremiumTier = !!current && !isSmallGift && (current.coins ?? 0) >= 500;

  const fallbackImage = isRoyalRose
    ? ROYAL_ROSE_THUMB_URL
    : resolveGiftImageUrl(current?.giftImageUrl ?? (current?.giftClipType === "image" ? current.giftClipUrl : null));
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);

  const clearCurrent = useCallback(() => {
    currentRef.current = null;
    setCurrent(null);
    setVideoDurationMs(null);
  }, []);

  const markCurrentReady = useCallback(() => {
    if (!currentRef.current) return;
    setReadyKey(currentRef.current.key);
  }, []);

  useEffect(() => {
    setReadyKey(null);
    setVideoDurationMs(null);
    if (current && !hasVideo && !hasSvg) {
      // svga renders via canvas, mark ready immediately so play timer starts
      setReadyKey(current.key);
    }
  }, [current?.key, current, hasVideo, hasSvg, hasSvga]);

  // Safety net: never let a broken asset keep the gift invisible forever.
  // Long enough that a slow first-fetch of the video doesn't fall back to
  // emoji + skip the actual animation.
  useEffect(() => {
    if (!current || readyKey === current.key) return;
    const t = setTimeout(() => setReadyKey(current.key), 2500);
    return () => clearTimeout(t);
  }, [current, readyKey]);

  // Premium/VIP sounds hata diye — sirf real soundUrl bajta hai (jaise Money Gun).
  // Chhote gifts already coin-drop bajate hain per-landing.
  useEffect(() => {
    if (!current) return;
    if (audioPrefs.muted || audioPrefs.volume <= 0) return;
    if (isSmallGift) return;
    if (!current.soundUrl) return; // no synthetic Jalwa signature anymore
    const played = playGiftAudioCue({
      soundUrl: current.soundUrl,
      giftName: current.giftName,
      volume: Math.min(1, audioPrefs.volume * (isPremiumLong ? 1 : 0.9)),
      premium: false,
    });
    if (!played) return;
    setSoundPulseKey(current.key);
    const pulseTimer = setTimeout(() => setSoundPulseKey((key) => (key === current.key ? null : key)), 1400);
    return () => {
      clearTimeout(pulseTimer);
    };
  }, [current?.key, current?.soundUrl, current?.giftName, isPremiumLong, isSmallGift, audioPrefs.muted, audioPrefs.volume]);



  // Auto-clear current after play duration. For videos, use the actual clip
  // duration (from loadedmetadata) so 8–10s premium gifts play through fully.
  useEffect(() => {
    if (!current || readyKey !== current.key) return;
    let ms: number;
    if (isSmallGift) {
      const q = Math.max(1, Math.min(99, current.quantity || 1));
      const perStagger = q > 1 ? Math.max(24, 70 - q * 3) : 0;
      const receivers = Math.max(1, (current.receiverIds?.length ?? 1));
      // hero(360) + flyer trail + flyer duration(620) + safety.
      ms = 360 + perStagger * q + receivers * 22 + 900;

    } else if (hasVideo) {
      ms = videoDurationMs ?? (isPremiumLong ? 11000 : VIDEO_PLAY_MS);
    } else {
      ms = PLAY_MS;
    }
    const t = setTimeout(clearCurrent, ms + 200);
    return () => clearTimeout(t);
  }, [current, readyKey, hasVideo, isPremiumLong, videoDurationMs, isSmallGift, clearCurrent]);

  // HARD watchdog: on low-end devices a video can stall (decoder busy, low FPS,
  // background tab) so `readyKey` never fires and the big-gift slot would stay
  // occupied forever — every later gift then silently queues and never shows.
  // This guarantees the slot frees up no matter what.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(clearCurrent, 16000);
    return () => clearTimeout(t);
  }, [current?.key, current, clearCurrent]);



  // Prefetch next queued gift's clip so it's warm in cache when it plays.
  const nextPlay = queue[0] ?? null;
  const nextClip = nextPlay ? getEffectiveGiftClip(nextPlay) : null;
  const nextPrefetchUrl =
    nextClip && ["mp4", "webm"].includes(nextClip.type ?? "") ? nextClip.url : null;
  useEffect(() => {
    if (!nextPrefetchUrl) return;
    preloadGiftVideo(nextPrefetchUrl);
  }, [nextPrefetchUrl]);

  if (typeof document === "undefined" || !portalRoot) return null;

  // Parallel small-gift layer: renders independently of the big-gift slot so
  // many small gifts stream to receiver DPs concurrently (no serial blocking).
  const smallLayer = smallPlays.length > 0 ? (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ zIndex: MAX_GIFT_Z_INDEX, contain: "layout paint style" }}
    >
      {smallPlays.map((sp) => {
        const spImage = resolveGiftImageUrl(
          sp.giftImageUrl ?? (sp.giftClipType === "image" ? sp.giftClipUrl : null),
        );
        return (
          <SmallGiftFlyer
            key={sp.key}
            emoji={sp.giftEmoji}
            image={spImage}
            quantity={sp.quantity}
            trainWagons={sp.trainWagons ?? 0}
            comboTotal={sp.comboTotal ?? 0}
            receiverIds={sp.receiverIds ?? (sp.receiverId ? [sp.receiverId] : [])}
            fallbackReceiverId={sp.receiverId ?? null}
            volume={audioPrefs.muted ? 0 : audioPrefs.volume}
            onReady={() => { /* parallel — no ready gating */ }}
          />
        );
      })}
    </div>
  ) : null;

  if (!current) {
    return smallLayer ? createPortal(smallLayer, portalRoot) : null;
  }

  const initial = (current.senderName ?? "?").slice(0, 1).toUpperCase();
  const rInitial = (current.receiverName ?? "?").slice(0, 1).toUpperCase();

  return createPortal(
    <>
    {smallLayer}
    <div
      data-gift-overlay-root="true"
      className="jalwa-gift-overlay pointer-events-none fixed inset-0 overflow-hidden"
      aria-live="polite"
      style={{
        zIndex: MAX_GIFT_Z_INDEX,
        isolation: "isolate",
        transform: "translateZ(0)",
        contain: "layout paint style",
      }}
    >
      {/* Fully transparent stage: no black room-cover behind gifts. */}
      <div className="absolute inset-0 z-0 bg-transparent" />

      {/* Cinematic pre-play overlay removed per user request */}




      {/* sender chip */}
      <div className="absolute left-4 top-2 z-[180] flex items-center gap-2 gift-anim-sender">
        {current.senderAvatar ? (
          <img
            src={current.senderAvatar}
            alt=""
            className="h-10 w-10 rounded-full border-2 border-[color:var(--gold)] object-cover shadow-lg"
          />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-sm font-bold text-white">
            {initial}
          </div>
        )}
        <div className="rounded-full bg-black/70 px-3 py-1">
          <p className="text-[11px] font-bold text-white leading-none">{current.senderName}</p>
          <p className="text-[10px] font-bold text-[color:var(--gold)] leading-tight">
            sent {current.giftName}
          </p>
        </div>
      </div>

      {/* center/front-screen gift animation */}
      <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center px-2">
        {isSmallGift ? (
          <SmallGiftFlyer
            emoji={current.giftEmoji}
            image={fallbackImage}
            quantity={current.quantity}
            comboTotal={current.comboTotal ?? 0}
            receiverIds={current.receiverIds ?? (current.receiverId ? [current.receiverId] : [])}
            fallbackReceiverId={current.receiverId ?? null}
            volume={audioPrefs.muted ? 0 : audioPrefs.volume}
            onReady={markCurrentReady}
          />
        ) : isSpaceship ? (
          <SpaceshipGiftVisual onReady={markCurrentReady} />
        ) : hasVideo ? (


          <AnimatedGiftVideo
            src={giftClipUrl ?? ""}
            type={giftClip.type}
            onReady={markCurrentReady}
            onDone={clearCurrent}
            onDuration={(ms) => setVideoDurationMs(ms)}
            withSound={!audioPrefs.muted && audioPrefs.volume > 0}
            volume={audioPrefs.muted ? 0 : audioPrefs.volume}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={Boolean(fallbackImage)}
            screenBlend={isBlackBg}
            lumaKey={chromakeyMode === "luma" || (chromakeyMode === "auto" && (isBlackBg || (current.coins ?? 0) >= 2000))}
            greenKey={chromakeyMode === "green"}
            forceKey={chromakeyMode === "luma" || chromakeyMode === "green" || chromakeyMode === "none"}
          />

        ) : hasSvga ? (
          <div className="relative z-[160] flex h-full w-full items-center justify-center" onLoad={markCurrentReady}>
            <SvgaPlayer
              src={giftClipUrl ?? ""}
              className="h-full w-full"
              style={{ width: "100dvw", height: "100dvh", minHeight: "100dvh" }}
            />
          </div>

        ) : hasSvg ? (
          <AnimatedGiftImage
            src={giftClipUrl ?? ""}
            onReady={markCurrentReady}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={isRoyalRose || Boolean(fallbackImage)}
            name={current.giftName}
          />
        ) : (
          <GiftFallbackVisual emoji={current.giftEmoji} image={fallbackImage} onReady={markCurrentReady} suppressEmoji={isRoyalRose} name={current.giftName} />
        )}
        {isRoyalCrownGift(current.giftName) && (current.receiverAvatar || current.receiverName) && (
          <div className="pointer-events-none absolute inset-0 z-[220] flex items-center justify-center">
            <div className="relative -translate-y-[6%]">
              <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] blur-lg opacity-70" />
              {current.receiverAvatar ? (
                <img
                  src={current.receiverAvatar}
                  alt=""
                  className="relative h-24 w-24 rounded-full border-4 border-[color:var(--gold)] object-cover shadow-2xl"
                />
              ) : (
                <div className="relative grid h-24 w-24 place-items-center rounded-full border-4 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-3xl font-black text-white shadow-2xl">
                  {rInitial}
                </div>
              )}
            </div>
          </div>
        )}
        {!isSmallGift ? (
          <>
            <div className="relative z-[230] mt-2 flex items-center gap-2 gift-anim-caption">
              <span className="rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--destructive)] px-3 py-1 text-[13px] font-black uppercase tracking-wider text-black shadow-lg">
                {current.giftName}
              </span>
              {current.quantity > 1 && (
                <span className="rounded-full bg-white px-3 py-1 text-[13px] font-black text-black shadow-lg">
                  ×{current.quantity}
                </span>
              )}
            </div>
            {current.coins > 0 && (
              <p className="relative z-[230] mt-1 text-[11px] font-black text-[color:var(--gold)] gift-anim-caption">
                🪙 {current.coins.toLocaleString()}
              </p>
            )}
          </>
        ) : (
          <div className="pointer-events-none absolute left-1/2 top-[62%] z-[230] -translate-x-1/2 flex items-center gap-2">
            <span className="rounded-full bg-black/75 px-3 py-1 text-[12px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10">
              {current.giftName}
            </span>
            {current.quantity > 1 && (
              <span className="rounded-full bg-gradient-to-r from-[#ffd76a] to-[#ff8f2b] px-3 py-1 text-[13px] font-black text-black shadow-lg">
                ×{current.quantity}
              </span>
            )}
          </div>
        )}
        {soundPulseKey === current.key && (
          <div className="gift-sound-pulse pointer-events-none absolute right-5 top-16 z-[240] flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-black text-white ring-1 ring-white/15">
            <span className="text-[13px]">🔊</span>
            <span>Sound</span>
          </div>
        )}
      </div>

      {/* receiver DP */}
      {!isSmallGift && (current.receiverAvatar || current.receiverName) && (
        <div className="absolute inset-x-0 bottom-2 z-[220] flex flex-col items-center gift-anim-caption">
          <div className="relative">
            <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] blur-md opacity-80" />
            {current.receiverAvatar ? (
              <img
                src={current.receiverAvatar}
                alt=""
                className="relative h-20 w-20 rounded-full border-4 border-[color:var(--gold)] object-cover shadow-2xl"
              />
            ) : (
              <div className="relative grid h-20 w-20 place-items-center rounded-full border-4 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-2xl font-black text-white shadow-2xl">
                {rInitial}
              </div>
            )}
          </div>
          <p className="mt-2 rounded-full bg-black/70 px-3 py-0.5 text-[11px] font-bold text-white">
            {current.receiverName}
          </p>
        </div>
      )}
    </div>
    </>,
    portalRoot,
  );
}
