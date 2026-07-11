import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * TikTok-style full-screen gift animation player.
 * Plays incoming gifts one-by-one as a rich full-screen animation with:
 *  - Sender chip (top-left)
 *  - Big gift clip (SVG/MP4) or emoji in the center
 *  - Receiver DP with a +diamonds "points" badge below
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

const WEBM_FALLBACKS: Record<string, string> = {
  "01_love_balloons.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/ecab9a99-783d-4b01-8367-7623ab8fb94a/01_love_balloons.alpha.webm",
  "02_chocolate_box.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/5301e1a2-2317-4b6a-9e75-73909245f606/02_chocolate_box.alpha.webm",
  "03_cake.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/57d0a07b-93fc-4ce7-87e4-ed1522460ba7/03_cake.alpha.webm",
  "04_magic_wand.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/67213ed8-be25-4c83-a0b8-40bbb1402653/04_magic_wand.alpha.webm",
  "05_coffee_cup.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/7733dce8-006e-491d-9141-1e7c0f9e5787/05_coffee_cup.alpha.webm",
  "06_ice_cream.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/d5e8c03d-431d-4cef-bb12-bd187e25c826/06_ice_cream.alpha.webm",
  "07_ring.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/26244db3-73e3-47f0-a7e6-a9fc8320924f/07_ring.alpha.webm",
  "08_ferrari.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/0aa930f2-73ac-41c3-87f8-ba913d319b42/08_ferrari.alpha.webm",
  "09_private_jet.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/72ea3116-3a5c-4845-92ea-346475cbc763/09_private_jet.alpha.webm",
  "10_yacht.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/6fc0dce2-de09-49cb-9b60-7057b41263fd/10_yacht.alpha.webm",
  "11_helicopter.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/1c2869e5-272c-4da2-9a7d-13f630b7d461/11_helicopter.alpha.webm",
  "12_golden_dragon.mp4": "https://cloud-to-soul.lovable.app/__l5e/assets-v1/0c9cf956-81b3-4c94-9c51-21296c194923/12_golden_dragon.alpha.webm",
};

function resolveGiftClipUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${url}`;
  return url;
}

function resolveWebmFallback(url: string) {
  const fileName = url.split("/").pop() ?? "";
  return WEBM_FALLBACKS[fileName] ?? null;
}

function giftSignature(p: Play) {
  return `${p.senderName}|${p.receiverName}|${p.giftName}|${p.quantity}|${p.coins}`;
}

function AnimatedGiftVideo({ src, onDone }: { src: string; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const webmSrc = resolveWebmFallback(src);

  useEffect(() => {
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
        onLoadedData={() => {
          setReady(true);
          tryPlay();
        }}
        onCanPlay={() => {
          setReady(true);
          tryPlay();
        }}
        onError={() => setFailed(true)}
        onEnded={onDone}
        className="gift-anim-video h-full w-full bg-transparent object-contain opacity-0 transition-opacity duration-150"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {webmSrc && <source src={webmSrc} type="video/webm" />}
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const localGiftRef = useRef<Map<string, number>>(new Map());

  const enqueue = useCallback((p: Play) => {
    if (seenRef.current.has(p.key)) return;
    const signature = giftSignature(p);
    const localUntil = localGiftRef.current.get(signature) ?? 0;
    if (!p.local && localUntil > Date.now()) return;
    if (p.local) localGiftRef.current.set(signature, Date.now() + 9000);
    seenRef.current.add(p.key);
    setQueue((q) => [...q, p]);
  }, []);

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
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  // Auto-clear current after PLAY_MS. Kept in a separate effect so the
  // cleanup only fires when `current` itself changes — not on every
  // queue mutation, which was cancelling the timer and leaving the
  // full-screen overlay stuck on screen ("room frozen until refresh").
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(
      () => setCurrent(null),
      current.giftClipUrl && current.giftClipType === "mp4" ? VIDEO_PLAY_MS : PLAY_MS,
    );
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const initial = (current.senderName ?? "?").slice(0, 1).toUpperCase();
  const rInitial = (current.receiverName ?? "?").slice(0, 1).toUpperCase();
  const isBig = current.coins >= 5000;
  const particles = Array.from({ length: isBig ? 24 : 14 });
  const giftClipUrl = resolveGiftClipUrl(current.giftClipUrl);
  const hasVideo = giftClipUrl && current.giftClipType === "mp4";
  const hasSvg = giftClipUrl && current.giftClipType !== "mp4";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-live="polite"
    >
      {/* particles */}
      {particles.map((_, i) => {
        const angle = (360 / particles.length) * i;
        return (
          <span
            key={i}
            className="absolute text-2xl gift-anim-particle"
            style={{
              ["--angle" as string]: `${angle}deg`,
              top: "auto",
              bottom: "calc(env(safe-area-inset-bottom) + 13.5rem)",
              left: "50%",
              animationDelay: `${(i % 5) * 40}ms`,
            } as React.CSSProperties}
          >
            {i % 3 === 0 ? "✨" : i % 3 === 1 ? "⭐" : "💫"}
          </span>
        );
      })}

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
          <AnimatedGiftVideo src={giftClipUrl} onDone={() => setCurrent(null)} />
        ) : hasSvg ? (
          <img
            src={giftClipUrl}
            alt=""
            className="gift-anim-emoji h-[38vh] max-h-[360px] w-auto max-w-[80vw] object-contain drop-shadow-[0_8px_32px_rgba(255,180,60,0.6)]"
          />
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
          {current.diamonds > 0 && (
            <div className="mt-1.5 flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--destructive)] px-3 py-1 text-[13px] font-black text-black shadow-lg">
              <span>💎</span>
              <span>+{current.diamonds.toLocaleString()}</span>
              <span className="text-[10px] font-bold opacity-80">pts</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
