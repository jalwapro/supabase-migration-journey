import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Check, Coins, Loader2, Sparkles, ChevronLeft, ChevronRight, X, Crown, Gem, Gift, Lock } from "lucide-react";
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
  min_level: number | null;
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

  // Legacy categories that were replaced by dedicated shops (or have no stock)
  // must not appear as empty tabs — Entrance/Profile Cards live in their own pages.
  const cats = useMemo(() => {
    const all = data?.cats ?? [];
    const items = data?.items ?? [];
    return all.filter((c) => items.some((i) => i.category_id === c.id));
  }, [data?.cats, data?.items]);
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
      // Ownership + slot + asset URL are all resolved server-side (equip_cosmetic),
      // so an edited client can never equip an item it hasn't purchased.
      const { error } = await supabase.rpc("equip_cosmetic", { _theme_id: item.id });
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
      const slot = isTheme ? "theme" : (COLUMN_FOR_CATEGORY[slug] || COLUMN_FOR_CATEGORY[name]);
      if (!slot) return;
      const { error } = await supabase.rpc("unequip_cosmetic", { _slot: slot });
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
  const userLevel = (profile as any)?.vip_level ?? (profile as any)?.level ?? 0;
  const isLocked = (it: ShopItem) => (it.min_level ?? 0) > userLevel;
  const activeCatObj = cats.find((c) => c.id === currentCat) ?? null;

  return (
    <>
      <div className="shop-premium mx-auto min-h-[100dvh] max-w-md bg-[#0f071d] pb-28 text-white">
        {/* Sticky header */}
        <header
          className="sticky top-0 z-30 bg-[#0f071d]/95 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => router.history.back()}
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1
              className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-lg font-bold uppercase tracking-[0.28em] text-transparent"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              ✦ Royal Shop ✦
            </h1>
            <Link
              to="/wallet"
              aria-label="Wallet"
              className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
            >
              <Crown className="h-5 w-5" />
            </Link>
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-3 px-4 pb-3">
            <div className="flex flex-1 items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-2">
              <div className="flex items-center gap-2 pl-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
                  <Coins className="h-3 w-3 text-amber-950" />
                </span>
                <span className="text-xs font-semibold text-amber-200">
                  {(profile?.coins ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="ml-3 flex items-center gap-2 border-l border-white/10 pl-3 pr-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 shadow-lg shadow-purple-500/20">
                  <Gem className="h-3 w-3 text-white" />
                </span>
                <span className="text-xs font-semibold text-purple-200">
                  {(profile?.diamonds ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
            <Link
              to="/recharge"
              className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-orange-500/20 transition active:scale-95"
            >
              TOP UP
            </Link>
          </div>

          {/* Custom bg CTA */}
          <div className="px-4 pb-3">
            <Link
              to="/custom-theme"
              className="flex items-center justify-between rounded-full border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/15 via-purple-500/10 to-transparent px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Sparkles className="h-3 w-3 text-fuchsia-300" /> Upload your own background
              </span>
              <span className="text-[10px] text-fuchsia-200/80">24h · admin approval</span>
            </Link>
          </div>
        </header>

        {/* Horizontal categories */}
        <div className="no-scrollbar flex items-center gap-5 overflow-x-auto px-4 py-4">
          {cats.map((c) => {
            const active = c.id === currentCat;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  setSelectedId(null);
                }}
                className="flex shrink-0 flex-col items-center gap-2"
              >
                <div
                  className={`grid h-14 w-14 place-items-center overflow-hidden rounded-2xl transition ${
                    active
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30"
                      : "bg-white/10 opacity-60"
                  }`}
                >
                  {c.icon_url ? (
                    <img src={c.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Sparkles
                      className={`h-6 w-6 ${active ? "text-amber-950" : "text-white"}`}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-tighter ${
                    active ? "text-amber-400" : "text-white/70"
                  }`}
                >
                  {c.name}
                </span>
              </button>
            );
          })}

          {/* Dedicated shops (their own catalogs, not `themes` rows) */}
          <Link to="/shop-entrances" className="flex shrink-0 flex-col items-center gap-2">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 opacity-80 ring-1 ring-amber-400/30">
              <Sparkles className="h-6 w-6 text-amber-300" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-white/70">Entrance</span>
          </Link>
        </div>


        {/* Featured hero */}
        {featured && (
          <div className="px-4">
            <button
              onClick={() => setSelectedId(featured.id)}
              className="relative block h-44 w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#2a1254] to-[#16082e] text-left"
            >
              {(featured.animation_url || featured.bg_image || featured.preview_url) && (
                <img
                  src={
                    featured.bg_image ||
                    featured.preview_url ||
                    featured.animation_url ||
                    ""
                  }
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-overlay"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f071d] via-transparent to-transparent" />
              <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 backdrop-blur-md">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Featured
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h2 className="text-2xl font-bold text-white">{featured.name}</h2>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    {currencyFor(featured) === "diamonds" ? (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-500">
                        <Gem className="h-2.5 w-2.5 text-white" />
                      </span>
                    ) : (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600">
                        <Coins className="h-2.5 w-2.5 text-amber-950" />
                      </span>
                    )}
                    <span className="text-sm font-bold text-white">
                      {priceFor(featured).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-widest text-white/40">
                    {featured.duration_days && featured.duration_days > 0
                      ? `${featured.duration_days} Days`
                      : "Permanent"}
                  </span>
                </div>
              </div>
              <span className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-xl">
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </span>
            </button>
          </div>
        )}

        {/* Entrance + Profile Cards live in the category strip above — no duplicate cards here. */}



        {/* Grid header */}

        <div className="mb-4 mt-8 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">
              {activeCatObj?.name ?? "All Items"}
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter text-white/30">
            {items.length} Items Available
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 px-4 pb-24">
          {items.map((it) => {
            const owned = isOwned(it.id);
            const isEquipped = isItemEquipped(it);
            const locked = isLocked(it) && !owned;
            const badge =
              it.duration_days && it.duration_days > 0 ? `${it.duration_days}d` : "Perm";
            const cat = cats.find((c) => c.id === it.category_id);
            const catKey = `${cat?.slug ?? ""} ${cat?.name ?? ""}`.toLowerCase();
            const isBackground =
              !!it.bg_image || /theme|background|wallpaper|bg|skin/.test(catKey);
            const media = it.animation_url || it.bg_image || it.preview_url;
            const isVideo = !!media && /\.(mp4|webm|mov)($|\?)/i.test(media);
            const gridImage = isVideo ? it.bg_image || it.preview_url : media;

            return (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className="group relative text-left"
              >
                <div
                  className={`relative aspect-[3/4] overflow-hidden rounded-[32px] border bg-[#1a0b2e] ${
                    isEquipped
                      ? "border-emerald-400/60"
                      : it.is_premium || owned
                      ? "border-amber-500/40"
                      : "border-white/5"
                  }`}
                  style={
                    !media
                      ? {
                          background: `linear-gradient(160deg, ${it.primary_color}, ${it.accent_color})`,
                        }
                      : undefined
                  }
                >
                  {media ? (
                    isVideo ? (
                      // Nothing auto-plays in the browse grid: show the poster
                      // (or the paused first frame). Video plays in the detail popup.
                      <video
                        src={`${media}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        poster={gridImage || undefined}
                        className="absolute inset-0 h-full w-full object-cover"
                      />

                    ) : (
                      <img
                        src={media}
                        alt={it.name}
                        loading="lazy"
                        decoding="async"
                        className={`absolute inset-0 h-full w-full ${
                          isBackground ? "object-cover" : "object-contain p-4"
                        }`}
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <ItemAnimation
                        slug={cat?.slug}
                        name={it.name}
                        primary={it.primary_color}
                        accent={it.accent_color}
                        fill
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f071d] via-transparent to-transparent" />

                  <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
                    <span className="rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-md">
                      {badge}
                    </span>
                    {it.is_premium && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5">
                        <Crown className="h-2 w-2 text-black" />
                        <span className="text-[9px] font-black text-black">VIP</span>
                      </span>
                    )}
                  </div>

                  <div className="absolute right-3 top-3 z-10">
                    {isEquipped ? (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1 shadow-lg shadow-emerald-500/30">
                        <Check className="h-3 w-3 text-black" />
                        <span className="text-[9px] font-black text-black">ON</span>
                      </span>
                    ) : owned ? (
                      <span className="rounded-lg bg-amber-500 px-2 py-1 shadow-lg shadow-amber-500/20">
                        <span className="text-[9px] font-black text-black">OWNED</span>
                      </span>
                    ) : locked ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 backdrop-blur-md">
                        <Lock className="h-3 w-3 text-white/70" />
                      </span>
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/50 backdrop-blur-md">
                        <Play className="h-3 w-3 fill-white text-white" />
                      </span>
                    )}
                  </div>

                  {locked && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/85 to-transparent pb-3 pt-8">
                      <span className="rounded-full border border-amber-300/40 bg-black/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200">
                        Lv {it.min_level}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 px-1">
                  <p className="truncate text-xs font-bold text-white">{it.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {currencyFor(it) === "diamonds" ? (
                      <span className="h-3 w-3 rounded-full bg-purple-500" />
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-amber-400" />
                    )}
                    <span
                      className={`text-[11px] font-bold ${
                        currencyFor(it) === "diamonds" ? "text-purple-200" : "text-amber-200"
                      }`}
                    >
                      {it.is_free ? "Free" : priceFor(it).toLocaleString()}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {items.length === 0 && (
            <p className="col-span-2 py-10 text-center text-xs text-white/60">
              No items in this category yet.
            </p>
          )}
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
                  // The popup is the only place media plays.
                  <video
                    src={media}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster={modalImage || undefined}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
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
                <div className="rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Price</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                      {it.duration_days && it.duration_days > 0 ? `${it.duration_days} days` : "Permanent"}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-base font-black text-white">
                    {hasCoinPrice(it) && (
                      <span className="flex items-center gap-1.5">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600">
                          <Coins className="h-3.5 w-3.5 text-amber-950" />
                        </span>
                        {it.price.toLocaleString()}
                      </span>
                    )}
                    {hasCoinPrice(it) && hasDiamondPrice(it) && (
                      <span className="text-xs font-bold text-white/40">or</span>
                    )}
                    {hasDiamondPrice(it) && (
                      <span className="flex items-center gap-1.5">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-500">
                          <Gem className="h-3.5 w-3.5 text-white" />
                        </span>
                        {it.price_diamonds.toLocaleString()}
                      </span>
                    )}
                    {it.is_free && <span className="text-emerald-300">Free</span>}
                  </div>
                </div>

                {isLocked(it) && !owned ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-fuchsia-500/15 p-3 ring-1 ring-amber-300/40">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_18px_rgba(212,175,55,0.5)]">
                      <Lock className="h-5 w-5 text-amber-950" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-white">Locked · Reach Level {it.min_level}</p>
                      <p className="text-[11px] text-white/60">
                        You're Lv {userLevel}. Send gifts to level up and auto-unlock this frame.
                      </p>
                    </div>
                  </div>
                ) : owned ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toast.info("Choose a friend to send this to (coming soon)")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/8 py-3 text-sm font-black text-white ring-1 ring-white/15"
                    >
                      <Gift className="h-4 w-4" /> Send
                    </button>
                    {isEquipped ? (
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
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {hasCoinPrice(it) && (
                        <button
                          disabled={buy.isPending || !canAffordCurrency(it, "coins")}
                          onClick={() => buy.mutate({ item: it, currency: "coins" })}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 py-3 text-sm font-black text-amber-950 shadow-[0_6px_20px_rgba(212,175,55,0.4)] disabled:opacity-40"
                        >
                          {buy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                              <Coins className="h-4 w-4" />
                              {canAffordCurrency(it, "coins") ? it.price.toLocaleString() : "Low coins"}
                            </>
                          )}
                        </button>
                      )}
                      {hasDiamondPrice(it) && (
                        <button
                          disabled={buy.isPending || !canAffordCurrency(it, "diamonds")}
                          onClick={() => buy.mutate({ item: it, currency: "diamonds" })}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-fuchsia-600 py-3 text-sm font-black text-white shadow-[0_6px_20px_rgba(217,70,239,0.4)] disabled:opacity-40"
                        >
                          {buy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                              <Gem className="h-4 w-4" />
                              {canAffordCurrency(it, "diamonds") ? it.price_diamonds.toLocaleString() : "Low 💎"}
                            </>
                          )}
                        </button>
                      )}
                      {!hasCoinPrice(it) && !hasDiamondPrice(it) && (
                        <button
                          onClick={() => buy.mutate({ item: it, currency: "coins" })}
                          className="col-span-2 rounded-full bg-emerald-500 py-3 text-sm font-black text-emerald-950"
                        >
                          Claim Free
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => toast.info("Choose a friend to send this to (coming soon)")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white/8 py-2.5 text-xs font-black text-white ring-1 ring-white/15"
                    >
                      <Gift className="h-3.5 w-3.5" /> Send as gift
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav />
    </>
  );
}
