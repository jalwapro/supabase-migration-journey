import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Check, Loader2, Play, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import type { EntranceEffect } from "@/lib/entrance/registry";

export const Route = createFileRoute("/_authenticated/shop-entrances")({ component: Page });

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
    (owned.data ?? []).forEach((r: any) =>
      m.set(r.effect_id, { equipped: r.is_equipped, expiresAt: r.expires_at }),
    );
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

  const balance = (profile as any)?.coin_balance ?? 0;
  const vipLevel = (profile as any)?.vip_level ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center justify-between">
          <h1 className="text-lg font-black tracking-wide">Entrance Effects</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--gold)]/15 px-3 py-1 text-xs font-bold text-[color:var(--gold)]">
            <Coins className="h-3.5 w-3.5" />
            {balance.toLocaleString()}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-3 pt-3">
        <div className="scrollbar-hide -mx-3 flex gap-2 overflow-x-auto px-3 pb-3">
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

        {effects.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((eff) => {
              const own = ownedMap.get(eff.id);
              const locked = eff.min_vip_level > 0 && vipLevel < eff.min_vip_level;
              return (
                <div key={eff.id} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
                  <button
                    onClick={() => setPreview(eff)}
                    className="relative block aspect-square w-full overflow-hidden bg-gradient-to-br from-black to-[#1a0b2e]"
                  >
                    {eff.thumbnail_url ? (
                      <img src={eff.thumbnail_url} alt={eff.name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : eff.media_url.startsWith("builtin:") ? (
                      <BuiltinEntranceView mediaUrl={eff.media_url} />
                    ) : null}
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 backdrop-blur">
                      <Play className="h-3 w-3 text-white" />
                    </div>
                    {locked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold uppercase text-[color:var(--gold)]">
                        <Crown className="mr-1 h-3 w-3" /> VIP {eff.min_vip_level}
                      </div>
                    )}
                  </button>
                  <div className="p-2">
                    <div className="truncate text-xs font-bold">{eff.name}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--gold)]">
                        <Coins className="h-3 w-3" />
                        {eff.price_coins.toLocaleString()}
                      </div>
                      {own ? (
                        own.equipped ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <Check className="mr-0.5 inline h-2.5 w-2.5" /> On
                          </span>
                        ) : (
                          <button
                            onClick={() => equip.mutate(eff.id)}
                            disabled={equip.isPending}
                            className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                          >
                            Equip
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => purchase.mutate(eff.id)}
                          disabled={locked || purchase.isPending || balance < eff.price_coins}
                          className="rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-[10px] font-black text-black disabled:opacity-40"
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
            Unequip active entrance
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4" onClick={() => setPreview(null)}>
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-black to-[#1a0b2e]" onClick={(e) => e.stopPropagation()}>
            {preview.media_url.startsWith("builtin:") ? (
              <BuiltinEntranceView mediaUrl={preview.media_url} />
            ) : preview.media_type === "mp4" || preview.media_type === "webm" ? (
              <video src={preview.media_url} autoPlay muted loop playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={preview.media_url} alt="" className="h-full w-full object-cover" />
            )}
            <button className="absolute right-2 top-2 rounded-full bg-black/70 p-2" onClick={() => setPreview(null)}>
              <X className="h-4 w-4 text-white" />
            </button>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              <div className="text-base font-black">{preview.name}</div>
              {preview.description && <div className="mt-1 text-xs text-muted-foreground">{preview.description}</div>}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
