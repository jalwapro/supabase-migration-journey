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
};

const PLAY_MS = 4200;

export function GiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<Play[]>([]);
  const [current, setCurrent] = useState<Play | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((p: Play) => {
    if (seenRef.current.has(p.key)) return;
    seenRef.current.add(p.key);
    setQueue((q) => [...q, p]);
  }, []);

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

  // player loop
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    const t = setTimeout(() => setCurrent(null), PLAY_MS);
    return () => clearTimeout(t);
  }, [queue, current]);

  if (!current) return null;

  const initial = (current.senderName ?? "?").slice(0, 1).toUpperCase();
  const rInitial = (current.receiverName ?? "?").slice(0, 1).toUpperCase();
  const isBig = current.coins >= 5000;
  const particles = Array.from({ length: isBig ? 24 : 14 });
  const hasVideo = current.giftClipUrl && current.giftClipType === "mp4";
  const hasSvg = current.giftClipUrl && current.giftClipType !== "mp4";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
      aria-live="polite"
    >
      {/* dim + radial glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
      <div className="absolute inset-0 gift-anim-glow" />
      <div className="absolute inset-0 gift-anim-shimmer" />

      {/* particles */}
      {particles.map((_, i) => {
        const angle = (360 / particles.length) * i;
        return (
          <span
            key={i}
            className="absolute text-2xl gift-anim-particle"
            style={{
              ["--angle" as string]: `${angle}deg`,
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

      {/* center: big clip / emoji */}
      <div className="relative z-10 flex flex-col items-center">
        {hasVideo ? (
          <video
            src={current.giftClipUrl!}
            autoPlay
            muted
            loop
            playsInline
            className="gift-anim-emoji h-[42vh] max-h-[420px] w-auto max-w-[90vw] object-contain drop-shadow-[0_8px_32px_rgba(255,180,60,0.6)]"
          />
        ) : hasSvg ? (
          <img
            src={current.giftClipUrl!}
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
        <div className="absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gift-anim-caption">
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
