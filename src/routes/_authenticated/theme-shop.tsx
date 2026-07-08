import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Check, Coins, Loader2, Sparkles, ChevronLeft, Gift, ChevronRight } from "lucide-react";
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
      return {
        cats: (cats.data ?? []) as Category[],
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

  const selected = useMemo(
    () => (selectedId ? (data?.items ?? []).find((i) => i.id === selectedId) ?? null : null),
    [selectedId, data?.items],
  );

  const buy = useMutation({
    mutationFn: async (item: ShopItem) => {
      const { error } = await supabase.rpc("purchase_shop_item", { _theme_id: item.id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Purchased 🪙");
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const equip = useMutation({
    mutationFn: async (item: ShopItem) => {
      const { error } = await supabase.rpc("equip_theme", { _theme_id: item.id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Equipped");
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwned = (id: string) => {
    const r = data?.owned.get(id);
    return !!r && (!r.expires_at || new Date(r.expires_at) > new Date());
  };

  const selCost = selected ? (selected.is_free ? 0 : selected.price) : 0;
  const canAfford = (profile?.coins ?? 0) >= selCost;

  return (
    <>
      <div className="mx-auto min-h-[100dvh] max-w-md shop-royal pb-28">
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b border-[color:var(--gold)]/25 bg-gradient-to-b from-[#3d2408]/95 to-[#1a0e02]/90 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <button
              onClick={() => router.history.back()}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-black tracking-wide text-[color:var(--gold)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              Shop
            </h1>
            <Link
              to="/me"
              className="rounded-full bg-gradient-to-r from-[#7a4a08] to-[#3a1f04] px-3 py-1.5 text-[11px] font-bold text-[color:var(--gold)] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.55)]"
            >
              Mine
            </Link>
          </div>

          {/* Promo banner */}
          <div className="px-3 pb-2">
            <div className="relative overflow-hidden rounded-full border border-[color:var(--gold)]/40 bg-gradient-to-r from-[#4a1a5c] via-[#5b1e6f] to-[#3a0f4a] px-3 py-1.5 pr-16">
              <div className="flex items-center gap-2 text-[11px] font-bold text-white">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-red-500">
                  <Gift className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="truncate">
                  Win <span className="text-[color:var(--gold)]">10,000</span> by sending a gift
                </span>
              </div>
              <div className="absolute -right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 px-2 py-0.5 text-xs font-black text-red-900 shadow-[0_0_12px_rgba(255,190,60,0.6)]">
                x250
                <span className="text-[8px] font-bold text-red-800/80">Times</span>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="mx-auto flex max-w-md">
          {/* Sidebar categories */}
          <aside className="w-[78px] shrink-0 space-y-1.5 bg-black/50 px-1.5 py-2">
            {cats.map((c) => {
              const active = c.id === currentCat;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    setSelectedId(null);
                  }}
                  className={`relative flex w-full flex-col items-center gap-1 rounded-xl py-2 transition ${
                    active
                      ? "bg-gradient-to-b from-[color:var(--gold)]/35 via-[color:var(--gold)]/10 to-transparent shadow-[inset_0_0_0_1px_rgba(212,175,55,0.6)]"
                      : "hover:bg-white/5"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r bg-[color:var(--gold)]" />
                  )}
                  <div className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full ${active ? "ring-2 ring-[color:var(--gold)]" : "ring-1 ring-white/10"}`}>
                    {c.icon_url ? (
                      <img src={c.icon_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#5b3808] to-[#1a0e02]">
                        <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold ${active ? "text-[color:var(--gold)]" : "text-white/60"}`}>
                    {c.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Items grid */}
          <main className="min-w-0 flex-1 px-2 py-2">
            <div className="grid grid-cols-2 gap-2">
              {items.map((it) => {
                const owned = isOwned(it.id);
                const isEquipped = profile?.theme_id === it.id;
                const isSelected = selectedId === it.id;
                const badge = it.duration_days && it.duration_days > 0 ? `${it.duration_days} day` : "Perm";
                const cat = cats.find((c) => c.id === it.category_id);
                const isBackground = cat?.slug === "theme";
                const media = it.animation_url || it.preview_url || it.bg_image;
                const isVideo = !!media && /\.mp4($|\?)/i.test(media);

                return (
                  <button
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`group relative overflow-hidden rounded-xl text-left transition ${
                      isSelected
                        ? "shop-card-selected"
                        : "shop-card-idle"
                    }`}
                  >
                    {/* Radial gold shine base */}
                    <div className="pointer-events-none absolute inset-0 shop-card-shine" />

                    {/* Top-left "7 day" tag */}
                    <span className="absolute left-1.5 top-1.5 z-20 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white/95 backdrop-blur-sm">
                      {badge}
                    </span>
                    {/* Play btn */}
                    <span className="absolute right-1.5 top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white">
                      <Play className="h-2.5 w-2.5 fill-current" />
                    </span>

                    {/* Media area */}
                    <div className="relative z-10 grid aspect-square place-items-center px-4 py-3">
                      {isBackground ? (
                        <div
                          className="relative h-full w-full overflow-hidden rounded-lg"
                          style={{
                            background: `linear-gradient(135deg, ${it.primary_color}, ${it.accent_color})`,
                          }}
                        >
                          {media ? (
                            isVideo ? (
                              <video src={media} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                            ) : (
                              <img src={media} alt={it.name} className="h-full w-full object-cover" />
                            )
                          ) : null}
                        </div>
                      ) : media ? (
                        isVideo ? (
                          <video
                            src={media}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                          />
                        ) : (
                          <img
                            src={media}
                            alt={it.name}
                            className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                          />
                        )
                      ) : (
                        // Reference-style colored pill/chip preview
                        <div
                          className="relative h-[55%] w-full overflow-hidden rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
                          style={{
                            background: `linear-gradient(135deg, ${it.primary_color}, ${it.accent_color})`,
                          }}
                        >
                          <div className="absolute inset-0 opacity-40 shop-chip-shimmer" />
                          <div className="absolute inset-0 grid place-items-center">
                            <ItemAnimation
                              slug={cat?.slug}
                              name={it.name}
                              primary={it.primary_color}
                              accent={it.accent_color}
                              fill
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Price footer */}
                    <div className="relative z-10 flex items-center justify-center gap-1 pb-2 pt-1 text-sm font-black text-white">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[10px] text-amber-900">
                        <Coins className="h-2.5 w-2.5" />
                      </span>
                      {(it.is_free ? 0 : it.price).toLocaleString()}
                    </div>

                    {isEquipped && (
                      <span className="absolute right-1.5 top-8 z-20 flex items-center gap-0.5 rounded-full bg-[color:var(--gold)] px-1.5 py-0.5 text-[9px] font-bold text-black">
                        <Check className="h-2 w-2" /> Wearing
                      </span>
                    )}
                    {owned && !isEquipped && (
                      <span className="absolute right-1.5 top-8 z-20 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-black">
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

        {/* Bottom action bar */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--gold)]/35 bg-gradient-to-b from-[#3d2408]/95 to-[#1a0e02]/98 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2.5">
            <Link
              to="/wallet"
              className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-sm font-black text-[color:var(--gold)] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.4)]"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600">
                <Coins className="h-3 w-3 text-amber-900" />
              </span>
              {(profile?.coins ?? 0).toLocaleString()}
              <ChevronRight className="h-3 w-3 opacity-70" />
            </Link>

            <button
              disabled={!selected}
              onClick={() => selected && toast.info("Choose a friend to send this to (coming soon)")}
              className="flex-1 rounded-full bg-gradient-to-b from-[#fff3b8] via-[#f5cf5a] to-[#c98a1a] py-2.5 text-sm font-black text-[#3a1e00] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_10px_rgba(0,0,0,0.35)] disabled:opacity-40"
            >
              Send
            </button>

            {selected && isOwned(selected.id) ? (
              profile?.theme_id === selected.id ? (
                <div className="flex-1 rounded-full bg-emerald-500/25 py-2.5 text-center text-sm font-black text-emerald-300">
                  Wearing
                </div>
              ) : (
                <button
                  onClick={() => equip.mutate(selected)}
                  disabled={equip.isPending}
                  className="flex-1 rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700 py-2.5 text-sm font-black text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_10px_rgba(0,0,0,0.35)]"
                >
                  {equip.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Wear"}
                </button>
              )
            ) : (
              <button
                disabled={!selected || buy.isPending || !canAfford}
                onClick={() => selected && buy.mutate(selected)}
                className="flex-1 rounded-full bg-gradient-to-b from-[#b6ff9a] via-[#4fd160] to-[#0f6c2a] py-2.5 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_10px_rgba(0,0,0,0.35)] disabled:opacity-40"
              >
                {buy.isPending ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : selected ? (
                  canAfford ? `Purchase` : "Low coins"
                ) : (
                  "Purchase"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
