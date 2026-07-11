import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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


function resolveGiftClipUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ASSET_ORIGIN}${url}`;
  return url;
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
  fallbackEmoji,
  fallbackImage,
  suppressEmojiFallback = false,
}: {
  src: string;
  type: string | null;
  onReady: () => void;
  onDone: () => void;
  fallbackEmoji: string;
  fallbackImage: string | null;
  suppressEmojiFallback?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readyOnceRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  

  useEffect(() => {
    readyOnceRef.current = false;
    setReady(false);
    setFailed(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    video.load();
    void video.play().catch(() => {});
  }, [src]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }, []);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Some browsers need canplay/loadeddata first; those events call this again.
    });
  }, []);

  const markReady = useCallback(() => {
    setReady(true);
    if (!readyOnceRef.current) {
      readyOnceRef.current = true;
      onReady();
    }
    tryPlay();
  }, [onReady, tryPlay]);

  if (failed) {
    return <GiftFallbackVisual emoji={fallbackEmoji} image={fallbackImage} onReady={onReady} suppressEmoji={suppressEmojiFallback} />;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-transparent">
      {!ready && (
        <GiftFallbackVisual emoji={fallbackEmoji} image={fallbackImage} onReady={onReady} suppressEmoji={suppressEmojiFallback} />
      )}
      <video
        key={src}
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        preload="auto"
        onLoadedMetadata={markReady}
        onLoadedData={markReady}
        onCanPlay={markReady}
        onError={() => {
          setFailed(true);
          onReady();
        }}
        onEnded={onDone}
        className={`${ready ? "gift-anim-video" : ""} absolute inset-0 h-full w-full bg-transparent object-contain opacity-0 transition-opacity duration-150`}
        style={{ opacity: ready ? 1 : 0, mixBlendMode: type === "webm" ? "normal" : "screen" }}
      />
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

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const enqueueOne = useCallback((p: Play) => {
    if (p.local) {
      setQueue([]);
      currentRef.current = p;
      setCurrent(p);
      return;
    }
    // If nothing is playing, show it immediately (synchronously via ref
    // so a rapid-fire second call in the same tick still queues correctly).
    // Otherwise append to the pending queue.
    if (currentRef.current) {
      setQueue((q) => [...q.slice(-3), p]);
    } else {
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
            giftClipUrl: g.clip_path ?? g.image_url ?? null,
            giftClipType: g.clip_path ? (g.clip_type ?? null) : g.image_url ? "image" : null,
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
        async (payload) => {
          const r = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            gift_id: string;
            quantity: number;
            coins_spent: number;
            diamonds_earned: number;
          };
          const [{ data: gift }, { data: sender }, { data: receiver }] = await Promise.all([
            supabase
              .from("gifts")
              .select("name,emoji,icon,animation,clip_path,clip_type,image_url,sound_url")
              .eq("id", r.gift_id)
              .maybeSingle(),
            supabase.from("profiles").select("username,avatar").eq("id", r.sender_id).maybeSingle(),
            supabase.from("profiles").select("username,avatar").eq("id", r.receiver_id).maybeSingle(),
          ]);
          const g = (gift ?? {}) as {
            name?: string; emoji?: string; icon?: string; animation?: string;
            clip_path?: string | null; clip_type?: string | null; image_url?: string | null; sound_url?: string | null;
          };
          const s = (sender ?? {}) as { username?: string; avatar?: string | null };
          const rc = (receiver ?? {}) as { username?: string; avatar?: string | null };
          enqueue({
            key: `sd-${r.id}`,
            senderName: s.username ?? "Guest",
            senderAvatar: s.avatar ?? null,
            receiverName: rc.username ?? "Host",
            receiverAvatar: rc.avatar ?? null,
            giftName: g.name ?? "Gift",
            giftEmoji: g.emoji ?? g.icon ?? "🎁",
            giftImageUrl: g.image_url ?? null,
            giftClipUrl: g.clip_path ?? g.image_url ?? null,
            giftClipType: g.clip_path ? (g.clip_type ?? null) : g.image_url ? "image" : null,
            coins: r.coins_spent ?? 0,
            diamonds: r.diamonds_earned ?? 0,
            quantity: r.quantity ?? 1,
            animation: g.animation ?? "pop",
            soundUrl: g.sound_url ?? null,
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
  const fallbackImage = isRoyalRose
    ? ROYAL_ROSE_THUMB_URL
    : current?.giftImageUrl ?? (current?.giftClipType === "image" ? current.giftClipUrl : null);

  const clearCurrent = useCallback(() => {
    currentRef.current = null;
    setCurrent(null);
  }, []);

  const markCurrentReady = useCallback(() => {
    if (!currentRef.current) return;
    setReadyKey(currentRef.current.key);
  }, []);

  useEffect(() => {
    setReadyKey(null);
    if (current && !hasVideo && !hasSvg) {
      setReadyKey(current.key);
    }
  }, [current?.key, current, hasVideo, hasSvg]);

  // Safety net: never let a slow/broken asset keep the gift invisible or stuck.
  useEffect(() => {
    if (!current || readyKey === current.key) return;
    const t = setTimeout(() => setReadyKey(current.key), 700);
    return () => clearTimeout(t);
  }, [current, readyKey]);

  // Play gift sound when a new gift starts
  useEffect(() => {
    if (!current?.soundUrl) return;
    const src = resolveSoundUrl(current.soundUrl);
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = 0.85;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [current?.key, current?.soundUrl]);


  // Auto-clear current after PLAY_MS. Kept in a separate effect so the
  // cleanup only fires when `current` itself changes — not on every
  // queue mutation, which was cancelling the timer and leaving the
  // full-screen overlay stuck on screen ("room frozen until refresh").
  useEffect(() => {
    if (!current || readyKey !== current.key) return;
    const t = setTimeout(
      clearCurrent,
      hasVideo ? VIDEO_PLAY_MS : PLAY_MS,
    );
    return () => clearTimeout(t);
  }, [current, readyKey, hasVideo, clearCurrent]);

  if (!current) return null;

  const initial = (current.senderName ?? "?").slice(0, 1).toUpperCase();
  const rInitial = (current.receiverName ?? "?").slice(0, 1).toUpperCase();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-live="polite"
    >
      {/* particles removed */}

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
          <p className="text-[11px] font-bold text-white leading-none">@{current.senderName}</p>
          <p className="text-[10px] font-bold text-[color:var(--gold)] leading-tight">
            sent {current.giftName}
          </p>
        </div>
      </div>

      {/* center/front-screen gift animation */}
      <div className="absolute inset-x-0 top-[14vh] z-10 flex flex-col items-center px-2">
        {hasVideo ? (
          <AnimatedGiftVideo
            src={giftClipUrl ?? ""}
            type={giftClip.type}
            onReady={markCurrentReady}
            onDone={clearCurrent}
            fallbackEmoji={current.giftEmoji}
            fallbackImage={fallbackImage}
            suppressEmojiFallback={isRoyalRose}
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
            @{current.receiverName}
          </p>
        </div>
      )}
    </div>
  );
}
