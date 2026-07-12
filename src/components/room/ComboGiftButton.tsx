import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Gift, GiftReceiver } from "@/components/GiftSheet";

const COMBO_MS = 5000;
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";

export type ComboState = {
  gift: Gift;
  targets: string[];
  receivers: GiftReceiver[];
};

export function ComboGiftButton({
  state,
  onExpire,
}: {
  state: ComboState | null;
  onExpire: () => void;
}) {
  const { profile, refresh } = useAuth();
  const [count, setCount] = useState(1);
  const [remaining, setRemaining] = useState(COMBO_MS);
  const startRef = useRef<number>(Date.now());
  const busyRef = useRef(false);

  // Reset when a new combo starts
  useEffect(() => {
    if (!state) return;
    setCount(1);
    startRef.current = Date.now();
    setRemaining(COMBO_MS);
  }, [state]);

  // Countdown
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => {
      const left = COMBO_MS - (Date.now() - startRef.current);
      if (left <= 0) {
        clearInterval(id);
        onExpire();
        return;
      }
      setRemaining(left);
    }, 100);
    return () => clearInterval(id);
  }, [state, onExpire]);

  if (!state) return null;
  const { gift, targets, receivers } = state;

  const price = (gift.price_coins ?? gift.price ?? 0) as number;

  const tap = async () => {
    if (busyRef.current) return;
    const cost = price * targets.length;
    if ((profile?.coins ?? 0) < cost) {
      toast.error("Not enough coins");
      return;
    }
    busyRef.current = true;
    // Extend timer + bump count immediately for snappy UX
    startRef.current = Date.now();
    setRemaining(COMBO_MS);
    setCount((c) => c + 1);

    // Play sound (in a user gesture so autoplay allows it)
    if (gift.sound_url) {
      try {
        const raw = gift.sound_url;
        const src = raw.startsWith("/__l5e/") ? `${LOVABLE_ASSET_ORIGIN}${raw}` : raw;
        const a = new Audio(src);
        a.volume = 0.9;
        void a.play().catch(() => {});
      } catch { /* noop */ }
    }

    // Optimistic animation event
    const firstReceiver = receivers.find((r) => r.id === targets[0]) ?? null;
    window.dispatchEvent(
      new CustomEvent("jalwa:gift-sent", {
        detail: {
          key: `combo-${gift.id}-${Date.now()}`,
          senderName: profile?.username ?? "Guest",
          senderAvatar: profile?.avatar ?? null,
          receiverId: firstReceiver?.id ?? null,
          receiverIds: targets,
          receiverName: firstReceiver?.username ?? "Host",
          receiverAvatar: firstReceiver?.avatar ?? null,
          giftName: gift.name,
          giftEmoji: gift.emoji ?? gift.icon ?? "🎁",
          giftImageUrl: gift.image_url ?? null,
          giftClipUrl: gift.image_url ?? gift.clip_path ?? null,
          giftClipType: gift.image_url ? "image" : gift.clip_path ? gift.clip_type : null,
          coins: price,
          diamonds: gift.diamonds_value,
          quantity: 1,
          animation: gift.animation ?? "pop",
          soundUrl: gift.sound_url ?? null,
          local: true,
          combo: true,
        },
      }),
    );

    try {
      for (const rid of targets) {
        const { error } = await supabase.rpc("send_gift", {
          _room_id: (state as unknown as { roomId?: string }).roomId ?? undefined,
          _receiver_id: rid,
          _gift_id: gift.id,
          _quantity: 1,
        } as never);
        if (error) throw error;
      }
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busyRef.current = false;
    }
  };

  const pct = Math.max(0, Math.min(1, remaining / COMBO_MS));
  const ringSize = 68;
  const stroke = 4;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-40" style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}>
      <div className="mx-auto flex w-full max-w-md justify-end px-4">
        <button
          onClick={tap}
          className="pointer-events-auto relative grid place-items-center rounded-full shadow-[0_10px_40px_-10px_rgba(255,0,120,0.7)] transition-transform active:scale-95"
          style={{ width: ringSize, height: ringSize }}
          aria-label="Combo gift"
        >
          {/* Timer ring */}
          <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="absolute inset-0 -rotate-90"
          >
            <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              stroke="url(#comboGrad)"
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
            />
            <defs>
              <linearGradient id="comboGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="50%" stopColor="#ff2d95" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          {/* Gift image */}
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)]/30 via-[color:var(--primary)]/30 to-[color:var(--secondary)]/30 backdrop-blur-md">
            {gift.image_url ? (
              <img src={gift.image_url} alt="" className="h-9 w-9 object-contain" />
            ) : (
              <span className="text-2xl leading-none">{gift.icon ?? gift.emoji ?? "🎁"}</span>
            )}
          </div>
          {/* Combo count */}
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] px-2 py-0.5 text-[11px] font-black text-white shadow-lg">
            x{count}
          </span>
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white/90">
            COMBO
          </span>
        </button>
      </div>
    </div>
  );
}
