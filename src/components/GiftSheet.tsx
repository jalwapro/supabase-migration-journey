import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATALOG_GIFTS } from "@/lib/gifts";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { getGiftAudioPrefs, playGiftAudioCue, playJalwaSignature, unlockGiftAudio } from "@/lib/giftAudio";
import { Loader2, Coins, Send, Volume2 } from "lucide-react";
import { toast } from "sonner";

export type Gift = {
  id: string;
  name: string;
  icon: string | null;
  icon_path?: string | null;
  emoji?: string | null;
  image_url: string | null;
  price_coins: number | null;
  price?: number | null;
  diamonds_value: number;
  category: string | null;
  animation: string | null;
  clip_path?: string | null;
  clip_type?: string | null;
  sound_url?: string | null;
};

export type GiftReceiver = { id: string; username: string | null; avatar: string | null };

// Jalwa tier system — teen categorries:
//   basic   : ≤ 300 coins  (chhote gifts — flyer + coin-drop)
//   premium : 301 – 1999   (real sample sound / Jalwa signature)
//   vip     : ≥ 2000       (cinematic + real sample sound)
type Tier = "small" | "premium" | "vip";
const TIER_ORDER: Tier[] = ["small", "premium", "vip"];
const TIER_LABEL: Record<Tier, string> = {
  small: "✨ Basic",
  premium: "💎 Premium",
  vip: "👑 VIP",
};
function tierOf(price: number): Tier {
  if (price <= 300) return "small";
  if (price < 2000) return "premium";
  return "vip";
}

