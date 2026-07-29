import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Gem, Check, Loader2, Crown, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PROFILE_CARD_CATEGORIES, RARITY_STYLE, type ProfileCard } from "@/lib/profileCards/registry";
import { PremiumProfileCard } from "@/components/profile/PremiumProfileCard";

export const Route = createFileRoute("/_authenticated/shop-profile-cards")({ component: Page });

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ProfileCard | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [rarity, setRarity] = useState<string>("All");

  const cards = useQuery({
    queryKey: ["profile-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_cards")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfileCard[];
    },
  });

  const owned = useQuery({
    queryKey: ["user-profile-cards", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profile_cards")
        .select("card_id, is_equipped, expires_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ownedMap = useMemo(() => {
    const m = new Map<string, { equipped: boolean; expiresAt: string | null }>();
    (owned.data ?? []).forEach((r: any) =>
      m.set(r.card_id, { equipped: r.is_equipped, expiresAt: r.expires_at }),
    );
    return m;
  }, [owned.data]);

  const cats = useMemo(() => ["All", ...PROFILE_CARD_CATEGORIES], []);

  const filtered = useMemo(() => {
    let all = cards.data ?? [];
    if (category !== "All") all = all.filter((c) => c.category === category);
    if (rarity !== "All") all = all.filter((c) => c.rarity === rarity);
    return all;
  }, [cards.data, category, rarity]);

  const purchase = useMutation({
    mutationFn: async ({ id, currency }: { id: string; currency: "coins" | "diamonds" }) => {
      const { data, error } = await supabase.rpc("purchase_profile_card", {
        _card_id: id,
        _currency: currency,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Profile card unlocked!");
      qc.invalidateQueries({ queryKey: ["user-profile-cards"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast.error(prettyErr(e.message)),
  });

  const equip = useMutation({
    mutationFn: async (cardId: string | null) => {
      const { error } = await supabase.rpc("equip_profile_card", { _card_id: cardId });
      if (error) throw error;
    },
    onSuccess: (_d, arg) => {
      toast.success(arg == null ? "Unequipped" : "Equipped");
      qc.invalidateQueries({ queryKey: ["user-profile-cards"] });
      qc.invalidateQueries({ queryKey: ["equipped-profile-card"] });
    },
    onError: (e: any) => toast.error(prettyErr(e.message)),
  });

  const coinBal = (profile as any)?.coins ?? 0;
  const diamondBal = (profile as any)?.diamonds ?? 0;
  const vipLevel = (profile as any)?.vip_level ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
            <h1 className="text-lg font-black tracking-wide">Profile Cards</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[color:var(--gold)]/15 px-2.5 py-1 text-[11px] font-bold text-[color:var(--gold)]">
              <Coins className="h-3 w-3" /> {coinBal.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
              <Gem className="h-3 w-3" /> {diamondBal.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-3 pt-3">
        <div className="scrollbar-hide -mx-3 flex gap-2 overflow-x-auto px-3 pb-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                category === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border/60 bg-muted/40 text-muted-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="scrollbar-hide -mx-3 mb-3 flex gap-2 overflow-x-auto px-3">
          {["All", "common", "rare", "epic", "legendary", "mythic"].map((r) => (
            <button
              key={r}
              onClick={() => setRarity(r)}
              className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition ${
                rarity === r
                  ? "border-transparent bg-[color:var(--gold)]/25 text-[color:var(--gold)]"
                  : "border-border/40 bg-muted/30 text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {cards.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">No cards match.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((card) => {
              const own = ownedMap.get(card.id);
              const locked = card.min_vip_level > 0 && vipLevel < card.min_vip_level;
              const rar = RARITY_STYLE[card.rarity];
              return (
                <div key={card.id} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
                  <button
                    onClick={() => setPreview(card)}
                    className="relative block aspect-[3/4] w-full"
                  >
                    <PremiumProfileCard card={card} rounded="rounded-none" className="h-full w-full" />
                    <div className="absolute left-1.5 top-1.5">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${rar.className}`}>
                        {rar.label}
                      </span>
                    </div>
                    {locked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold uppercase text-[color:var(--gold)]">
                        <Crown className="mr-1 h-3 w-3" /> VIP {card.min_vip_level}
                      </div>
                    )}
                  </button>
                  <div className="p-2">
                    <div className="truncate text-xs font-bold">{card.name}</div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {card.price_coins > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-[color:var(--gold)]">
                            <Coins className="h-2.5 w-2.5" /> {card.price_coins.toLocaleString()}
                          </span>
                        )}
                        {card.price_diamonds > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-cyan-300">
                            <Gem className="h-2.5 w-2.5" /> {card.price_diamonds.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {own ? (
                        own.equipped ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
                            <Check className="mr-0.5 inline h-2.5 w-2.5" /> On
                          </span>
                        ) : (
                          <button
                            onClick={() => equip.mutate(card.id)}
                            disabled={equip.isPending}
                            className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground"
                          >
                            Equip
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => setPreview(card)}
                          disabled={locked}
                          className="rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-[9px] font-black text-black disabled:opacity-40"
                        >
                          Buy
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => equip.mutate(null)}
            className="text-xs text-muted-foreground underline"
          >
            Unequip active profile card
          </button>
        </div>
      </div>

      {preview && (
        <PreviewModal
          card={preview}
          owned={ownedMap.get(preview.id)}
          coinBal={coinBal}
          diamondBal={diamondBal}
          vipLevel={vipLevel}
          onClose={() => setPreview(null)}
          onBuy={(currency) => {
            purchase.mutate(
              { id: preview.id, currency },
              { onSuccess: () => setPreview(null) },
            );
          }}
          onEquip={() => {
            equip.mutate(preview.id, { onSuccess: () => setPreview(null) });
          }}
          buying={purchase.isPending}
          equipping={equip.isPending}
        />
      )}

      <BottomNav />
    </div>
  );
}

function PreviewModal({
  card,
  owned,
  coinBal,
  diamondBal,
  vipLevel,
  onClose,
  onBuy,
  onEquip,
  buying,
  equipping,
}: {
  card: ProfileCard;
  owned: { equipped: boolean; expiresAt: string | null } | undefined;
  coinBal: number;
  diamondBal: number;
  vipLevel: number;
  onClose: () => void;
  onBuy: (currency: "coins" | "diamonds") => void;
  onEquip: () => void;
  buying: boolean;
  equipping: boolean;
}) {
  const locked = card.min_vip_level > 0 && vipLevel < card.min_vip_level;
  const canBuyCoins = card.price_coins > 0 && coinBal >= card.price_coins && !locked;
  const canBuyDiamonds = card.price_diamonds > 0 && diamondBal >= card.price_diamonds && !locked;
  const rar = RARITY_STYLE[card.rarity];

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/85 sm:items-center" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-sm rounded-t-3xl border-t border-border bg-card p-4 sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2" onClick={onClose}>
          <X className="h-4 w-4 text-white" />
        </button>

        <div className="mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl">
          <PremiumProfileCard card={card} rounded="rounded-2xl" className="h-full w-full" />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h2 className="text-lg font-black">{card.name}</h2>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${rar.className}`}>
            {rar.label}
          </span>
        </div>
        {card.description && (
          <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-muted/60 px-2 py-0.5">{card.category}</span>
          {card.min_vip_level > 0 && (
            <span className="rounded-full bg-[color:var(--gold)]/15 px-2 py-0.5 text-[color:var(--gold)]">
              <Crown className="mr-0.5 inline h-3 w-3" /> VIP {card.min_vip_level}+
            </span>
          )}
          {card.duration_days && (
            <span className="rounded-full bg-muted/60 px-2 py-0.5">{card.duration_days}d</span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {owned ? (
            <button
              onClick={onEquip}
              disabled={owned.equipped || equipping}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {owned.equipped ? "Equipped ✓" : equipping ? "Equipping..." : "Equip"}
            </button>
          ) : (
            <>
              {card.price_coins > 0 && (
                <button
                  onClick={() => onBuy("coins")}
                  disabled={!canBuyCoins || buying}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--gold)] py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  <Coins className="h-4 w-4" />
                  {buying ? "Buying..." : `Buy for ${card.price_coins.toLocaleString()} coins`}
                </button>
              )}
              {card.price_diamonds > 0 && (
                <button
                  onClick={() => onBuy("diamonds")}
                  disabled={!canBuyDiamonds || buying}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  <Gem className="h-4 w-4" />
                  {buying ? "Buying..." : `Buy for ${card.price_diamonds.toLocaleString()} diamonds`}
                </button>
              )}
              {locked && (
                <p className="text-center text-[11px] font-bold text-[color:var(--gold)]">
                  Requires VIP Level {card.min_vip_level}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyErr(msg: string | undefined) {
  if (!msg) return "Something went wrong";
  if (msg.includes("INSUFFICIENT_COINS")) return "Not enough coins";
  if (msg.includes("INSUFFICIENT_DIAMONDS")) return "Not enough diamonds";
  if (msg.includes("ALREADY_OWNED")) return "You already own this card";
  if (msg.startsWith("VIP_LEVEL_REQUIRED")) return `Requires VIP Level ${msg.split(":")[1]}`;
  if (msg.includes("CARD_EXPIRED")) return "This card has expired";
  if (msg.includes("CARD_NOT_FOUND")) return "Card unavailable";
  return msg;
}
