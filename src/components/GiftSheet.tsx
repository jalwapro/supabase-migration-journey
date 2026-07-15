import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATALOG_GIFTS } from "@/lib/gifts";
import { preloadGiftVideo, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { getGiftAudioPrefs } from "@/lib/giftAudio";
import { X, Loader2, Coins, Send } from "lucide-react";
import { toast } from "sonner";

export type Gift = {
  id: string;
  name: string;
  icon: string | null;
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

const CATEGORY_ORDER = ["love", "party", "fun", "luxury", "vip", "magic", "legendary", "mythic"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  love: "💖 Love",
  party: "🎉 Party",
  fun: "🍦 Fun",
  luxury: "💎 Luxury",
  vip: "👑 VIP",
  magic: "✨ Magic",
  legendary: "🐉 Legendary",
  mythic: "🏰 Mythic",
};

const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_MP4_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/82be6f35-cb0c-44fc-8232-8514da26b101/royal-rose.mp4`;
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;

function isRoyalRoseGift(name: string | null | undefined) {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return normalized === "royal rose" || (normalized.includes("royal") && normalized.includes("rose"));
}

function GiftPreview({ gift, large = false }: { gift: Gift; large?: boolean }) {
  // Show static PNG thumbnail everywhere in the gift box.
  // Animation only plays after Send (via jalwa:gift-sent event in room).
  if (isRoyalRoseGift(gift.name)) {
    return <img src={ROYAL_ROSE_THUMB_URL} alt="" className="h-full w-full object-contain" />;
  }
  if (gift.image_url) {
    return <img src={gift.image_url} alt="" className="h-full w-full object-contain" />;
  }
  if (gift.clip_path && gift.clip_type === "svg") {
    return <img src={gift.clip_path} alt="" className="h-full w-full object-contain" />;
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
  const [activeCat, setActiveCat] = useState<string>("popular");

  const gifts = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,emoji,icon,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sound_url,sort_order,is_active,active")
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    (gifts.data ?? []).forEach((g) => g.category && set.add(g.category));
    const found = Array.from(set);
    const ordered = CATEGORY_ORDER.filter((c) => set.has(c));
    const extras = found.filter((c) => !ordered.includes(c as never));
    return [...ordered, ...extras];
  }, [gifts.data]);

  // Auto-pick a valid tab once gifts load
  const visibleGifts = useMemo(() => {
    const all = gifts.data ?? [];
    const cat = categories.includes(activeCat) ? activeCat : categories[0];
    return all.filter((g) => g.category === cat);
  }, [gifts.data, categories, activeCat]);

  const price = (g: Gift | null) => (g?.price_coins ?? g?.price ?? 0) as number;

  const giftVideoUrl = (g: Gift | null) => {
    if (!g?.clip_path || !["mp4", "webm"].includes(g.clip_type ?? "")) return null;
    return resolvePlayableGiftUrl(g.clip_path);
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
      for (const rid of targets) {
        const { error } = await supabase.rpc("send_gift", {
          _room_id: roomId,
          _receiver_id: rid,
          _gift_id: gift.id,
          _quantity: quantity,
        });
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
          giftEmoji: royalRose ? "" : selectedGift.emoji ?? selectedGift.icon ?? "🎁",
          giftImageUrl: royalRose ? ROYAL_ROSE_THUMB_URL : selectedGift.image_url ?? null,
          giftClipUrl: royalRose ? ROYAL_ROSE_MP4_URL : selectedGift.image_url ?? giftVideoUrl(selectedGift) ?? null,
          giftClipType: royalRose ? "mp4" : selectedGift.image_url ? "image" : selectedGift.clip_path ? selectedGift.clip_type : null,
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

  const activeCategory = categories.includes(activeCat) ? activeCat : categories[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70"
      onClick={onClose}
      style={{ contain: "strict", isolation: "isolate" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-[62dvh] max-h-[640px] w-full max-w-md flex-col rounded-t-2xl bg-[#161616] text-white shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)", contain: "layout paint" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Receiver row — tiny avatars, TikTok style */}
        {receivers.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="text-[11px] text-white/60">To:</span>
            <div className="flex flex-1 gap-1.5 overflow-x-auto">
              {receivers.length > 1 && (
                <button
                  onClick={() => setSendToAll((v) => !v)}
                  className={`grid h-7 shrink-0 place-items-center rounded-full px-2 text-[10px] font-bold transition ${
                    sendToAll ? "bg-[#fe2c55] text-white" : "bg-white/10 text-white/80"
                  }`}
                >
                  All
                </button>
              )}
              {receivers.map((r) => {
                const active = !sendToAll && receiverId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSendToAll(false);
                      setReceiverId(r.id);
                    }}
                    aria-label={r.username ?? "user"}
                    className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full transition ${
                      active ? "ring-2 ring-[#fe2c55]" : "ring-1 ring-white/15"
                    }`}
                  >
                    {r.avatar ? (
                      <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold">
                        {(r.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category tabs — TikTok underline style */}
        <div className="mt-2 flex gap-4 overflow-x-auto border-b border-white/5 px-4">
          {categories.map((c) => {
            const active = activeCategory === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`relative shrink-0 whitespace-nowrap py-2.5 text-[13px] font-semibold transition ${
                  active ? "text-white" : "text-white/50"
                }`}
              >
                {CATEGORY_LABEL[c] ?? c}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[#fe2c55]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Gifts grid — 4 cols, dense */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {gifts.isLoading && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/40" />
            </div>
          )}
          <div className="grid grid-cols-4 gap-1">
            {visibleGifts.map((g) => {
              const selected = selectedGift?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    if (selected) {
                      handleSend();
                    } else {
                      setSelectedGift(g);
                    }
                  }}
                  onPointerDown={() => preloadGiftVideo(giftVideoUrl(g))}
                  className={`group relative flex flex-col items-center justify-end gap-0.5 rounded-xl px-1.5 pb-1.5 pt-2 transition ${
                    selected ? "bg-white/10" : "bg-transparent active:bg-white/5"
                  }`}
                >
                  <div className="grid h-14 w-14 place-items-center">
                    <GiftPreview gift={g} />
                  </div>
                  <span className="w-full truncate text-center text-[11px] font-medium text-white/90">
                    {g.name}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#ffd447]">
                    <img
                      src="/animations/emojis/money.svg"
                      alt=""
                      className="h-2.5 w-2.5"
                      onError={(e) => ((e.currentTarget.style.display = "none"))}
                    />
                    <Coins className="h-2.5 w-2.5" />
                    {price(g).toLocaleString()}
                  </span>
                  {selected && (
                    <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-[#fe2c55]/60" />
                  )}
                </button>
              );
            })}
            {!gifts.isLoading && visibleGifts.length === 0 && (
              <p className="col-span-4 py-8 text-center text-xs text-white/50">
                No gifts in this category yet.
              </p>
            )}
          </div>
        </div>

        {/* Bottom action bar — coin balance + qty + Send */}
        <div className="flex shrink-0 items-center gap-2 border-t border-white/5 bg-[#161616] px-3 py-2.5">
          <Link
            to="/recharge"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1.5 pl-2 pr-2.5 text-[12px] font-bold text-white active:bg-white/10"
          >
            <Coins className="h-3.5 w-3.5 text-[#ffd447]" />
            <span>{(profile?.coins ?? 0).toLocaleString()}</span>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-[#fe2c55] text-[10px] font-black leading-none text-white">
              +
            </span>
          </Link>

          {/* Qty selector */}
          <div className="flex items-center rounded-full bg-white/[0.06] p-0.5">
            {[1, 10, 99].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={`min-w-[30px] rounded-full px-2 py-1 text-[11px] font-bold transition ${
                  qty === n ? "bg-white text-black" : "text-white/70"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleSend}
            disabled={!selectedGift || (!sendToAll && !receiverId) || !canAfford || send.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#fe2c55] to-[#ff5177] px-4 py-2 text-[13px] font-black text-white shadow-[0_4px_14px_-4px_rgba(254,44,85,0.7)] disabled:opacity-40 disabled:shadow-none"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </button>
        </div>

        {selectedGift && !canAfford && (
          <p className="px-4 pb-1 text-center text-[11px] text-[#fe2c55]">
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

