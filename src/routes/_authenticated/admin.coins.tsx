import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/coins")({
  component: CoinPackagesAdmin,
});

type Tier = "starter" | "popular" | "vip" | "whale";
type PkgRow = {
  id: string;
  coins: number;
  bonus_coins: number;
  price_pkr: number;
  label: string | null;
  badge: string | null;
  sort_order: number;
  active: boolean;
  tier: Tier;
};

const TIERS: Tier[] = ["starter", "popular", "vip", "whale"];

function CoinPackagesAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coin_packages").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as PkgRow[];
    },
  });

  const [draft, setDraft] = useState({
    coins: 1000,
    bonus_coins: 0,
    price_pkr: 200,
    label: "",
    badge: "",
    sort_order: 99,
    tier: "starter" as Tier,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coin_packages").insert({
        coins: draft.coins,
        bonus_coins: draft.bonus_coins,
        price_pkr: draft.price_pkr,
        price: draft.price_pkr, // legacy NOT NULL column
        label: draft.label || null,
        badge: draft.badge || null,
        sort_order: draft.sort_order,
        tier: draft.tier,
        active: true,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Package added");
      qc.invalidateQueries({ queryKey: ["admin_packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (p: PkgRow) => {
      const { error } = await supabase.from("coin_packages").update({ active: !p.active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_packages"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coin_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_packages"] }),
  });

  return (
    <>
      <AdminPageHeader title="Coin Management" subtitle="Recharge packages users can buy" />
      <div className="space-y-2">
        {list.data?.map((p) => (
          <div key={p.id} className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {p.coins.toLocaleString()}
                {p.bonus_coins > 0 && <span className="text-[color:var(--gold)]"> +{p.bonus_coins}</span>} · Rs {Number(p.price_pkr).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{p.label || "—"} {p.badge && `· ${p.badge}`}</p>
            </div>
            <button
              onClick={() => toggle.mutate(p)}
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${p.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
            >
              {p.active ? "ON" : "OFF"}
            </button>
            <button onClick={() => confirm("Delete this package?") && remove.mutate(p.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="glass mt-4 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new package</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {(
            [
              ["coins", "Coins", "number"],
              ["bonus_coins", "Bonus", "number"],
              ["price_pkr", "Price (PKR)", "number"],
              ["sort_order", "Order", "number"],
              ["label", "Label", "text"],
              ["badge", "Badge", "text"],
            ] as const
          ).map(([k, l, t]) => (
            <input
              key={k}
              type={t}
              placeholder={l}
              value={String(draft[k] ?? "")}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: t === "number" ? Number(e.target.value) : e.target.value }))}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
          ))}
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add package
        </button>
      </div>
    </>
  );
}
