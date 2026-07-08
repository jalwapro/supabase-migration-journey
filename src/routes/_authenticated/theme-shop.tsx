import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Check, Gem, Loader2, Sparkles } from "lucide-react";
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
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShopItem | null>(null);

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

  const buy = useMutation({
    mutationFn: async (item: ShopItem) => {
      const { error } = await supabase.rpc("purchase_shop_item", { _theme_id: item.id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Purchased 💎");
      await refresh();
      qc.invalidateQueries({ queryKey: ["shop"] });
      setSelected(null);
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

  return (
    <>
      <AppShell title="Shop">
        {/* Top diamond balance */}
        <div className="flex items-center justify-between border-b border-[color:var(--gold)]/20 bg-gradient-to-b from-[#3a1a05]/60 to-transparent px-4 py-2">
          <div className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--gold)]">
            <Gem className="h-4 w-4" /> {profile?.diamonds?.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--gold)]/80">
            Event-limited rewards
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-140px)]">
          {/* Sidebar categories */}
          <aside className="w-[86px] shrink-0 space-y-2 bg-black/40 px-2 py-3">
            {cats.map((c) => {
              const active = c.id === currentCat;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`flex w-full flex-col items-center gap-1 rounded-2xl border py-2 transition ${
                    active
                      ? "border-[color:var(--gold)] bg-gradient-to-b from-[color:var(--gold)]/30 to-[color:var(--gold)]/5 shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                      : "border-transparent bg-white/5"
                  }`}
                >
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[color:var(--gold)]/40 bg-black/60">
                    {c.icon_url ? (
                      <img src={c.icon_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
                    )}
                  </div>
                  <span className={`text-[10px] font-bold ${active ? "text-[color:var(--gold)]" : "text-white/70"}`}>
                    {c.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Items grid */}
          <main className="flex-1 px-2 py-3">
            <div className="grid grid-cols-2 gap-2">
              {items.map((it) => {
                const ownedRow = data?.owned.get(it.id);
                const isOwned = !!ownedRow && (!ownedRow.expires_at || new Date(ownedRow.expires_at) > new Date());
                const isEquipped = profile?.theme_id === it.id;
                const badge =
                  it.duration_days && it.duration_days > 0 ? `${it.duration_days} day` : "Permanent";
                const cat = cats.find((c) => c.id === it.category_id);
                const isBackground = cat?.slug === "theme";
                const media = it.animation_url || it.preview_url || it.bg_image;
                const isVideo = !!media && /\.mp4($|\?)/i.test(media);
                return (
                  <button
                    key={it.id}
                    onClick={() => setSelected(it)}
                    className={`group relative overflow-hidden rounded-2xl border-2 text-left transition ${
                      isEquipped
                        ? "border-[color:var(--gold)] shadow-[0_0_24px_rgba(212,175,55,0.5)]"
                        : "border-[color:var(--gold)]/30"
                    }`}
                    style={{
                      background: isBackground
                        ? `linear-gradient(135deg, ${it.primary_color}, ${it.accent_color})`
                        : "radial-gradient(ellipse at top, rgba(212,175,55,0.25), rgba(60,30,5,0.75) 55%, rgba(20,10,2,0.95) 100%)",
                    }}
                  >
                    {isBackground && media ? (
                      isVideo ? (
                        <video
                          src={media}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={media}
                          alt={it.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div
                        className="pointer-events-none absolute inset-0 opacity-40"
                        style={{
                          background:
                            "repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,215,120,0.18) 0deg 6deg, transparent 6deg 14deg)",
                        }}
                      />
                    )}
                    {isBackground && (
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                    )}
                    {/* Top-left tag */}
                    <span className="absolute left-2 top-2 z-10 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                      {badge}
                    </span>
                    {/* Play btn */}
                    <span className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white">
                      <Play className="h-3 w-3 fill-current" />
                    </span>

                    {isBackground ? (
                      <div className="relative z-[1] flex aspect-square flex-col justify-end p-3">
                        <div className="text-sm font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                          {it.name}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className="h-3 w-3 rounded-full border border-white/40"
                            style={{ background: it.primary_color }}
                          />
                          <span
                            className="h-3 w-3 rounded-full border border-white/40"
                            style={{ background: it.accent_color }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-[1] flex aspect-square items-center justify-center p-4">
                        {it.animation_url ? (
                          isVideo ? (
                            <video
                              src={it.animation_url}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="max-h-full max-w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
                            />
                          ) : (
                            <img
                              src={it.animation_url}
                              alt={it.name}
                              className="max-h-full max-w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
                            />
                          )
                        ) : it.preview_url || it.bg_image ? (
                          <img
                            src={it.preview_url ?? it.bg_image!}
                            alt={it.name}
                            className="max-h-full max-w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
                          />
                        ) : (
                          <div
                            className="h-24 w-24 rounded-full"
                            style={{
                              background: `linear-gradient(135deg, ${it.primary_color}, ${it.accent_color})`,
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Price bar */}
                    <div className="relative z-[1] flex items-center justify-center gap-1 border-t border-[color:var(--gold)]/30 bg-gradient-to-r from-[#5a3a06] to-[#3a2004] py-1.5 text-sm font-black text-white">
                      <Gem className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                      {it.price_diamonds.toLocaleString()}
                    </div>


                    {isEquipped && (
                      <span className="absolute bottom-11 right-2 z-10 flex items-center gap-1 rounded-full bg-[color:var(--gold)] px-1.5 py-0.5 text-[9px] font-bold text-black">
                        <Check className="h-2.5 w-2.5" /> Equipped
                      </span>
                    )}
                    {isOwned && !isEquipped && (
                      <span className="absolute bottom-11 right-2 z-10 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-black">
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
      </AppShell>

      {/* Detail sheet */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-[color:var(--gold)]/40 bg-gradient-to-b from-[#2a1605] to-[#0a0502] p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
          >
            <div className="mb-3 grid h-40 place-items-center rounded-2xl border border-[color:var(--gold)]/30 bg-black/40 p-4">
              {selected.animation_url ? (
                selected.animation_url.match(/\.mp4($|\?)/i) ? (
                  <video src={selected.animation_url} autoPlay loop muted playsInline className="max-h-full" />
                ) : (
                  <img src={selected.animation_url} alt={selected.name} className="max-h-full" />
                )
              ) : selected.preview_url ? (
                <img src={selected.preview_url} alt={selected.name} className="max-h-full" />
              ) : null}
            </div>
            <h3 className="text-center text-lg font-bold text-white">{selected.name}</h3>
            <p className="mb-3 text-center text-[11px] text-white/60">
              {selected.duration_days ? `${selected.duration_days} day access` : "Permanent"}
            </p>

            {(() => {
              const ownedRow = data?.owned.get(selected.id);
              const isOwned = !!ownedRow && (!ownedRow.expires_at || new Date(ownedRow.expires_at) > new Date());
              const isEquipped = profile?.theme_id === selected.id;
              if (isEquipped) {
                return (
                  <div className="rounded-full bg-[color:var(--gold)]/20 py-3 text-center text-sm font-bold text-[color:var(--gold)]">
                    ✓ Currently equipped
                  </div>
                );
              }
              if (isOwned) {
                return (
                  <button
                    onClick={() => equip.mutate(selected)}
                    disabled={equip.isPending}
                    className="w-full rounded-full bg-[color:var(--primary)] py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {equip.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Equip"}
                  </button>
                );
              }
              const canAfford = (profile?.diamonds ?? 0) >= selected.price_diamonds;
              return (
                <button
                  onClick={() => buy.mutate(selected)}
                  disabled={buy.isPending || !canAfford}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-amber-500 py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  {buy.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Gem className="h-4 w-4" /> {canAfford ? "Purchase" : "Not enough"} · {selected.price_diamonds.toLocaleString()}
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
