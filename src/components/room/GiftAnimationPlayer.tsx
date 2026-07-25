import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveLuxuryGiftMp4Url } from "@/lib/luxuryGiftMp4";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { useGiftAudioPrefs } from "@/lib/giftAudio";
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

function resolveSoundUrl(url: string | null | undefined) {
  if (!url) return null;
  // Lovable-hosted assets are only served under the *.lovable.app origin.
  // On the sandboxed preview origin (lovableproject.com) a relative /__l5e/…
  // path returns HTML/404 and audio fails silently, so prefix the CDN origin.
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ASSET_ORIGIN}${url}`;
  return url;
}

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
function isBlackBgGift(name: string | null | undefined) {
  const _n = (name ?? "").toLowerCase();
  // NOTE: money gun + hand heart ab true-alpha WebM hain — screen-blend ki zarurat nahi.
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
    video.muted = !withSound;
    video.volume = withSound ? 1 : 0;
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
    video.muted = !withSound;
    video.volume = withSound ? 1 : 0;
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



  return (
    <div className="pointer-events-none absolute inset-0 z-[120] grid place-items-center bg-transparent">
      {/* No placeholder while video buffers — avoids static PNG/emoji flash before the clip plays. */}
      <video
        key={src}
        ref={videoRef}
        src={src}
        playsInline
        disablePictureInPicture
        preload="auto"
        autoPlay
        muted={!withSound}
        onLoadedData={startPlayback}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (onDuration && isFinite(d) && d > 0) onDuration(Math.ceil(d * 1000));
        }}
        onCanPlayThrough={() => {
          // Wait until enough is buffered to play through — avoids ruk-ruk stalls
          // on larger MP4s. autoPlay already kicks playback; we only re-arm the
          // audio graph here so premium/black-bg gifts get their sound.
          startPlayback();
        }}
        onPlaying={markReady}
        onError={() => {
          setFailed(true);
          onReady();
        }}



        onEnded={onDone}
        className="gift-anim-video absolute inset-0 h-full w-full scale-110 object-contain"
        style={{
          opacity: 1,
          willChange: "opacity, transform",
          mixBlendMode: screenBlend ? "screen" : undefined,
          filter: "brightness(1.22) saturate(1.22) contrast(1.06) drop-shadow(0 20px 54px rgba(255, 210, 90, 0.58))",
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

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const currentRef = useRef<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const localGiftRef = useRef<Map<string, number>>(new Map());
  const [readyKey, setReadyKey] = useState<string | null>(null);
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
  // Screen-blend knocks out black — great for MP4s that were rendered on a
  // literal black stage (only a hand-curated set), but catastrophic for a
  // normal MP4 with dark content because it wipes those dark pixels too and
  // makes the animation look transparent / washed-out. Opt-in only.
  const isBlackBg = isBlackBgGift(current?.giftName);

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

  // Play gift sound when a new gift starts. Premium gifts (Royal Lion) have
  // silent video, so soundUrl (ElevenLabs roar) provides the audio at max volume.
  useEffect(() => {
    if (!current?.soundUrl) return;
    if (audioPrefs.muted || audioPrefs.volume <= 0) return;
    const src = resolveSoundUrl(current.soundUrl);
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = audioPrefs.volume;
    // Boost via Web Audio for premium (500%)
    let ctx: AudioContext | null = null;
    try {
      const AC: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC && isPremiumLong) {
        ctx = new AC();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 20 * audioPrefs.volume;
        source.connect(gain).connect(ctx.destination);
      }
    } catch {}
    audio.play().catch(() => {
      audio.muted = true;
      audio.play().catch(() => {});
    });
    return () => {
      audio.pause();
      audio.src = "";
      try { ctx?.close(); } catch {}
    };
  }, [current?.key, current?.soundUrl, isPremiumLong, audioPrefs.muted, audioPrefs.volume]);



  // Auto-clear current after play duration. For videos, use the actual clip
  // duration (from loadedmetadata) so 8–10s premium gifts play through fully.
  useEffect(() => {
    if (!current || readyKey !== current.key) return;
    const ms = hasVideo
      ? (videoDurationMs ?? (isPremiumLong ? 11000 : VIDEO_PLAY_MS))
      : PLAY_MS;
    const t = setTimeout(clearCurrent, ms + 300);
    return () => clearTimeout(t);
  }, [current, readyKey, hasVideo, isPremiumLong, videoDurationMs, clearCurrent]);


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
      {/* Strong stage above the room: keeps transparent gift videos visually in front. */}
      <div className={isSpaceship ? "absolute inset-0 z-0 bg-transparent" : "absolute inset-0 z-0 bg-black/45"} />
      <div className={isSpaceship ? "hidden" : "absolute inset-0 z-[1] bg-gradient-to-b from-black/55 via-black/10 to-black/65"} />

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
        {isSpaceship ? (
          <SpaceshipGiftVisual onReady={markCurrentReady} />
        ) : hasVideo ? (


          <AnimatedGiftVideo
            src={giftClipUrl ?? ""}
            type={giftClip.type}
            onReady={markCurrentReady}
            onDone={clearCurrent}
            onDuration={(ms) => setVideoDurationMs(ms)}
            withSound={(isPremiumLong || isBlackBg) && !audioPrefs.muted && audioPrefs.volume > 0}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={true}
            screenBlend={isBlackBg}
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
      </div>

      {/* receiver DP */}
      {(current.receiverAvatar || current.receiverName) && (
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
