import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Check, Coins, Loader2, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
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
    onError: (e: Error) => toast.error(`Purchase failed: ${e.message}`),
  });

  const equip = useMutation({
    mutationFn: async (item: ShopItem) => {
      const cat = (data?.cats ?? []).find((c) => c.id === item.category_id);
      const slug = (cat?.slug ?? "").toLowerCase();
      const name = (cat?.name ?? "").toLowerCase();
      const isTheme = slug === "theme" || slug === "themes" || name === "theme" || name === "themes";
      const isFrame = slug === "frame" || slug === "frames" || name === "frame" || name === "frames";

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

      if (isFrame) {
        const frameUrl = item.animation_url || item.preview_url || item.bg_image;
        const { error } = await supabase
          .from("profiles")
          .update({ frame: frameUrl })
          .eq("id", user!.id);
        if (error) throw error;
        return;
      }

      // Other categories (car, ring, bubble, entrance, special id, data card…)
      // — user will define where these render; do not touch theme_id here.
      toast.info("Applied. Placement for this category is coming soon.");
    },
    onSuccess: async () => {
      toast.success("Applied ✨");
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
    onError: (e: Error) => toast.error(`Apply failed: ${e.message}`),
  });

  const isOwned = (id: string) => {
    const r = data?.owned.get(id);
    return !!r && (!r.expires_at || new Date(r.expires_at) > new Date());
  };

  const selCost = selected ? (selected.is_free ? 0 : selected.price) : 0;
  const canAfford = (profile?.coins ?? 0) >= selCost;

  return (
    <>
      <div className="mx-auto min-h-[100dvh] max-w-md pb-28">
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b border-border bg-background/95"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <button
              onClick={() => router.history.back()}
              className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-black tracking-wide text-foreground">
              Shop
            </h1>
            <span className="h-9 w-9" aria-hidden />
          </div>
        </header>

        {/* Body */}
        <div className="flex">
          {/* Sidebar categories */}
          <aside className="w-[78px] shrink-0 space-y-1.5 bg-card/60 px-1.5 py-2">
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
                      ? "bg-gradient-to-b from-primary/25 via-primary/10 to-transparent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                  )}
                  <div className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full ${active ? "ring-2 ring-primary" : "ring-1 ring-border"}`}>
                    {c.icon_url ? (
                      <img src={c.icon_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/40 to-secondary/40">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
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
                const frameUrl = it.animation_url || it.preview_url || it.bg_image;
                const isEquipped =
                  profile?.theme_id === it.id ||
                  (!!profile?.frame && !!frameUrl && profile.frame === frameUrl);
                const isSelected = selectedId === it.id;
                const badge = it.duration_days && it.duration_days > 0 ? `${it.duration_days} day` : "Perm";
                const cat = cats.find((c) => c.id === it.category_id);
                const catKey = `${cat?.slug ?? ""} ${cat?.name ?? ""}`.toLowerCase();
                // Full portrait 3D preview for themes / backgrounds / wallpapers, or any item that ships a bg image
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
                    className={`group relative overflow-hidden rounded-xl text-left transition ${
                      isSelected
                        ? "shop-card-selected"
                        : "shop-card-idle"
                    }`}
                  >
                    {/* Radial gold shine base */}
                    <div className="pointer-events-none absolute inset-0 shop-card-shine" />

                    {/* Top-left "7 day" tag */}
                    <span className="absolute left-1.5 top-1.5 z-20 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white/95">
                      {badge}
                    </span>
                    {/* Play btn */}
                    <span className="absolute right-1.5 top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white">
                      <Play className="h-2.5 w-2.5 fill-current" />
                    </span>

                    {/* Media area */}
                    <div
                      className={`relative z-10 grid place-items-center px-3 py-3 ${isBackground ? "aspect-[3/4]" : "aspect-square"}`}
                      style={{ perspective: "600px", perspectiveOrigin: "50% 50%" }}
                    >
                      {isBackground ? (
                        <div
                          className={`shop-theme-3d relative h-full w-full overflow-hidden rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.6)] ${isSelected ? "shop-theme-3d-active" : ""}`}
                          style={{
                            background: `linear-gradient(160deg, ${it.primary_color}, ${it.accent_color})`,
                          }}
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
                          {/* profile preview overlay so it reads as a real theme */}
                          <div className="absolute inset-x-0 top-2 flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full border-2 border-white/80 bg-gradient-to-br from-pink-400 to-fuchsia-600" />
                            <div className="mt-0.5 text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                              {it.name}
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="pointer-events-none absolute inset-0 shop-theme-shine" />
                        </div>
                      ) : media ? (
                        isVideo ? (
                          gridImage ? (
                            <img
                              src={gridImage}
                              alt={it.name}
                              loading="lazy"
                              decoding="async"
                              className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                            />
                          ) : (
                            <video
                              src={media}
                              muted
                              playsInline
                              preload="metadata"
                              className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                            />
                          )
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

        {/* Wallet chip (persistent bottom) */}
        <div
          className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-between gap-2 border-t border-border bg-background/95 px-3 py-2.5"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Link
            to="/wallet"
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-sm font-black text-foreground"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary">
              <Coins className="h-3 w-3 text-primary-foreground" />
            </span>
            {(profile?.coins ?? 0).toLocaleString()}
            <ChevronRight className="h-3 w-3 opacity-70" />
          </Link>
          <p className="text-[11px] text-muted-foreground">Tap an item to preview</p>
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
        const isEquipped = profile?.theme_id === it.id;
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center"
            onClick={() => setSelectedId(null)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <button
                onClick={() => setSelectedId(null)}
                className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white"
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
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-3 px-4 text-center">
                  <h3 className="text-lg font-black text-white drop-shadow">{it.name}</h3>
                  {cat && <p className="text-xs text-white/70">{cat.name}</p>}
                </div>
              </div>

              {/* Meta + actions */}
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-base font-black text-foreground">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary">
                      <Coins className="h-3 w-3 text-primary-foreground" />
                    </span>
                    {(it.is_free ? 0 : it.price).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {it.duration_days && it.duration_days > 0 ? `${it.duration_days} days` : "Permanent"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toast.info("Choose a friend to send this to (coming soon)")}
                    className="flex-1 rounded-full bg-secondary py-3 text-sm font-black text-secondary-foreground"
                  >
                    Send
                  </button>

                  {owned ? (
                    isEquipped ? (
                      <div className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-500/20 py-3 text-sm font-black text-emerald-400">
                        <Check className="h-4 w-4" /> Wearing
                      </div>
                    ) : (
                      <button
                        onClick={() => equip.mutate(it)}
                        disabled={equip.isPending}
                        className="flex-1 rounded-full bg-emerald-500 py-3 text-sm font-black text-emerald-950 disabled:opacity-40"
                      >
                        {equip.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Apply"}
                      </button>
                    )
                  ) : (
                    <button
                      disabled={buy.isPending || !canAfford}
                      onClick={() => buy.mutate(it)}
                      className="flex-1 rounded-full bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-40"
                    >
                      {buy.isPending ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : canAfford ? (
                        "Buy"
                      ) : (
                        "Low coins"
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