const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_MP4_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/82be6f35-cb0c-44fc-8232-8514da26b101/royal-rose.mp4`;
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;

function GiftTransparencyDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute h-0 w-0 overflow-hidden">
      <defs>
        <filter id="jalwa-gift-luma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0.2126 0.7152 0.0722 0 0"
          />
          <feComponentTransfer>
            <feFuncA type="linear" slope="4.8" intercept="-0.42" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

function isRoyalRoseGift(name: string | null | undefined) {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return normalized === "royal rose" || (normalized.includes("royal") && normalized.includes("rose"));
}

function GiftPreview({ gift, large = false }: { gift: Gift; large?: boolean }) {
  // Plain thumbnail — no luma-key/blend so bright SVGs stay fully visible on the dark tile.
  const imgClass = "h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]";
  if (isRoyalRoseGift(gift.name)) {
    return <img src={ROYAL_ROSE_THUMB_URL} alt="" className={imgClass} />;
  }
  const thumb = resolveGiftImageUrl(gift.image_url ?? gift.icon_path ?? (isAssetUrlLike(gift.icon) ? gift.icon : null));
  if (thumb) {
    return <img src={thumb} alt="" className={imgClass} />;
  }
  if (gift.clip_path && gift.clip_type === "svg") {
    return <img src={resolveGiftImageUrl(gift.clip_path) ?? gift.clip_path} alt="" className={imgClass} />;
  }
  return <span className={`${large ? "text-5xl" : "text-3xl"} leading-none`}>{gift.icon ?? gift.emoji ?? "🎁"}</span>;
}

export function GiftSheet({
  open,
  onClose,
  roomId,
  receivers,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  receivers: GiftReceiver[];
  onSent?: (info: { gift: Gift; targets: string[] }) => void;
}) {
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(receivers[0]?.id ?? null);
  const [sendToAll, setSendToAll] = useState(false);
  const [qty, setQty] = useState(1);
  const [activeTier, setActiveTier] = useState<Tier>("small");

  const gifts = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,emoji,icon,icon_path,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sound_url,sort_order,is_active,active")
        .order("sort_order");
      if (error) throw error;
      const rows = (data ?? []) as (Gift & { sort_order?: number; is_active?: boolean; active?: boolean })[];
      const dbGifts = rows.filter((g) => g.is_active !== false && g.active !== false);
      // Merge JSON catalog gifts, skipping any id that already exists in DB.
      const dbIds = new Set(dbGifts.map((g) => g.id));
      const merged: Gift[] = [...dbGifts, ...CATALOG_GIFTS.filter((g) => !dbIds.has(g.id))];
      return merged;
    },
    enabled: open,
  });

  // Top gifter in THIS room — refreshed each time the sheet opens.
  const topGifter = useQuery({
    queryKey: ["room_top_gifter", roomId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("room_top_gifters", { _room_id: roomId, _limit: 1 });
      if (error) throw error;
      return (data?.[0] ?? null) as { user_id: string; username: string | null; avatar: string | null; total_coins: number } | null;
    },
    enabled: open,
  });

  const price = (g: Gift | null) => (g?.price_coins ?? g?.price ?? 0) as number;

  // Group gifts by Jalwa price-tier (small / premium / vip).
  const visibleGifts = useMemo(() => {
    const all = gifts.data ?? [];
    return all
      .filter((g) => tierOf(price(g)) === activeTier)
      .sort((a, b) => price(a) - price(b));
  }, [gifts.data, activeTier]);

  const giftVideoUrl = (g: Gift | null) => {
    if (!g?.clip_path || !["mp4", "webm", "svga"].includes(g.clip_type ?? "")) return null;
    return resolvePlayableGiftUrl(g.clip_path);
  };

  const giftThumbUrl = (g: Gift | null) => {
    if (!g) return null;
    return resolveGiftImageUrl(g.image_url ?? g.icon_path ?? (isAssetUrlLike(g.icon) ? g.icon : null));
  };


  useEffect(() => {
    if (!open) return;
    CATALOG_GIFTS.forEach((g) => preloadGiftVideo(g.clip_path));
  }, [open]);

  // Preload every gift in the currently open category so tapping plays instantly
  useEffect(() => {
    if (!open) return;
    visibleGifts.forEach((g) => preloadGiftVideo(giftVideoUrl(g)));
  }, [open, visibleGifts]);

  useEffect(() => {
    if (!selectedGift) return;
    preloadGiftVideo(giftVideoUrl(selectedGift));
  }, [selectedGift]);


  useEffect(() => {
    if (!open) return;
    if (sendToAll) return;
    if (receiverId && receivers.some((r) => r.id === receiverId)) return;
    setReceiverId(receivers[0]?.id ?? null);
  }, [open, receiverId, receivers, sendToAll]);

  const send = useMutation({
    mutationFn: async ({ gift, targets, quantity }: { gift: Gift; targets: string[]; quantity: number }) => {
      if (targets.length === 0) throw new Error("Pick a receiver");
      if (targets.length === 1) {
        const { error } = await supabase.rpc("send_gift", {
          _room_id: roomId,
          _receiver_id: targets[0],
          _gift_id: gift.id,
          _quantity: quantity,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("send_gift_multi", {
          _room_id: roomId,
          _receiver_ids: targets,
          _gift_id: gift.id,
          _quantity: quantity,
        } as any);
        if (error) throw error;
      }
      return {
        gift,
        quantity,
        coins: price(gift) * quantity,
      };
    },

    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet_tx"] });
      setSelectedGift(null);
      setQty(1);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (!open) return null;

  const totalCost =
    price(selectedGift) * qty * (sendToAll ? Math.max(1, receivers.length) : 1);
  const canAfford = (profile?.coins ?? 0) >= totalCost;

  const handleSend = () => {
    if (!selectedGift || send.isPending) return;
    const targets = sendToAll
      ? receivers.map((r) => r.id)
      : receiverId
        ? [receiverId]
        : [];
    if (targets.length === 0) {
      toast.error("Pick a receiver");
      return;
    }
    const firstReceiver = receivers.find((r) => r.id === targets[0]) ?? null;
    const royalRose = isRoyalRoseGift(selectedGift.name);
    const clipUrl = royalRose ? ROYAL_ROSE_MP4_URL : giftVideoUrl(selectedGift);
    const thumbUrl = royalRose ? ROYAL_ROSE_THUMB_URL : giftThumbUrl(selectedGift);

    // Play gift sound INSIDE this click handler so the browser autoplay policy
    // allows it. Unlocks the audio context for subsequent gift sounds too.
    if (selectedGift.sound_url) {
      const prefs = getGiftAudioPrefs();
      if (!prefs.muted && prefs.volume > 0) {
        try {
          const raw = selectedGift.sound_url;
          const src = raw.startsWith("/__l5e/")
            ? `https://cloud-to-soul.lovable.app${raw}`
            : raw;
          const a = new Audio(src);
          a.volume = Math.min(1, 0.9 * prefs.volume);
          void a.play().catch(() => {});
        } catch {
          /* noop */
        }
      }
    }

    window.dispatchEvent(

      new CustomEvent("jalwa:gift-sent", {
        detail: {
          key: `local-${selectedGift.id}-${Date.now()}`,
          senderName: profile?.username ?? "Guest",
          senderAvatar: profile?.avatar ?? null,
          receiverId: firstReceiver?.id ?? null,
          receiverIds: targets,
          receiverName: firstReceiver?.username ?? "Host",
          receiverAvatar: firstReceiver?.avatar ?? null,
          giftName: selectedGift.name,
          giftEmoji: clipUrl ? "" : selectedGift.emoji ?? (isAssetUrlLike(selectedGift.icon) ? "" : selectedGift.icon) ?? "🎁",
          giftImageUrl: thumbUrl,
          giftClipUrl: clipUrl ?? thumbUrl,
          giftClipType: clipUrl ? selectedGift.clip_type : (thumbUrl ? "image" : null),
          coins: price(selectedGift) * qty,
          diamonds: selectedGift.diamonds_value * qty,
          quantity: qty,
          animation: selectedGift.animation ?? "pop",
          soundUrl: selectedGift.sound_url ?? null,
          local: true,
        },
      }),
    );
    onClose();
    send.mutate({ gift: selectedGift, targets, quantity: qty });
    onSent?.({ gift: selectedGift, targets });
  };

  // (tier tabs use TIER_ORDER directly — no legacy category resolution needed)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={onClose}
      data-jalwa-overlay="true"
      style={{ contain: "strict", isolation: "isolate" }}
    >
      <GiftTransparencyDefs />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto flex h-[46dvh] max-h-[420px] min-h-[340px] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border-t-4 border-[#7c3aed] bg-[#0f041e] text-white shadow-[0_-12px_50px_rgba(124,58,237,0.35)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)", contain: "layout paint", fontFamily: "'Outfit', system-ui, sans-serif" }}
      >
        {/* Arcade dotted grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        />

        {/* Top handle */}
        <div className="mx-auto mt-2 mb-1 h-1 w-12 rounded-full bg-white/25" />

        {/* Header: recipient chip + tier tabs */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#1a0b2e] py-0.5 pl-0.5 pr-2">
            {receivers.length > 1 && (
              <button
                onClick={() => setSendToAll((v) => !v)}
                className={`grid h-6 shrink-0 place-items-center rounded-full px-2 text-[9px] font-black uppercase tracking-wider transition ${
                  sendToAll ? "bg-gradient-to-r from-[#ff2d87] to-[#7c3aed] text-white" : "bg-white/5 text-white/70"
                }`}
              >
                All
              </button>
            )}
            {!sendToAll && receivers.slice(0, 4).map((r) => {
              const active = receiverId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => { setSendToAll(false); setReceiverId(r.id); }}
                  aria-label={r.username ?? "user"}
                  className={`grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full p-[1.5px] transition ${
                    active ? "bg-gradient-to-tr from-[#ff2d87] to-[#7c3aed]" : "bg-white/10"
                  }`}
                >
                  <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#1a0b2e]">
                    {r.avatar ? (
                      <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold">
                        {(r.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            <span className="ml-1 truncate text-[10px] font-bold uppercase tracking-wider text-white/80">
              {sendToAll
                ? `All (${receivers.length})`
                : `→ ${(receivers.find((r) => r.id === receiverId)?.username ?? "Host").slice(0, 10)}`}
            </span>
          </div>

          <div className="flex shrink-0 rounded-xl border border-white/5 bg-[#1a0b2e] p-0.5">
            {TIER_ORDER.map((t) => {
              const active = activeTier === t;
              const label = t === "small" ? "BASIC" : t === "premium" ? "PREMIUM" : "VIP";
              return (
                <button
                  key={t}
                  onClick={() => setActiveTier(t)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[9px] font-black transition ${
                    active
                      ? "bg-[#7c3aed] text-white shadow-lg shadow-purple-900/50"
                      : "text-white/40"
                  }`}
                >
                  {label}
                  {t === "vip" && !active && (
                    <span className="h-1 w-1 animate-pulse rounded-full bg-[#f5c542]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gifts grid — arcade tiles */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 [scrollbar-width:thin]">
          {gifts.isLoading && (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/40" />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {visibleGifts.map((g) => {
              const selected = selectedGift?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    unlockGiftAudio();
                    if (selected) {
                      handleSend();
                    } else {
                      setSelectedGift(g);
                      const prefs = getGiftAudioPrefs();
                      if (!prefs.muted && prefs.volume > 0) {
                        const vol = Math.min(1, prefs.volume * 0.7);
                        const tier = tierOf(price(g));
                        if (g.sound_url) {
                          playGiftAudioCue({ soundUrl: g.sound_url, volume: vol });
                        } else if (tier !== "small") {
                          playJalwaSignature(vol);
                        }
                      }
                    }
                  }}
                  onPointerDown={() => preloadGiftVideo(giftVideoUrl(g))}
                  className={`group relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-1.5 transition active:scale-95 ${
                    selected
                      ? "border-[#ff2d87] bg-[#7c3aed]/10 shadow-[0_0_15px_rgba(255,45,135,0.25)]"
                      : "border-white/5 bg-[#1a0b2e]"
                  }`}
                >
                  <div className="grid h-10 w-10 place-items-center">
                    <GiftPreview gift={g} />
                  </div>
                  <span className="mt-0.5 w-full truncate px-0.5 text-center text-[9px] font-medium text-white/60">
                    {g.name}
                  </span>
                  <div className="mt-0.5 flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f5c542]" />
                    <span className="text-[10px] font-black text-[#f5c542]">
                      {price(g) >= 1000 ? `${(price(g) / 1000).toFixed(price(g) % 1000 === 0 ? 0 : 1)}k` : price(g)}
                    </span>
                  </div>
                  {selected && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-[#ff2d87] px-1.5 text-[8px] font-black uppercase text-white">
                      Pick
                    </span>
                  )}
                </button>
              );
            })}
            {!gifts.isLoading && visibleGifts.length === 0 && (
              <p className="col-span-4 py-6 text-center text-xs text-white/50">
                No gifts in this category yet.
              </p>
            )}
          </div>
        </div>

        {/* Bottom control bar — wallet + qty + arcade Send lever */}
        <div className="flex shrink-0 items-center gap-2 border-t border-white/5 bg-[#0a0215] px-3 py-2">
          <Link to="/recharge" onClick={onClose} className="flex items-center gap-1.5">
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f5c542] shadow-[0_0_6px_#f5c542]" />
                <span className="text-sm font-black text-white">
                  {(profile?.coins ?? 0).toLocaleString()}
                </span>
              </div>
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[2px] text-white/30">Coins</span>
            </div>
            <span className="grid h-7 w-7 place-items-center rounded-lg border-b-4 border-purple-900 bg-[#7c3aed] text-base font-black text-white active:translate-y-[2px] active:border-b-0">
              +
            </span>
          </Link>

          <div className="flex items-center rounded-lg border border-white/5 bg-[#1a0b2e] p-0.5">
            {[1, 10, 99].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={`min-w-[26px] rounded-md px-1.5 py-1 text-[10px] font-black transition ${
                  qty === n ? "bg-white text-[#0f041e]" : "text-white/60"
                }`}
              >
                x{n}
              </button>
            ))}
          </div>

          <button
            onClick={handleSend}
            disabled={!selectedGift || (!sendToAll && !receiverId) || !canAfford || send.isPending}
            className="group relative ml-auto flex h-10 flex-1 items-center justify-center overflow-hidden rounded-xl border-b-4 border-pink-900 bg-gradient-to-r from-[#ff2d87] to-[#7c3aed] px-4 text-white transition-all active:translate-y-[3px] active:border-b-0 disabled:cursor-not-allowed disabled:border-b-0 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="relative z-10 flex items-center gap-1.5 text-[12px] font-black uppercase italic tracking-widest">
                <Send className="h-3.5 w-3.5" />
                Send
              </span>
            )}
            <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />
          </button>
        </div>

        {selectedGift && !canAfford && (
          <p className="px-4 pb-1 pt-0.5 text-center text-[10px] font-bold text-[#ff2d87]">
            Not enough coins.{" "}
            <Link to="/recharge" onClick={onClose} className="underline">
              Recharge
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

