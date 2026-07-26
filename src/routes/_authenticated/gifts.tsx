import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveGiftImageUrl } from "@/lib/giftMedia";
import { Search, Coins, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gifts")({
  component: GiftCatalogPage,
  head: () => ({
    meta: [
      { title: "Gift Catalog · Jalwa" },
      { name: "description", content: "Browse every Jalwa gift by tier — small, premium, and VIP." },
      { property: "og:title", content: "Jalwa Gift Catalog" },
      { property: "og:description", content: "Browse every Jalwa gift by tier — small, premium, and VIP." },
    ],
  }),
});

type Gift = {
  id: string;
  name: string;
  emoji: string | null;
  icon: string | null;
  icon_path: string | null;
  image_url: string | null;
  price: number;
  category: string | null;
  animation: string | null;
  clip_path: string | null;
  clip_type: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type Tier = "small" | "premium" | "vip";
const TIER_META: Record<Tier, { label: string; sub: string; from: string; to: string; ring: string }> = {
  vip: { label: "VIP", sub: "≥ 2,000 coins", from: "#ffcf6a", to: "#7a3f00", ring: "border-[#ffcf6a]/50" },
  premium: { label: "Premium", sub: "81 – 1,999 coins", from: "#f472b6", to: "#7c3aed", ring: "border-fuchsia-400/40" },
  small: { label: "Small", sub: "≤ 80 coins", from: "#38bdf8", to: "#4338ca", ring: "border-sky-400/40" },
};

function tierOf(price: number): Tier {
  if (price >= 2000) return "vip";
  if (price >= 81) return "premium";
  return "small";
}

function thumbFor(g: Gift): string | null {
  const raw = g.image_url || g.icon_path || (g.clip_type === "svg" ? g.clip_path : null) || g.icon;
  return resolveGiftImageUrl(raw) ?? null;
}

function GiftCatalogPage() {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [selected, setSelected] = useState<Gift | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["gift-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select(
          "id,name,emoji,icon,icon_path,image_url,price,category,animation,clip_path,clip_type,sort_order,is_active"
        )
        .eq("is_active", true)
        .order("price", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Gift[];
    },
  });

  const grouped = useMemo(() => {
    const groups: Record<Tier, Gift[]> = { vip: [], premium: [], small: [] };
    const needle = q.trim().toLowerCase();
    for (const g of data ?? []) {
      if (needle && !g.name.toLowerCase().includes(needle)) continue;
      const t = tierOf(g.price ?? 0);
      if (tier !== "all" && tier !== t) continue;
      groups[t].push(g);
    }
    return groups;
  }, [data, q, tier]);

  const totalCount = (grouped.vip.length + grouped.premium.length + grouped.small.length) || 0;

  return (
    <>
      <AppShell title="Gift Catalog" subtitle={`${totalCount} gifts`}>
        <div className="mx-auto max-w-md px-4 pt-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search gifts…"
              className="w-full rounded-2xl border border-border bg-card/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Tier tabs */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(["all", "vip", "premium", "small"] as const).map((t) => {
              const active = tier === t;
              const label = t === "all" ? "All" : TIER_META[t].label;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(236,72,153,0.4)]"
                      : "border border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isLoading && (
            <div className="mt-10 grid place-items-center text-xs text-muted-foreground">Loading catalog…</div>
          )}

          {!isLoading &&
            (["vip", "premium", "small"] as Tier[]).map((t) => {
              const items = grouped[t];
              if (!items.length) return null;
              const meta = TIER_META[t];
              return (
                <section key={t} className="mt-6">
                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <h2
                        className="text-lg font-black tracking-wide"
                        style={{
                          background: `linear-gradient(90deg,${meta.from},${meta.to})`,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        {meta.label}
                      </h2>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                        {meta.sub}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{items.length} items</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {items.map((g) => (
                      <GiftTile key={g.id} gift={g} tier={t} onOpen={() => setSelected(g)} />
                    ))}
                  </div>
                </section>
              );
            })}

          {!isLoading && totalCount === 0 && (
            <div className="mt-16 grid place-items-center text-sm text-muted-foreground">
              <Sparkles className="mb-2 h-6 w-6 opacity-40" />
              No gifts match “{q}”.
            </div>
          )}
        </div>
      </AppShell>
      <BottomNav />

      <GiftInfoDialog gift={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function GiftTile({ gift, tier, onOpen }: { gift: Gift; tier: Tier; onOpen: () => void }) {
  const meta = TIER_META[tier];
  const src = thumbFor(gift);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative aspect-square overflow-hidden rounded-2xl border ${meta.ring} bg-card/30 p-2 text-left transition active:scale-95`}
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${meta.from}22, transparent 70%), rgba(20,10,25,0.4)`,
      }}
    >
      <div className="grid h-[70%] w-full place-items-center">
        {src ? (
          <img
            src={src}
            alt={gift.name}
            loading="lazy"
            className="max-h-full max-w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            style={{ mixBlendMode: "screen" as const }}
          />
        ) : (
          <span className="text-3xl">{gift.emoji ?? "🎁"}</span>
        )}
      </div>
      <div className="mt-1">
        <p className="truncate text-[10px] font-bold text-foreground/90">{gift.name}</p>
        <div className="flex items-center gap-1 text-[10px] font-black text-[#ffcf6a]">
          <Coins className="h-3 w-3" />
          {(gift.price ?? 0).toLocaleString()}
        </div>
      </div>
    </button>
  );
}

function GiftInfoDialog({ gift, onClose }: { gift: Gift | null; onClose: () => void }) {
  const open = Boolean(gift);
  const src = gift ? thumbFor(gift) : null;
  const t = gift ? tierOf(gift.price ?? 0) : "small";
  const meta = TIER_META[t];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm border-border bg-card">
        {gift && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-black">{gift.name}</DialogTitle>
            </DialogHeader>
            <div
              className="mx-auto grid aspect-square w-full max-w-[220px] place-items-center overflow-hidden rounded-3xl"
              style={{
                background: `radial-gradient(120% 90% at 50% 0%, ${meta.from}44, transparent 70%), rgba(15,8,20,0.6)`,
              }}
            >
              {src ? (
                <img
                  src={src}
                  alt={gift.name}
                  className="max-h-[85%] max-w-[85%] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
                  style={{ mixBlendMode: "screen" as const }}
                />
              ) : (
                <span className="text-6xl">{gift.emoji ?? "🎁"}</span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              <InfoStat label="Tier" value={meta.label} accent={meta.from} />
              <InfoStat
                label="Price"
                value={`${(gift.price ?? 0).toLocaleString()} 🪙`}
                accent="#ffcf6a"
              />
              <InfoStat label="Category" value={gift.category ?? "—"} accent="#a78bfa" />
              <InfoStat label="Animation" value={gift.animation ?? "pop"} accent="#38bdf8" />
            </div>

            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Tap a gift inside a room to send it
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-2 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
