import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveLuxuryGiftMp4Url } from "@/lib/luxuryGiftMp4";
import { preloadGiftVideo, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { CinematicGiftFX, coinsToTier, comboTier } from "./CinematicGiftFX";
import { useGiftAudioPrefs } from "@/lib/giftAudio";


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
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_MP4_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/82be6f35-cb0c-44fc-8232-8514da26b101/royal-rose.mp4`;
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;

function isRoyalRoseGift(name: string | null | undefined) {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return normalized === "royal rose" || (normalized.includes("royal") && normalized.includes("rose"));
}

// Gifts rendered on a pure-black background — we screen-blend them so the black
// disappears against the room and only the effect shows. Also implies the MP4
// already carries baked-in audio, so we should unmute the video element.
function isBlackBgGift(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  return n.includes("hand heart");
}


function resolveGiftClipUrl(url: string | null) {
  if (!url) return null;
  const optimizedUrl = resolvePlayableGiftUrl(resolveLuxuryGiftMp4Url(url) ?? url) ?? url;
  if (optimizedUrl.startsWith("/__l5e/")) return optimizedUrl;
  return optimizedUrl;
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
  }, [ensureAudioBoost]);

  const markReady = useCallback(() => {
    setReady(true);
    if (!readyOnceRef.current) {
      readyOnceRef.current = true;
      onReady();
    }
    startPlayback();
  }, [onReady, startPlayback]);

  if (failed) {
    return <GiftFallbackVisual emoji={fallbackEmoji} image={fallbackImage} onReady={onReady} suppressEmoji={suppressEmojiFallback} />;
  }



  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-transparent">
      {/* No placeholder while video buffers — avoids the static PNG/emoji
          flash before the clip actually plays. Video fades in on `onPlaying`. */}
      <video
        key={src}
        ref={videoRef}
        src={src}
        playsInline
        disablePictureInPicture
        preload="auto"
        autoPlay
        muted={!withSound}
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
        className="gift-anim-video absolute inset-0 h-full w-full object-contain"
        style={{ opacity: 1, willChange: "opacity, transform", mixBlendMode: screenBlend ? "screen" : undefined }}
      />
      {/* Instant placeholder behind the video so the gift appears IMMEDIATELY
          (TikTok-style). Video decodes on top and covers it once frames flow. */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <GiftFallbackVisual
            emoji={fallbackEmoji}
            image={fallbackImage}
            onReady={() => {}}
            suppressEmoji={suppressEmojiFallback}
          />
        </div>
      )}

    </div>

  );
}


function GiftFallbackVisual({
  emoji,
  image,
  onReady,
  suppressEmoji = false,
}: {
  emoji: string;
  image: string | null;
  onReady: () => void;
  suppressEmoji?: boolean;
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

  if (image && !imageFailed) {
    return (
      <div className="relative grid min-h-[42vh] place-items-center">
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
          className="gift-anim-emoji relative h-[46vh] max-h-[460px] w-auto max-w-[86vw] object-contain drop-shadow-[0_10px_40px_rgba(255,180,60,0.75)]"
        />
      </div>
    );
  }

  if (suppressEmoji) {
    return null;
  }

  return (
    <span
      className="gift-anim-emoji block leading-none drop-shadow-[0_8px_32px_rgba(255,180,60,0.7)]"
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
}: {
  src: string;
  onReady: () => void;
  fallbackEmoji: string;
  fallbackImage: string | null;
  suppressEmojiFallback?: boolean;
}) {
  // Route straight through the fallback visual so we get one clean
  // image render with the emoji only shown while the image is loading
  // (or if it fails). Prefer the explicit image_url when available.
  const primary = src || fallbackImage;
  return (
    <GiftFallbackVisual
      emoji={fallbackEmoji}
      image={primary}
      onReady={onReady}
      suppressEmoji={suppressEmojiFallback}
    />
  );
}

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  const currentRef = useRef<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const localGiftRef = useRef<Map<string, number>>(new Map());
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const audioPrefs = useGiftAudioPrefs();

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_events", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const r = payload.new as {
            id: string;
            sender_id: string | null;
            sender_name: string | null;
            gift_id: string | null;
            gift_emoji: string;
            gift_name: string;
            coins: number;
          };
          const [{ data: prof }, { data: gift }] = await Promise.all([
            r.sender_id
              ? supabase.from("profiles").select("avatar").eq("id", r.sender_id).maybeSingle()
              : Promise.resolve({ data: null }),
            r.gift_id
              ? supabase.from("gifts").select("animation,clip_path,clip_type,image_url,sound_url").eq("id", r.gift_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const g = (gift ?? {}) as { animation?: string; clip_path?: string | null; clip_type?: string | null; image_url?: string | null; sound_url?: string | null };
          enqueue({
            key: `ev-${r.id}`,
            senderName: r.sender_name ?? "Guest",
            senderAvatar: (prof as { avatar?: string | null } | null)?.avatar ?? null,
            receiverName: "",
            receiverAvatar: null,
            giftName: r.gift_name,
            giftEmoji: r.gift_emoji,
            giftImageUrl: g.image_url ?? null,
            giftClipUrl: g.image_url ?? g.clip_path ?? null,
            giftClipType: g.image_url ? "image" : g.clip_path ? (g.clip_type ?? null) : null,
            coins: r.coins ?? 0,
            diamonds: 0,
            quantity: 1,
            animation: g.animation ?? "pop",
            soundUrl: g.sound_url ?? null,
          });
        },
      )
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
            giftEmoji: r.gift_emoji ?? r.gift_icon ?? "🎁",
            giftImageUrl: r.gift_image_url ?? null,
            giftClipUrl: r.gift_image_url ?? r.gift_clip_path ?? null,
            giftClipType: r.gift_image_url ? "image" : r.gift_clip_path ? r.gift_clip_type : null,
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
  const hasSvg = !!giftClipUrl && !hasVideo;
  const isRoyalRose = isRoyalRoseGift(current?.giftName);
  const isPremiumLong = /royal\s*lion|lion\s*king/i.test(current?.giftName ?? "");
  const isBlackBg = isBlackBgGift(current?.giftName);
  const fallbackImage = isRoyalRose
    ? ROYAL_ROSE_THUMB_URL
    : current?.giftImageUrl ?? (current?.giftClipType === "image" ? current.giftClipUrl : null);
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
      setReadyKey(current.key);
    }
  }, [current?.key, current, hasVideo, hasSvg]);

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

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-live="polite"
    >
      {/* Subtle vignette only — keep the room visible behind the gift */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

      {/* Cinematic 9-phase overlay (rarity + combo aware) */}
      <CinematicGiftFX
        giftKey={current.key}
        tier={coinsToTier(current.coins, current.quantity)}
        combo={comboTier(current.quantity)}
      />



      {/* sender chip */}
      <div className="absolute left-4 top-6 flex items-center gap-2 gift-anim-sender">
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
      <div className="absolute inset-x-0 top-[14vh] z-10 flex flex-col items-center px-2">
        {(() => { console.log("[TRINARY]", { hasVideo, hasSvg, url: giftClipUrl }); return null; })()}
        {hasVideo ? (

          <AnimatedGiftVideo
            src={giftClipUrl ?? ""}
            type={giftClip.type}
            onReady={markCurrentReady}
            onDone={clearCurrent}
            onDuration={(ms) => setVideoDurationMs(ms)}
            withSound={(isPremiumLong || isBlackBg) && !audioPrefs.muted && audioPrefs.volume > 0}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={isRoyalRose || isBlackBg}
            screenBlend={isBlackBg}
          />

        ) : hasSvg ? (
          <AnimatedGiftImage
            src={giftClipUrl ?? ""}
            onReady={markCurrentReady}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={isRoyalRose}
          />
        ) : (
          <GiftFallbackVisual emoji={current.giftEmoji} image={fallbackImage} onReady={markCurrentReady} suppressEmoji={isRoyalRose} />
        )}
        <div className="mt-2 flex items-center gap-2 gift-anim-caption">
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
          <p className="mt-1 text-[11px] font-black text-[color:var(--gold)] gift-anim-caption">
            🪙 {current.coins.toLocaleString()}
          </p>
        )}
      </div>

      {/* receiver DP */}
      {(current.receiverAvatar || current.receiverName) && (
        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-10 flex flex-col items-center gift-anim-caption">
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
  );
}
