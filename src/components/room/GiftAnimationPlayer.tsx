import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveLuxuryGiftMp4Url } from "@/lib/luxuryGiftMp4";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { playGiftAudioCue, playGiftWhooshCue, unlockGiftAudio, useGiftAudioPrefs } from "@/lib/giftAudio";
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
  local?: boolean;
};

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

  return {
    url: resolveGiftClipUrl(p.giftClipUrl),
    type: p.giftClipType,
  };
}



function giftSignature(p: Play) {
  return `${p.senderName}|${p.receiverName}|${p.giftName}|${p.quantity}|${p.coins}`;
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
  suppressEmojiFallback = false,
  screenBlend = false,
  lumaKey = false,
}: {
  src: string;
  type: string | null;
  onReady: () => void;
  onDone: () => void;
  onDuration?: (ms: number) => void;
  fallbackEmoji: string;
  fallbackImage: string | null;
  withSound?: boolean;
  suppressEmojiFallback?: boolean;
  screenBlend?: boolean;
  lumaKey?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readyOnceRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Wire the video element to a Web Audio graph with a 5x GainNode so premium
  // gifts play at boosted volume (~500%) — the whole room hears the gift.
  const ensureAudioBoost = useCallback(() => {
    const video = videoRef.current;
    if (!video || !withSound) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(video);
        gainRef.current = ctx.createGain();
        sourceRef.current.connect(gainRef.current).connect(ctx.destination);
      }
      if (gainRef.current) gainRef.current.gain.value = 3; // small headroom; audio already loudnorm'd in mux
    } catch {
      // AudioContext may already be wired to this element; fall back to element volume.
      try { video.volume = 1; } catch { /* ignore */ }
    }
  }, [withSound]);

  useEffect(() => {
    readyOnceRef.current = false;
    setReady(false);
    setFailed(false);
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.volume = 0;
    // Do NOT call video.load() — the JSX `src` prop + `key` remount already
    // triggers a single fetch. A manual load() here causes a second request
    // and a visible stutter on first play.
  }, [src, withSound]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    try { void audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    gainRef.current = null;
    sourceRef.current = null;
  }, []);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.volume = 0;
    if (withSound) ensureAudioBoost();
    video.play().catch(() => {
      // If unmuted autoplay is blocked (rare — sending a gift IS a user gesture),
      // retry muted so at least the visual plays.
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [ensureAudioBoost, withSound]);

  const markReady = useCallback(() => {
    setReady(true);
    if (!readyOnceRef.current) {
      readyOnceRef.current = true;
      onReady();
    }
    startPlayback();
  }, [onReady, startPlayback]);

  if (failed) {
    return <GiftFallbackVisual emoji={fallbackEmoji} image={fallbackImage} onReady={onReady} suppressEmoji={suppressEmojiFallback} name={fallbackEmoji} />;
  }



  const filterParts: string[] = [];
  if (lumaKey) filterParts.push("url(#jalwa-luma-key)");
  filterParts.push(
    screenBlend || lumaKey
      ? "brightness(1.42) saturate(1.32) contrast(1.18) drop-shadow(0 20px 54px rgba(255, 210, 90, 0.72))"
      : "brightness(1.22) saturate(1.22) contrast(1.06) drop-shadow(0 20px 54px rgba(255, 210, 90, 0.58))",
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[120] grid place-items-center bg-transparent">
      {lumaKey && (
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
                <feFuncA type="linear" slope="3.8" intercept="-0.35" />
              </feComponentTransfer>
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
          if (onDuration && isFinite(d) && d > 0) onDuration(Math.ceil(d * 1000));
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
          opacity: 1,
          background: "transparent",
          willChange: "opacity, transform",
          mixBlendMode: !lumaKey && screenBlend ? "screen" : undefined,
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
  receiverIds,
  fallbackReceiverId,
  volume,
  onReady,
}: {
  emoji: string;
  image: string | null;
  quantity: number;
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
    // Per-receiver: spawn `qty` flyers with tight stagger. Single unit → 1 icon.
    const perStagger = qty > 1 ? Math.max(60, 120 - qty * 4) : 0;
    let soundFired = false;

    // Hero preview: show the gift BIG at center so viewers clearly see
    // which gift is playing. On combo (qty>1 or multi-target) the hero
    // PERSISTS with a soft pulse while a fast trail streams to each DP.
    const isCombo = qty > 1 || effectiveTargets.length > 1;
    const HERO_INTRO_MS = 360;
    const hero = document.createElement("div");
    const heroSize = 200;
    hero.style.cssText =
      `position:fixed;left:50%;top:50%;width:${heroSize}px;height:${heroSize}px;` +
      `margin-left:-${heroSize / 2}px;margin-top:-${heroSize / 2}px;` +
      `pointer-events:none;z-index:2147483646;display:grid;place-items:center;`;
    const heroAura = document.createElement("div");
    heroAura.style.cssText =
      `position:absolute;inset:-14%;border-radius:9999px;` +
      `background:radial-gradient(circle at 50% 50%, rgba(255,240,190,.9) 0%, rgba(255,170,80,.55) 40%, rgba(255,120,200,.25) 70%, transparent 100%);` +
      `filter:blur(4px);animation:jalwaHeroPulse 1.1s ease-in-out infinite;`;
    hero.appendChild(heroAura);
    const heroInner = document.createElement("div");
    heroInner.style.cssText = `position:relative;width:90%;height:90%;display:grid;place-items:center;`;
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "";
      img.style.cssText =
        "width:100%;height:100%;object-fit:contain;" +
        "filter:drop-shadow(0 8px 22px rgba(0,0,0,.7)) drop-shadow(0 0 16px rgba(255,220,140,.75));";
      img.onerror = () => {
        img.remove();
        const es = document.createElement("span");
        es.textContent = emoji || "🎁";
        es.style.cssText = `font-size:${Math.round(heroSize * 0.7)}px;line-height:1;filter:drop-shadow(0 8px 20px rgba(0,0,0,.7));`;
        heroInner.appendChild(es);
      };
      heroInner.appendChild(img);
    } else {
      const es = document.createElement("span");
      es.textContent = emoji || "🎁";
      es.style.cssText = `font-size:${Math.round(heroSize * 0.7)}px;line-height:1;filter:drop-shadow(0 8px 20px rgba(0,0,0,.7));`;
      heroInner.appendChild(es);
    }
    hero.appendChild(heroInner);
    host.appendChild(hero);

    // Intro pop-in
    hero.animate(
      [
        { transform: "scale(0.4)", opacity: 0 },
        { transform: "scale(1.12)", opacity: 1, offset: 0.7 },
        { transform: "scale(1.0)", opacity: 1 },
      ],
      { duration: HERO_INTRO_MS, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    );

    // Fast, tighter stagger on combos so it feels like a smooth stream.
    const trailStagger = isCombo ? Math.max(28, 90 - qty * 3) : 0;
    // For single-shot (no combo) keep the original hero-hold feel.
    const flyerStartDelay = isCombo ? HERO_INTRO_MS - 40 : 480;

    const cleanupTimers: number[] = [];
    let lastLaunchDelay = 0;
    effectiveTargets.forEach((targetId, tIdx) => {
      for (let i = 0; i < qty; i++) {
        const delay = flyerStartDelay + i * trailStagger + tIdx * 22;
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

    // Fade the hero out after the last flyer has launched (combo) or after
    // the single hold expires.
    const heroFadeAt = isCombo ? lastLaunchDelay + 380 : 520;
    const heroFadeTimer = window.setTimeout(() => {
      const fade = hero.animate(
        [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(0.75)", opacity: 0 },
        ],
        { duration: 260, easing: "cubic-bezier(.4,.2,.6,1)", fill: "forwards" },
      );
      fade.onfinish = () => hero.remove();
    }, heroFadeAt);
    cleanupTimers.push(heroFadeTimer);

    return () => {
      cleanupTimers.forEach((t) => clearTimeout(t));
      try { hero.remove(); } catch { /* noop */ }
    };
  }, [emoji, image, quantity, receiverIds, fallbackReceiverId, volume]);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
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
  const startY = vh / 2;
  const endX = rect ? rect.left + rect.width / 2 : vw / 2;
  const endY = rect ? rect.top + rect.height / 2 : vh - 80;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.max(1, Math.hypot(dx, dy));
  const perpX = -dy / len;
  const perpY = dx / len;
  const arcSide = (Math.abs(hashStr(opts.targetId || "")) % 2 === 0) ? 1 : -1;
  const size = 132;
  const half = size / 2;

  const el = document.createElement("div");
  el.style.cssText =
    `position:fixed;left:0;top:0;width:${size}px;height:${size}px;` +
    `will-change:transform,opacity;pointer-events:none;z-index:2147483646;` +
    `display:grid;place-items:center;overflow:visible;`;
  const aura = document.createElement("div");
  aura.style.cssText =
    `position:absolute;inset:0;border-radius:9999px;` +
    `background:radial-gradient(circle at 50% 50%, rgba(255,240,190,.85) 0%, rgba(255,180,90,.55) 45%, rgba(255,120,200,.25) 75%, transparent 100%);` +
    `filter:blur(2px);`;
  el.appendChild(aura);
  const inner = document.createElement("div");
  inner.style.cssText = `position:relative;width:88%;height:88%;display:grid;place-items:center;`;
  const emojiSpan = document.createElement("span");
  emojiSpan.textContent = opts.emoji || "🎁";
  emojiSpan.style.cssText = `font-size:${Math.round(size * 0.72)}px;line-height:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.55));`;
  if (opts.image) {
    const img = document.createElement("img");
    img.src = opts.image;
    img.alt = "";
    img.style.cssText = "width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.65)) drop-shadow(0 0 8px rgba(255,220,140,.6));";
    img.onerror = () => {
      img.remove();
      inner.appendChild(emojiSpan);
    };
    inner.appendChild(img);
  } else {
    inner.appendChild(emojiSpan);
  }
  el.appendChild(inner);
  host.appendChild(el);

  const arc = arcSide * 70;
  const midX = (startX + endX) / 2 + perpX * arc;
  const midY = (startY + endY) / 2 + perpY * arc;
  const rot = arcSide * 12;
  const duration = 620;

  if (opts.fireOnce) {
    try { playGiftWhooshCue(Math.min(0.5, opts.volume)); } catch { /* noop */ }
  }

  const anim = el.animate(
    [
      { transform: `translate(${startX - half}px, ${startY - half}px) scale(0.55) rotate(0deg)`, opacity: 0, offset: 0 },
      { transform: `translate(${startX - half}px, ${startY - half}px) scale(1.05) rotate(${rot * 0.25}deg)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${midX - half}px, ${midY - half}px) scale(0.95) rotate(${rot}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${endX - half}px, ${endY - half}px) scale(0.35) rotate(${rot * 1.3}deg)`, opacity: 0.95, offset: 0.95 },
      { transform: `translate(${endX - half}px, ${endY - half}px) scale(0.08) rotate(${rot * 1.4}deg)`, opacity: 0, offset: 1 },
    ],
    { duration, easing: "cubic-bezier(.25,.55,.35,1)", fill: "forwards" },
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
  const ring = document.createElement("div");
  const size = 140;
  ring.style.cssText =
    `position:fixed;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;` +
    `border-radius:9999px;pointer-events:none;z-index:2147483645;` +
    `background:radial-gradient(circle, rgba(255,220,120,.55) 0%, rgba(255,120,200,.35) 40%, transparent 70%);` +
    `box-shadow:0 0 40px rgba(255,210,120,.7), inset 0 0 30px rgba(255,180,220,.55);`;
  host.appendChild(ring);
  ring.animate(
    [
      { transform: "scale(0.3)", opacity: 0.9 },
      { transform: "scale(1.4)", opacity: 0.5, offset: 0.6 },
      { transform: "scale(1.9)", opacity: 0 },
    ],
    { duration: 620, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
  ).onfinish = () => ring.remove();

  const N = 8;
  for (let i = 0; i < N; i++) {
    const dot = document.createElement("i");
    const s = 6 + Math.random() * 6;
    dot.style.cssText =
      `position:fixed;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;` +
      `border-radius:9999px;background:radial-gradient(circle,#fff,rgba(255,220,120,.9) 60%,transparent);` +
      `box-shadow:0 0 12px rgba(255,220,120,.9);pointer-events:none;z-index:2147483646;`;
    host.appendChild(dot);
    const ang = (i / N) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 40;
    const dxp = Math.cos(ang) * dist;
    const dyp = Math.sin(ang) * dist;
    dot.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dxp}px,${dyp}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 520 + Math.random() * 200, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    ).onfinish = () => dot.remove();
  }
}

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const currentRef = useRef<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const localGiftRef = useRef<Map<string, number>>(new Map());
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

  const enqueueOne = useCallback((p: Play) => {
    // If nothing is playing, show it immediately (synchronously via ref
    // so a rapid-fire second call in the same tick still queues correctly).
    // Otherwise append to the pending queue.
    // NOTE: Do NOT wipe queue/current on local sends — that would drop
    // other users' incoming gifts while the local user is combo-tapping.
    if (currentRef.current) {
      preloadGiftVideo(getEffectiveGiftClip(p).url);
      setQueue((q) => [...q.slice(-3), p]);
    } else {
      preloadGiftVideo(getEffectiveGiftClip(p).url);
      currentRef.current = p;
      setCurrent(p);
    }
  }, []);

  const enqueue = useCallback((p: Play) => {
    if (seenRef.current.has(p.key)) return;
    const signature = giftSignature(p);
    const localUntil = localGiftRef.current.get(signature) ?? 0;
    if (!p.local && localUntil > Date.now()) return;
    if (p.local) localGiftRef.current.set(signature, Date.now() + 9000);
    seenRef.current.add(p.key);

    enqueueOne({
      ...p,
      quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
    });
  }, [enqueueOne]);


  useEffect(() => {
    const onLocalGift = (event: Event) => {
      const detail = (event as CustomEvent<Play>).detail;
      if (!detail?.key) return;
      enqueue(detail);
    };
    window.addEventListener("jalwa:gift-sent", onLocalGift);
    return () => window.removeEventListener("jalwa:gift-sent", onLocalGift);
  }, [enqueue]);

  // realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`gift-anim-${roomId}`)
      // PERF: gift_events listener removed — gift_sends is fully denormalized
      // (see migration 0121) and already broadcasts the same event with all
      // fields. Listening to both caused double-flash + a per-event DB
      // round-trip. gift_sends alone is the single source of truth.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
        (payload) => {
          // SCALE FIX: sender/receiver/gift are denormalized on gift_sends
          // by trigger (migration 0121). Zero extra queries per viewer per
          // gift — 5k viewers × 1 gift used to be 15,000 lookups.
          const r = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            gift_id: string;
            quantity: number;
            coins_spent: number;
            diamonds_earned: number;
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
          };
          enqueue({
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
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId, enqueue]);

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
  // Screen-blend knocks out black — apply to every video/svga gift so all
  // gifts render on a transparent stage over the room.
  const isBlackBg = isBlackBgGift(current?.giftName) || hasVideo || hasSvga;
  // Small/cheap gifts (Tier 1, ≤80 coins): always render as tiny fast flyer
  // to receiver DP + coin-drop cue. We deliberately ignore any video/svga
  // clip attached to these gifts — small tier must feel uniform and snappy,
  // never a heavyweight cinematic clip.
  const isSmallGift =
    !!current &&
    !isSpaceship &&
    !isRoyalRose &&
    !isRoyalCrownGift(current.giftName) &&
    (current.coins ?? 0) <= 80;

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
      const perStagger = q > 1 ? Math.max(60, 120 - q * 4) : 0;
      const receivers = Math.max(1, (current.receiverIds?.length ?? 1));
      // flyer duration 620ms + last spawn delay + safety.
      ms = 620 + perStagger * q + receivers * 25 + 250;
    } else if (hasVideo) {
      ms = videoDurationMs ?? (isPremiumLong ? 11000 : VIDEO_PLAY_MS);
    } else {
      ms = PLAY_MS;
    }
    const t = setTimeout(clearCurrent, ms + 200);
    return () => clearTimeout(t);
  }, [current, readyKey, hasVideo, isPremiumLong, videoDurationMs, isSmallGift, clearCurrent]);


  // Prefetch next queued gift's clip so it's warm in cache when it plays.
  const nextPlay = queue[0] ?? null;
  const nextClip = nextPlay ? getEffectiveGiftClip(nextPlay) : null;
  const nextPrefetchUrl =
    nextClip && ["mp4", "webm"].includes(nextClip.type ?? "") ? nextClip.url : null;
  useEffect(() => {
    if (!nextPrefetchUrl) return;
    preloadGiftVideo(nextPrefetchUrl);
  }, [nextPrefetchUrl]);

  if (!current) return null;

  const initial = (current.senderName ?? "?").slice(0, 1).toUpperCase();
  const rInitial = (current.receiverName ?? "?").slice(0, 1).toUpperCase();

  if (typeof document === "undefined" || !portalRoot) return null;

  return createPortal(
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
            withSound={false}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={true}
            screenBlend={isBlackBg}
            lumaKey={(current.coins ?? 0) >= 2000}
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
    </div>,
    portalRoot,
  );
}
