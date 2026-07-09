import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
};

export type GiftReceiver = { id: string; username: string | null; avatar: string | null };

const CATEGORY_ORDER = ["popular", "classic", "love", "luxury", "vip", "lucky", "premium"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  popular: "🔥 Popular",
  classic: "✨ Classic",
  love: "💖 Love",
  luxury: "💎 Luxury",
  vip: "👑 VIP",
  lucky: "🎁 Lucky",
  premium: "👑 Premium",
};

export function GiftSheet({
  open,
  onClose,
  roomId,
  receivers,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  receivers: GiftReceiver[];
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
        .select("id,name,emoji,icon,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sort_order,is_active,active")
        .order("sort_order");
      if (error) throw error;
      const rows = (data ?? []) as (Gift & { sort_order?: number; is_active?: boolean; active?: boolean })[];
      return rows.filter((g) => g.is_active !== false && g.active !== false);
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

  const send = useMutation({
    mutationFn: async () => {
      if (!selectedGift) throw new Error("Pick a gift");
      const targets = sendToAll
        ? receivers.map((r) => r.id)
        : receiverId
          ? [receiverId]
          : [];
      if (targets.length === 0) throw new Error("Pick a receiver");
      for (const rid of targets) {
        const { error } = await supabase.rpc("send_gift", {
          _room_id: roomId,
          _receiver_id: rid,
          _gift_id: selectedGift.id,
          _quantity: qty,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Gift sent 🎁");
      await refresh();
      qc.invalidateQueries({ queryKey: ["wallet_tx"] });
      setSelectedGift(null);
      setQty(1);
      onClose(); // close sheet so full-screen animation is visible
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (!open) return null;

  const totalCost =
    price(selectedGift) * qty * (sendToAll ? Math.max(1, receivers.length) : 1);
  const canAfford = (profile?.coins ?? 0) >= totalCost;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/95" onClick={onClose} style={{ contain: "strict" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl border-t border-border bg-background p-4 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)", contain: "layout paint" }}
      >

        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Send a Gift</h3>
          <div className="flex items-center gap-1.5 rounded-full bg-card/60 px-2 py-1 text-[11px] font-bold text-[color:var(--gold)]">
            <Coins className="h-3 w-3" />
            {(profile?.coins ?? 0).toLocaleString()}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-card/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Receiver picker — DP-only chips + All */}
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            To {sendToAll ? `· All (${receivers.length})` : ""}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {receivers.length === 0 && (
              <p className="text-xs text-muted-foreground">No one on stage to gift.</p>
            )}
            {receivers.length > 1 && (
              <button
                onClick={() => setSendToAll((v) => !v)}
                aria-label="All"
                className={`shrink-0 rounded-full p-[2px] transition ${
                  sendToAll
                    ? "bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_0_14px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                    : "bg-white/10"
                }`}
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-[10px] font-black">
                  ALL
                </div>
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
                  className={`shrink-0 rounded-full p-[2px] transition ${
                    active
                      ? "bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_0_14px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                      : "bg-white/10"
                  }`}
                >
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-card">
                    {r.avatar ? (
                      <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold">{(r.username ?? "?").slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected gift animated preview */}
        {selectedGift && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br from-[color:var(--primary)]/10 via-[color:var(--secondary)]/10 to-[color:var(--gold)]/10 p-3">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-black/40">
              {selectedGift.clip_path && selectedGift.clip_type === "svg" ? (
                <img src={selectedGift.clip_path} alt="" className="h-full w-full object-contain" />
              ) : selectedGift.clip_path && selectedGift.clip_type === "mp4" ? (
                <video src={selectedGift.clip_path} autoPlay loop muted playsInline className="h-full w-full object-cover" />
              ) : (
                <span className="text-5xl leading-none">{selectedGift.icon ?? selectedGift.emoji ?? "🎁"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{selectedGift.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[color:var(--gold)]">
                <Coins className="h-3 w-3" />
                {price(selectedGift).toLocaleString()} coins
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                {CATEGORY_LABEL[selectedGift.category ?? ""] ?? selectedGift.category}
              </p>
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => {
            const active = (categories.includes(activeCat) ? activeCat : categories[0]) === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  active
                    ? "bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground shadow-[0_4px_14px_-4px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                    : "bg-card/60 text-muted-foreground"
                }`}
              >
                {CATEGORY_LABEL[c] ?? c}
              </button>
            );
          })}
        </div>

        {/* Gifts grid */}
        <div className="mb-3 max-h-[36vh] overflow-y-auto">
          {gifts.isLoading && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {visibleGifts.map((g) => {
              const selected = selectedGift?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGift(g)}
                  className={`group relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl border p-2 transition-colors ${
                    selected
                      ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10"
                      : "border-border bg-card/40"
                  }`}
                >
                  <div className="grid h-12 w-12 place-items-center">
                    {g.clip_path && g.clip_type === "svg" ? (
                      <img src={g.clip_path} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-3xl leading-none">{g.icon ?? g.emoji ?? "🎁"}</span>
                    )}
                  </div>
                  <span className="truncate text-[10px] font-semibold">{g.name}</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-[color:var(--gold)]">
                    <Coins className="h-2.5 w-2.5" />
                    {price(g).toLocaleString()}
                  </span>
                </button>
              );
            })}
            {!gifts.isLoading && visibleGifts.length === 0 && (
              <p className="col-span-4 py-6 text-center text-xs text-muted-foreground">No gifts in this category yet.</p>
            )}
          </div>
        </div>

        {/* Qty + Send */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
            {[1, 5, 10, 99].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  qty === n
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                x{n}
              </button>
            ))}
          </div>
          <button
            onClick={() => send.mutate()}
            disabled={!selectedGift || (!sendToAll && !receiverId) || !canAfford || send.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {selectedGift
              ? `Send · ${totalCost.toLocaleString()} coins`
              : "Pick a gift"}
          </button>
        </div>
        {selectedGift && !canAfford && (
          <p className="mt-2 text-center text-[11px] text-[color:var(--destructive)]">
            Not enough coins. <Link to="/recharge" className="underline">Recharge</Link>
          </p>
        )}
      </div>
    </div>
  );
}
