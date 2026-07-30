import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Check, Loader2, Play, Crown, X, Clock, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import type { EntranceEffect } from "@/lib/entrance/registry";

export const Route = createFileRoute("/_authenticated/shop-entrances")({ component: Page });

/** Rarity is derived from price so it stays in sync with admin pricing. */
function rarityOf(price: number) {
  if (price >= 40000) return { label: "Mythic", cls: "from-[#ff2ea8] to-[#7b5cff]", ring: "ring-[#ff2ea8]/50" };
  if (price >= 25000) return { label: "Legendary", cls: "from-[#ffd166] to-[#ff8a00]", ring: "ring-[color:var(--gold)]/50" };
  if (price >= 15000) return { label: "Epic", cls: "from-[#a855f7] to-[#6366f1]", ring: "ring-violet-400/50" };
  if (price >= 8000) return { label: "Rare", cls: "from-[#38bdf8] to-[#0ea5e9]", ring: "ring-sky-400/50" };
  return { label: "Classic", cls: "from-zinc-400 to-zinc-600", ring: "ring-white/20" };
}

/** Green/luma keying so green-screen sourced entrance media never shows its background. */
function keyFilter(chromakey?: string | null, isVideo = false) {
  if (chromakey === "green" || chromakey === "luma" || (isVideo && chromakey && chromakey !== "none")) {
    return "url(#shop-entrance-green-key)";
  }
  if (chromakey === "black") return "url(#shop-entrance-luma-key)";
  return undefined;
}

function ChromaFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="shop-entrance-green-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0 0.08" />
          <feComponentTransfer><feFuncA type="linear" slope="3.8" intercept="-0.08" /></feComponentTransfer>
        </filter>
        <filter id="shop-entrance-luma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
          <feComponentTransfer><feFuncA type="linear" slope="5.2" intercept="-0.48" /></feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

