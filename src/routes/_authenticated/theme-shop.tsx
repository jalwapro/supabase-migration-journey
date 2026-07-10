import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Check, Coins, Loader2, Sparkles, ChevronLeft, ChevronRight, X, Crown, Gem, Gift } from "lucide-react";
import { ItemAnimation } from "@/components/ItemAnimation";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/theme-shop")({ component: Page });

type Category = {
  id: string;
  name: string;
  slug: string | null;
  icon_url: string | null;
  sort_order: number;
};
type ShopItem = {
  id: string;
  name: string;
  category_id: string | null;
  preview_url: string | null;
  animation_url: string | null;
  bg_image: string | null;
  price_diamonds: number;
  price: number;
  duration_days: number | null;
  is_premium: boolean;
  is_free: boolean;
  primary_color: string;
  accent_color: string;
};
type OwnedRow = { theme_id: string; expires_at: string | null };

function Page() {
  const { user, profile, refresh } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["shop", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [cats, items, owned] = await Promise.all([
        supabase.from("theme_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("themes").select("*").eq("is_active", true).order("sort"),
        supabase.from("user_themes").select("theme_id,expires_at").eq("user_id", user!.id),
      ]);
      // Client-side dedupe by slug (fallback — DB now has a unique index too)
      const rawCats = (cats.data ?? []) as Category[];
      const seen = new Set<string>();
      const dedupedCats: Category[] = [];
      for (const c of rawCats) {
        const key = (c.slug ?? c.name ?? c.id).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        dedupedCats.push(c);
      }
      return {
        cats: dedupedCats,
        items: (items.data ?? []) as ShopItem[],
        owned: new Map((owned.data ?? []).map((o: any) => [o.theme_id as string, o as OwnedRow])),
      };
    },
  });

  const cats = data?.cats ?? [];
  const currentCat = activeCat ?? cats[0]?.id ?? null;
  const items = useMemo(
    () => (data?.items ?? []).filter((i) => (currentCat ? i.category_id === currentCat : true)),
    [data?.items, currentCat],
  );

  const featured = useMemo(
    () => items.find((i) => i.is_premium) ?? items[0] ?? null,
    [items],
  );

  const selected = useMemo(
    () => (selectedId ? (data?.items ?? []).find((i) => i.id === selectedId) ?? null : null),
    [selectedId, data?.items],
  );

  const buy = useMutation({
    mutationFn: async ({ item, currency }: { item: ShopItem; currency: "coins" | "diamonds" }) => {
      const { error } = await supabase.rpc("purchase_shop_item", { _theme_id: item.id, _currency: currency });
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      toast.success(`Purchased with ${vars.currency === "diamonds" ? "💎" : "🪙"}`);
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (e: Error) => toast.error(`Purchase failed: ${e.message}`),
  });

  const COLUMN_FOR_CATEGORY: Record<string, "frame" | "ring" | "bubble" | "car" | "entrance" | "special_id" | "data_card"> = {
    frame: "frame", frames: "frame",
    ring: "ring", rings: "ring",
    bubble: "bubble", bubbles: "bubble", "chat bubble": "bubble",
    car: "car", cars: "car", vehicle: "car",
    entrance: "entrance", entry: "entrance", "entrance effect": "entrance",
    "special id": "special_id", "special_id": "special_id", specialid: "special_id", id: "special_id",
    "data card": "data_card", data_card: "data_card", datacard: "data_card", card: "data_card",
  };

  const equip = useMutation({
    mutationFn: async (item: ShopItem) => {
      const cat = (data?.cats ?? []).find((c) => c.id === item.category_id);
      const slug = (cat?.slug ?? "").toLowerCase().trim();
      const name = (cat?.name ?? "").toLowerCase().trim();
      const isTheme = slug === "theme" || slug === "themes" || name === "theme" || name === "themes";

      if (isTheme) {
        const { error } = await supabase.rpc("equip_theme", { _theme_id: item.id });
        if (error) {
          const { error: upErr } = await supabase
            .from("profiles")
            .update({ theme_id: item.id })
            .eq("id", user!.id);
          if (upErr) throw error;
        }
        return;
      }

      const column = COLUMN_FOR_CATEGORY[slug] || COLUMN_FOR_CATEGORY[name];
      if (!column) {
        toast.info("This category doesn't have a placement yet.");
        return;
      }
      const url = item.animation_url || item.preview_url || item.bg_image;
      const { error } = await supabase
        .from("profiles")
        .update({ [column]: url })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Applied ✨");
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (e: Error) => toast.error(`Apply failed: ${e.message}`),
  });

  const unequip = useMutation({
    mutationFn: async (item: ShopItem) => {
      const cat = (data?.cats ?? []).find((c) => c.id === item.category_id);
      const slug = (cat?.slug ?? "").toLowerCase().trim();
      const name = (cat?.name ?? "").toLowerCase().trim();
      const isTheme = slug === "theme" || slug === "themes" || name === "theme" || name === "themes";
      if (isTheme) {
        const { error } = await supabase.from("profiles").update({ theme_id: null }).eq("id", user!.id);
        if (error) throw error;
        return;
      }
      const column = COLUMN_FOR_CATEGORY[slug] || COLUMN_FOR_CATEGORY[name];
      if (!column) return;
      const { error } = await supabase.from("profiles").update({ [column]: null }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Unequipped");
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (e: Error) => toast.error(`Unequip failed: ${e.message}`),
  });

  const equippedColumnFor = (item: ShopItem): "theme_id" | "frame" | "ring" | "bubble" | "car" | "entrance" | "special_id" | "data_card" | null => {
    const cat = (data?.cats ?? []).find((c) => c.id === item.category_id);
    const slug = (cat?.slug ?? "").toLowerCase().trim();
    const name = (cat?.name ?? "").toLowerCase().trim();
    if (slug === "theme" || slug === "themes" || name === "theme" || name === "themes") return "theme_id";
    return COLUMN_FOR_CATEGORY[slug] || COLUMN_FOR_CATEGORY[name] || null;
  };

  const isItemEquipped = (item: ShopItem): boolean => {
    const col = equippedColumnFor(item);
    if (!col) return false;
    if (col === "theme_id") return profile?.theme_id === item.id;
    const url = item.animation_url || item.preview_url || item.bg_image;
    const cur = (profile as unknown as Record<string, string | null>)?.[col];
    return !!cur && !!url && cur === url;
  };

  const isOwned = (id: string) => {
    const r = data?.owned.get(id);
    return !!r && (!r.expires_at || new Date(r.expires_at) > new Date());
  };

  // Every item can be bought with either currency when both prices are set.
  const currencyFor = (it: ShopItem): "diamonds" | "coins" =>
    it.price_diamonds > 0 ? "diamonds" : "coins";
  const priceFor = (it: ShopItem): number =>
    it.is_free ? 0 : it.price_diamonds > 0 ? it.price_diamonds : it.price;
  const hasCoinPrice = (it: ShopItem) => !it.is_free && it.price > 0;
  const hasDiamondPrice = (it: ShopItem) => !it.is_free && it.price_diamonds > 0;
  const canAffordCurrency = (it: ShopItem, cur: "coins" | "diamonds") => {
    if (it.is_free) return true;
    return cur === "diamonds"
      ? (profile?.diamonds ?? 0) >= it.price_diamonds
      : (profile?.coins ?? 0) >= it.price;
  };
  const activeCatObj = cats.find((c) => c.id === currentCat) ?? null;

  return (
    <>
      <div className="shop-premium mx-auto min-h-[100dvh] max-w-md pb-28">
        {/* Premium header */}
        <header
          className="sticky top-0 z-30 border-b border-[color:var(--gold)]/25 bg-[#0a0603]/95 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <button
              onClick={() => router.history.back()}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white ring-1 ring-white/10"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center">
              <h1 className="shop-gold-shimmer text-base font-black uppercase tracking-[0.32em]">
                ✦ Royal Shop ✦
              </h1>
              <span className="mt-0.5 h-[2px] w-20 rounded-full bg-gradient-to-r from-transparent via-[color:var(--gold)] to-transparent" />
            </div>
            <Link
              to="/wallet"
              aria-label="Wallet"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-[color:var(--gold)] ring-1 ring-[color:var(--gold)]/40"
            >
              <Crown className="h-4 w-4" />
            </Link>
          </div>

          {/* Balance strip */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent px-3 py-1.5 ring-1 ring-[color:var(--gold)]/30">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-700">
                <Coins className="h-3 w-3 text-amber-950" />
              </span>
              <span className="text-sm font-black text-white">{(profile?.coins ?? 0).toLocaleString()}</span>
              <span className="mx-1 h-3 w-px bg-white/20" />
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-500">
                <Gem className="h-3 w-3 text-white" />
              </span>
              <span className="text-sm font-black text-white">{(profile?.diamonds ?? 0).toLocaleString()}</span>
            </div>
            <Link
              to="/recharge"
              className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-3 py-1.5 text-xs font-black text-amber-950 shadow-[0_0_18px_rgba(212,175,55,0.35)]"
            >
              Top up
            </Link>
          </div>
        </header>

        {/* Body */}
        <div className="flex">
          {/* Sidebar categories */}
          <aside className="w-[80px] shrink-0 space-y-2 py-3 pl-2 pr-1">
            {cats.map((c) => {
              const active = c.id === currentCat;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    setSelectedId(null);
                  }}
                  className={`relative flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 transition ${
                    active
                      ? "shop-cat-active"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-r bg-gradient-to-b from-amber-200 to-amber-500 shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  )}
                  <div
                    className={`grid h-11 w-11 place-items-center overflow-hidden rounded-full ${
                      active
                        ? "ring-2 ring-[color:var(--gold)] shadow-[0_0_16px_rgba(212,175,55,0.45)]"
                        : "ring-1 ring-white/10"
                    }`}
                  >
                    {c.icon_url ? (
                      <img src={c.icon_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-400/40 to-fuchsia-600/40">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold tracking-wide ${
                      active ? "text-[color:var(--gold)]" : "text-white/60"
                    }`}
                  >
                    {c.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Items grid */}
          <main className="min-w-0 flex-1 px-2 py-3">
            {/* Featured hero */}
            {featured && (
              <button
                onClick={() => setSelectedId(featured.id)}
                className="shop-featured group relative mb-3 block w-full overflow-hidden rounded-2xl text-left"
              >
                <div
                  className="relative aspect-[16/8] w-full"
                  style={{ background: `linear-gradient(120deg, ${featured.primary_color}, ${featured.accent_color})` }}
                >
                  {(featured.animation_url || featured.bg_image || featured.preview_url) && (
                    <img
                      src={featured.bg_image || featured.preview_url || featured.animation_url || ""}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/20 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 shop-featured-shine" />
                  <div className="absolute inset-y-0 left-0 flex flex-col justify-center gap-1 p-3">
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-200 ring-1 ring-[color:var(--gold)]/50">
                      <Crown className="h-3 w-3" /> Featured
                    </span>
                    <h2 className="text-lg font-black text-white drop-shadow">{featured.name}</h2>
                    <div className="flex items-center gap-1 text-xs font-bold text-white/90">
                      {currencyFor(featured) === "diamonds" ? (
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-500 text-[9px] text-white">
                          <Gem className="h-2.5 w-2.5" />
                        </span>
                      ) : (
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[9px] text-amber-950">
                          <Coins className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {priceFor(featured).toLocaleString()}
                      <span className="mx-1 opacity-40">·</span>
                      <span className="text-[10px] uppercase tracking-wide text-amber-200/90">
                        {featured.duration_days && featured.duration_days > 0 ? `${featured.duration_days} days` : "Permanent"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* Category title */}
            {activeCatObj && (
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white/90">
                  {activeCatObj.name}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  {items.length} items
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {items.map((it) => {
                const owned = isOwned(it.id);
                const frameUrl = it.animation_url || it.preview_url || it.bg_image;
                const isEquipped = isItemEquipped(it);
                const isSelected = selectedId === it.id;
                const badge = it.duration_days && it.duration_days > 0 ? `${it.duration_days}d` : "Perm";
                const cat = cats.find((c) => c.id === it.category_id);
                const catKey = `${cat?.slug ?? ""} ${cat?.name ?? ""}`.toLowerCase();
                const isBackground =
                  !!it.bg_image ||
                  /theme|background|wallpaper|bg|skin/.test(catKey);
                const media = it.animation_url || it.bg_image || it.preview_url;
                const isVideo = !!media && /\.(mp4|webm|mov)($|\?)/i.test(media);
                const gridImage = isVideo ? it.bg_image || it.preview_url : media;

                return (
                  <button
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`shop-item-card group relative overflow-hidden rounded-2xl text-left transition ${
                      isSelected ? "shop-item-selected" : ""
                    } ${it.is_premium ? "shop-item-premium" : ""}`}
                  >
                    {/* Badges */}
                    <span className="absolute left-1.5 top-1.5 z-20 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-black text-white/95 ring-1 ring-white/10">
                      {badge}
                    </span>
                    {it.is_premium && (
                      <span className="absolute left-1.5 top-8 z-20 flex items-center gap-0.5 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 px-1.5 py-0.5 text-[9px] font-black text-amber-950">
                        <Crown className="h-2.5 w-2.5" /> VIP
                      </span>
                    )}
                    <span className="absolute right-1.5 top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/10">
                      <Play className="h-2.5 w-2.5 fill-current" />
                    </span>

                    {/* Media area */}
                    <div
                      className={`relative z-10 grid place-items-center px-2.5 py-2.5 ${isBackground ? "aspect-[3/4]" : "aspect-square"}`}
                    >
                      {isBackground ? (
                        <div
                          className="relative h-full w-full overflow-hidden rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.6)]"
                          style={{ background: `linear-gradient(160deg, ${it.primary_color}, ${it.accent_color})` }}
                        >
                          {media ? (
                            isVideo ? (
                              gridImage ? (
                                <img src={gridImage} alt={it.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                              ) : (
                                <video src={media} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                              )
                            ) : (
                              <img src={media} alt={it.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                            )
                          ) : null}
                          <div className="absolute inset-x-0 top-2 flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full border-2 border-white/80 bg-gradient-to-br from-pink-400 to-fuchsia-600" />
                            <div className="mt-0.5 text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                              {it.name}
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                      ) : media ? (
                        isVideo ? (
                          gridImage ? (
                            <img src={gridImage} alt={it.name} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
                          ) : (
                            <video src={media} muted playsInline preload="metadata" className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
                          )
                        ) : (
                          <img src={media} alt={it.name} className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
                        )
                      ) : (
                        <div
                          className="relative h-[62%] w-full overflow-hidden rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
                          style={{ background: `linear-gradient(135deg, ${it.primary_color}, ${it.accent_color})` }}
                        >
                          <div className="absolute inset-0 opacity-40 shop-chip-shimmer" />
                          <div className="absolute inset-0 grid place-items-center">
                            <ItemAnimation slug={cat?.slug} name={it.name} primary={it.primary_color} accent={it.accent_color} fill />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="relative z-10 -mt-1 px-2 text-center">
                      <p className="truncate text-[11px] font-bold text-white/85">{it.name}</p>
                    </div>

                    {/* Price footer */}
                    <div className="relative z-10 flex items-center justify-center gap-1 pb-2 pt-1 text-sm font-black text-white">
                      {currencyFor(it) === "diamonds" ? (
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-500 text-[10px] text-white">
                          <Gem className="h-2.5 w-2.5" />
                        </span>
                      ) : (
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[10px] text-amber-950">
                          <Coins className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {priceFor(it).toLocaleString()}
                    </div>

                    {isEquipped && (
                      <span className="absolute right-1.5 top-8 z-20 flex items-center gap-0.5 rounded-full bg-[color:var(--gold)] px-1.5 py-0.5 text-[9px] font-black text-black">
                        <Check className="h-2 w-2" /> Wearing
                      </span>
                    )}
                    {owned && !isEquipped && (
                      <span className="absolute right-1.5 top-8 z-20 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-black">
                        Owned
                      </span>
                    )}
                  </button>
                );
              })}
              {items.length === 0 && (
                <p className="col-span-2 py-10 text-center text-xs text-white/60">
                  No items in this category yet.
                </p>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Item preview popup */}
      {selected && (() => {
        const it = selected;
        const cat = cats.find((c) => c.id === it.category_id);
        const media = it.animation_url || it.bg_image || it.preview_url;
        const isVideo = !!media && /\.(mp4|webm|mov)($|\?)/i.test(media);
        const modalImage = isVideo ? it.bg_image || it.preview_url : media;
        const owned = isOwned(it.id);
        const frameUrl2 = it.animation_url || it.preview_url || it.bg_image;
        const isEquipped = isItemEquipped(it);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center"
            onClick={() => setSelectedId(null)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-[color:var(--gold)]/30 bg-[#0a0603] shadow-[0_-10px_60px_rgba(212,175,55,0.25)] sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <button
                onClick={() => setSelectedId(null)}
                className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/15"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Full preview */}
              <div
                className="relative aspect-[3/4] w-full overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${it.primary_color}, ${it.accent_color})` }}
              >
                {media && (isVideo ? (
                  modalImage ? (
                    <img src={modalImage} alt={it.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <video src={media} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                  )
                ) : (
                  <img src={media} alt={it.name} className="absolute inset-0 h-full w-full object-cover" />
                ))}
                {!media && (
                  <div className="absolute inset-0 grid place-items-center">
                    <ItemAnimation slug={cat?.slug} name={it.name} primary={it.primary_color} accent={it.accent_color} fill />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-3 px-4 text-center">
                  {cat && (
                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/90">
                      {cat.name}
                    </p>
                  )}
                  <h3 className="text-xl font-black text-white drop-shadow">{it.name}</h3>
                </div>
                {it.is_premium && (
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950">
                    <Crown className="h-3 w-3" /> Premium
                  </span>
                )}
              </div>

              {/* Meta + actions */}
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                  <div className="flex items-center gap-1.5 text-base font-black text-white">
                    {currencyFor(it) === "diamonds" ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-500">
                        <Gem className="h-3.5 w-3.5 text-white" />
                      </span>
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600">
                        <Coins className="h-3.5 w-3.5 text-amber-950" />
                      </span>
                    )}
                    {priceFor(it).toLocaleString()}
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                      {currencyFor(it)}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                    {it.duration_days && it.duration_days > 0 ? `${it.duration_days} days` : "Permanent"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toast.info("Choose a friend to send this to (coming soon)")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/8 py-3 text-sm font-black text-white ring-1 ring-white/15"
                  >
                    <Gift className="h-4 w-4" /> Send
                  </button>

                  {owned ? (
                    isEquipped ? (
                      <button
                        onClick={() => unequip.mutate(it)}
                        disabled={unequip.isPending}
                        className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/10 py-3 text-sm font-black text-white ring-1 ring-white/20 disabled:opacity-40"
                      >
                        {unequip.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 text-emerald-300" /> Unequip</>}
                      </button>
                    ) : (
                      <button
                        onClick={() => equip.mutate(it)}
                        disabled={equip.isPending}
                        className="flex-1 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 py-3 text-sm font-black text-emerald-950 shadow-[0_6px_20px_rgba(16,185,129,0.35)] disabled:opacity-40"
                      >
                        {equip.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Apply"}
                      </button>
                    )
                  ) : (
                    <button
                      disabled={buy.isPending || !canAfford}
                      onClick={() => buy.mutate(it)}
                      className="flex-1 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 py-3 text-sm font-black text-amber-950 shadow-[0_6px_20px_rgba(212,175,55,0.4)] disabled:opacity-40"
                    >
                      {buy.isPending ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : canAfford ? (
                        `Buy · ${priceFor(it).toLocaleString()} ${currencyFor(it) === "diamonds" ? "💎" : "🪙"}`
                      ) : (
                        currencyFor(it) === "diamonds" ? "Low diamonds" : "Low coins"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav />
    </>
  );
}
