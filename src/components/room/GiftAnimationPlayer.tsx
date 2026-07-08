import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * TikTok-style gift animation player.
 * Plays incoming gifts one-by-one as a rich full-width animation
 * confined to the TOP HALF of the screen, then fades out.
 */

type Play = {
  key: string;
  senderName: string;
  senderAvatar: string | null;
  giftName: string;
  giftEmoji: string;
  coins: number;
  quantity: number;
  animation: string;
};

const PLAY_MS = 3800;

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
          let avatar: string | null = null;
          if (r.sender_id) {
            const { data } = await supabase
              .from("profiles")
              .select("avatar")
              .eq("id", r.sender_id)
              .maybeSingle();
            avatar = (data as { avatar: string | null } | null)?.avatar ?? null;
          }
          let anim = "pop";
          if (r.gift_id) {
            const { data } = await supabase
              .from("gifts")
              .select("animation")
              .eq("id", r.gift_id)
              .maybeSingle();
            anim = (data as { animation: string } | null)?.animation ?? "pop";
          }
          enqueue({
            key: `ev-${r.id}`,
            senderName: r.sender_name ?? "Guest",
            senderAvatar: avatar,
            giftName: r.gift_name,
            giftEmoji: r.gift_emoji,
            coins: r.coins ?? 0,
            quantity: 1,
            animation: anim,
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
            gift_id: string;
            quantity: number;
            coins_spent: number;
          };
          const [{ data: gift }, { data: prof }] = await Promise.all([
            supabase
              .from("gifts")
              .select("name,emoji,icon,animation")
              .eq("id", r.gift_id)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("username,avatar")
              .eq("id", r.sender_id)
              .maybeSingle(),
          ]);
          const g = (gift ?? {}) as { name?: string; emoji?: string; icon?: string; animation?: string };
          const p = (prof ?? {}) as { username?: string; avatar?: string };
          enqueue({
            key: `sd-${r.id}`,
            senderName: p.username ?? "Guest",
            senderAvatar: p.avatar ?? null,
            giftName: g.name ?? "Gift",
            giftEmoji: g.emoji ?? g.icon ?? "🎁",
            coins: r.coins_spent ?? 0,
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
  const isBig = current.coins >= 5000;
  const particles = Array.from({ length: isBig ? 22 : 14 });

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex h-[50vh] items-center justify-center overflow-hidden"
      aria-live="polite"
    >
      {/* radial glow */}
      <div className="absolute inset-0 gift-anim-glow" />

      {/* shimmer sweep */}
      <div className="absolute inset-0 gift-anim-shimmer" />

      {/* particles */}
      {particles.map((_, i) => {
        const angle = (360 / particles.length) * i;
        return (
          <span
            key={i}
            className="absolute text-2xl gift-anim-particle"
            style={
              {
                // @ts-expect-error CSS custom property
                "--angle": `${angle}deg`,
                animationDelay: `${(i % 5) * 40}ms`,
              } as React.CSSProperties
            }
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
        <div className="rounded-full bg-black/70 px-3 py-1 backdrop-blur-md">
          <p className="text-[11px] font-bold text-white leading-none">@{current.senderName}</p>
          <p className="text-[10px] font-bold text-[color:var(--gold)] leading-tight">
            sent {current.giftName}
          </p>
        </div>
      </div>

      {/* big gift emoji */}
      <div className="relative flex flex-col items-center">
        <span
          className="gift-anim-emoji block leading-none drop-shadow-[0_8px_32px_rgba(255,180,60,0.6)]"
          style={{ fontSize: isBig ? "10rem" : "8rem" }}
        >
          {current.giftEmoji}
        </span>
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
    </div>
  );
}