function Media({ eff, className = "" }: { eff: EntranceEffect; className?: string }) {
  const t = eff.thumbnail_url;
  if (t) {
    return (
      <img
        src={t}
        alt={eff.name}
        loading="lazy"
        style={{ filter: keyFilter(eff.chromakey, false) }}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    );
  }
  if (eff.media_url.startsWith("builtin:")) return <BuiltinEntranceView mediaUrl={eff.media_url} />;
  return null;
}

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<EntranceEffect | null>(null);
  const [category, setCategory] = useState<string>("All");

  const effects = useQuery({
    queryKey: ["entrance-effects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entrance_effects")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EntranceEffect[];
    },
  });

  const owned = useQuery({
    queryKey: ["user-entrances", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_entrance_effects")
        .select("id, effect_id, is_equipped, expires_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ownedMap = useMemo(() => {
    const m = new Map<string, { equipped: boolean; expiresAt: string | null }>();
    (owned.data ?? []).forEach((r: any) => m.set(r.effect_id, { equipped: r.is_equipped, expiresAt: r.expires_at }));
    return m;
  }, [owned.data]);

  const cats = useMemo(() => {
    const set = new Set<string>();
    (effects.data ?? []).forEach((e) => set.add(e.category));
    return ["All", ...Array.from(set)];
  }, [effects.data]);

  const filtered = useMemo(() => {
    const all = effects.data ?? [];
    return category === "All" ? all : all.filter((e) => e.category === category);
  }, [effects.data, category]);

  const featured = (effects.data ?? []).slice().sort((a, b) => b.price_coins - a.price_coins)[0];

  const purchase = useMutation({
    mutationFn: async (effectId: string) => {
      const { data, error } = await supabase.rpc("purchase_entrance_effect", { _effect_id: effectId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Entrance unlocked!");
      qc.invalidateQueries({ queryKey: ["user-entrances"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Purchase failed"),
  });

  const equip = useMutation({
    mutationFn: async (effectId: string | null) => {
      const { error } = await supabase.rpc("equip_entrance_effect", { _effect_id: effectId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipped");
      qc.invalidateQueries({ queryKey: ["user-entrances"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Equip failed"),
  });

  const balance = (profile as any)?.coins ?? 0;
  const vipLevel = (profile as any)?.vip_level ?? 0;

  return (
    <div className="relative min-h-screen bg-background pb-28 [overflow-x:clip]">
      {/* Cinematic ambience */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(120%_80%_at_50%_0%,color-mix(in_oklab,var(--gold)_22%,transparent),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-24 h-[420px] bg-[radial-gradient(90%_70%_at_20%_20%,color-mix(in_oklab,var(--secondary)_25%,transparent),transparent_70%)]" />

      <header className="sticky top-0 z-30 border-b border-[color:var(--gold)]/20 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[480px] items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-[color:var(--gold)] via-amber-200 to-[color:var(--gold)] bg-clip-text text-lg font-black tracking-wide text-transparent">
              Entrance Effects
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Cinematic arrivals
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-1.5 text-xs font-bold text-[color:var(--gold)] shadow-[0_0_20px_-6px_var(--gold)]">
            <Coins className="h-3.5 w-3.5" />
            {balance.toLocaleString()}
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[480px] px-3 pt-3">
        {/* Featured hero */}
        {featured && (
          <button
            onClick={() => setPreview(featured)}
            className="group relative mb-4 block aspect-[16/9] w-full overflow-hidden rounded-3xl border border-[color:var(--gold)]/35 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
          >
            <Media eff={featured} className="transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)] backdrop-blur">
              <Sparkles className="h-3 w-3" /> Featured
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 text-left">
              <div>
                <div className="text-base font-black text-white drop-shadow">{featured.name}</div>
                <div className="text-[11px] font-semibold text-white/70">{featured.category}</div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                <Play className="h-3 w-3" /> Preview
              </span>
            </div>
          </button>
        )}

        <div className="scrollbar-hide -mx-3 flex gap-2 overflow-x-auto px-3 pb-3">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                category === c
                  ? "border-[color:var(--gold)]/60 bg-gradient-to-r from-[color:var(--gold)] to-amber-300 text-black shadow-[0_0_18px_-6px_var(--gold)]"
                  : "border-white/10 bg-white/5 text-muted-foreground backdrop-blur"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {effects.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((eff) => {
              const own = ownedMap.get(eff.id);
              const locked = eff.min_vip_level > 0 && vipLevel < eff.min_vip_level;
              const r = rarityOf(eff.price_coins);
              return (
                <div
                  key={eff.id}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] ring-1 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 ${r.ring}`}
                >
                  <button
                    onClick={() => setPreview(eff)}
                    className="relative block aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-black to-[#1a0b2e]"
                  >
                    <Media eff={eff} className="transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
                    {/* Gold shine sweep */}
                    <div className="pointer-events-none absolute -inset-y-4 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />

                    <div className={`absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r ${r.cls} px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow`}>
                      {r.label}
                    </div>
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 backdrop-blur transition group-hover:scale-110">
                      <Play className="h-3 w-3 text-white" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-2 text-left">
                      <div className="truncate text-[13px] font-black text-white drop-shadow">{eff.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wide text-white/60">
                        <span>{eff.category}</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {(eff.duration_ms / 1000).toFixed(1)}s
                        </span>
                      </div>
                    </div>

                    {locked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/65 backdrop-blur-[2px]">
                        <Lock className="h-4 w-4 text-[color:var(--gold)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)]">
                          VIP {eff.min_vip_level}
                        </span>
                      </div>
                    )}
                    {own?.equipped && (
                      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-primary/70 to-transparent py-1 text-center text-[9px] font-black uppercase tracking-widest text-white">
                        Equipped
                      </div>
                    )}
                  </button>

                  <div className="flex items-center justify-between gap-1 p-2">
                    <div className="flex items-center gap-1 text-[11px] font-black text-[color:var(--gold)]">
                      <Coins className="h-3 w-3" />
                      {eff.price_coins.toLocaleString()}
                    </div>
                    {own ? (
                      own.equipped ? (
                        <span className="rounded-full bg-primary/20 px-2 py-1 text-[10px] font-black text-primary">
                          <Check className="mr-0.5 inline h-2.5 w-2.5" /> Owned
                        </span>
                      ) : (
                        <button
                          onClick={() => equip.mutate(eff.id)}
                          disabled={equip.isPending}
                          className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground shadow-[0_0_16px_-6px_var(--primary)]"
                        >
                          Equip
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => purchase.mutate(eff.id)}
                        disabled={locked || purchase.isPending || balance < eff.price_coins}
                        className="rounded-full bg-gradient-to-r from-[color:var(--gold)] to-amber-300 px-2.5 py-1 text-[10px] font-black text-black shadow-[0_0_16px_-6px_var(--gold)] disabled:opacity-40"
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <button
            onClick={() => equip.mutate(null)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold text-muted-foreground backdrop-blur"
          >
            Unequip active entrance
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div
            className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-[color:var(--gold)]/35 bg-gradient-to-br from-black to-[#1a0b2e] shadow-[0_30px_80px_-30px_var(--gold)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden">
              {preview.media_url.startsWith("builtin:") ? (
                <BuiltinEntranceView mediaUrl={preview.media_url} />
              ) : preview.media_type === "mp4" || preview.media_type === "webm" ? (
                <video src={preview.media_url} autoPlay muted loop playsInline style={{ filter: keyFilter(preview.chromakey, true) }} className="h-full w-full object-cover" />
              ) : (
                <img src={preview.thumbnail_url ?? preview.media_url} alt={preview.name} style={{ filter: keyFilter(preview.chromakey, false) }} className="h-full w-full animate-[kenburns_9s_ease-in-out_infinite_alternate] object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/40" />
              <button className="absolute right-2 top-2 rounded-full bg-black/70 p-2" onClick={() => setPreview(null)}>
                <X className="h-4 w-4 text-white" />
              </button>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className={`mb-1.5 inline-block rounded-full bg-gradient-to-r ${rarityOf(preview.price_coins).cls} px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-black`}>
                  {rarityOf(preview.price_coins).label}
                </div>
                <div className="text-xl font-black text-white drop-shadow">{preview.name}</div>
                {preview.description && <div className="mt-1 text-xs text-white/70">{preview.description}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-white/70">
                  <span className="rounded-full bg-white/10 px-2 py-1">{preview.category}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1">{(preview.duration_ms / 1000).toFixed(1)}s</span>
                  {preview.min_vip_level > 0 && (
                    <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-1 text-[color:var(--gold)]">
                      <Crown className="mr-0.5 inline h-2.5 w-2.5" /> VIP {preview.min_vip_level}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/60 p-3">
              <div className="flex items-center gap-1.5 text-sm font-black text-[color:var(--gold)]">
                <Coins className="h-4 w-4" />
                {preview.price_coins.toLocaleString()}
              </div>
              {ownedMap.get(preview.id) ? (
                ownedMap.get(preview.id)!.equipped ? (
                  <span className="rounded-full bg-primary/20 px-4 py-2 text-xs font-black text-primary">Equipped</span>
                ) : (
                  <button
                    onClick={() => equip.mutate(preview.id)}
                    className="rounded-full bg-primary px-5 py-2 text-xs font-black text-primary-foreground"
                  >
                    Equip
                  </button>
                )
              ) : (
                <button
                  onClick={() => purchase.mutate(preview.id)}
                  disabled={
                    purchase.isPending ||
                    balance < preview.price_coins ||
                    (preview.min_vip_level > 0 && vipLevel < preview.min_vip_level)
                  }
                  className="rounded-full bg-gradient-to-r from-[color:var(--gold)] to-amber-300 px-5 py-2 text-xs font-black text-black disabled:opacity-40"
                >
                  Buy Now
                </button>
              )}
            </div>
          </div>
          <style>{`@keyframes kenburns{from{transform:scale(1)}to{transform:scale(1.12)}}`}</style>
        </div>
      )}

      <ChromaFilters />
      <BottomNav />
    </div>
  );
}
