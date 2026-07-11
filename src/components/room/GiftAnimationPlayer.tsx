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
  giftClipUrl: string | null;
  giftClipType: string | null;
  coins: number;
  diamonds: number;
  quantity: number;
  animation: string;
  local?: boolean;
};

const PLAY_MS = 4200;
const VIDEO_PLAY_MS = 12000;

function resolveGiftClipUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${url}`;
  return url;
}

function getEffectiveGiftClip(p: Play) {
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
}: {
  src: string;
  type: string | null;
  onReady: () => void;
  onDone: () => void;
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
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-transparent">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        preload="auto"
        onLoadedData={markReady}
        onCanPlay={markReady}
        onError={() => {
          setFailed(true);
          onReady();
        }}
        onEnded={onDone}
        className={`${ready ? "gift-anim-video" : ""} h-full w-full bg-transparent object-contain opacity-0 transition-opacity duration-150`}
        style={{ opacity: ready ? 1 : 0 }}
      >
        <source src={src} type={type === "webm" ? "video/webm" : "video/mp4"} />
      </video>
    </div>
  );
}

function AnimatedGiftImage({ src, onReady }: { src: string; onReady: () => void }) {
  const readyOnceRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readyOnceRef.current = false;
    setReady(false);
  }, [src]);

  const markReady = useCallback(() => {
    setReady(true);
    if (!readyOnceRef.current) {
      readyOnceRef.current = true;
      onReady();
    }
  }, [onReady]);

  return (
    <img
      src={src}
      alt=""
      onLoad={markReady}
      onError={markReady}
      className={`${ready ? "gift-anim-emoji" : "opacity-0"} h-[38vh] max-h-[360px] w-auto max-w-[80vw] object-contain drop-shadow-[0_8px_32px_rgba(255,180,60,0.6)]`}
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
    // If nothing is playing, show it immediately (synchronously via ref
    // so a rapid-fire second call in the same tick still queues correctly).
    // Otherwise append to the pending queue.
    if (currentRef.current) {
      setQueue((q) => [...q, p]);
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

    const repeatCount = Math.max(1, Math.min(50, Math.floor(Number(p.quantity) || 1)));
    for (let i = 0; i < repeatCount; i += 1) {
      enqueueOne({
        ...p,
        key: repeatCount === 1 ? p.key : `${p.key}-x${i + 1}`,
        diamonds: repeatCount > 1 ? Math.round((p.diamonds ?? 0) / repeatCount) : p.diamonds,
        quantity: 1,
      });
    }
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
              ? supabase.from("gifts").select("animation,clip_path,clip_type").eq("id", r.gift_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const g = (gift ?? {}) as { animation?: string; clip_path?: string | null; clip_type?: string | null };
          enqueue({
            key: `ev-${r.id}`,
            senderName: r.sender_name ?? "Guest",
            senderAvatar: (prof as { avatar?: string | null } | null)?.avatar ?? null,
            receiverName: "",
            receiverAvatar: null,
            giftName: r.gift_name,
            giftEmoji: r.gift_emoji,
            giftClipUrl: g.clip_path ?? null,
            giftClipType: g.clip_type ?? null,
            coins: r.coins ?? 0,
            diamonds: 0,
            quantity: 1,
            animation: g.animation ?? "pop",
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
              .select("name,emoji,icon,animation,clip_path,clip_type")
              .eq("id", r.gift_id)
              .maybeSingle(),
            supabase.from("profiles").select("username,avatar").eq("id", r.sender_id).maybeSingle(),
            supabase.from("profiles").select("username,avatar").eq("id", r.receiver_id).maybeSingle(),
          ]);
          const g = (gift ?? {}) as {
            name?: string; emoji?: string; icon?: string; animation?: string;
            clip_path?: string | null; clip_type?: string | null;
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
            giftClipUrl: g.clip_path ?? null,
            giftClipType: g.clip_type ?? null,
            coins: r.coins_spent ?? 0,
            diamonds: r.diamonds_earned ?? 0,
            quantity: r.quantity ?? 1,
            animation: g.animation ?? "pop",
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
  const isBig = current.coins >= 5000;

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

      {/* bottom: big clip / emoji, TikTok-style above footer */}
      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-10 flex flex-col items-center px-2">
        {hasVideo ? (
          <AnimatedGiftVideo src={giftClipUrl} type={giftClip.type} onReady={markCurrentReady} onDone={clearCurrent} />
        ) : hasSvg ? (
          <AnimatedGiftImage src={giftClipUrl} onReady={markCurrentReady} />
        ) : (
          <span
            className="gift-anim-emoji block leading-none drop-shadow-[0_8px_32px_rgba(255,180,60,0.6)]"
            style={{ fontSize: isBig ? "12rem" : "9rem" }}
          >
            {current.giftEmoji}
          </span>
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

      {/* receiver DP + points badge */}
      {(current.receiverAvatar || current.receiverName) && (
        <div className="mt-3 z-10 flex flex-col items-center gift-anim-caption">
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
