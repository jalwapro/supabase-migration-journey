import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/vip")({
  component: VipAdmin,
});

type Tier = {
  id: string;
  level: number;
  name: string;
  price_coins: number;
  duration_days: number;
  perks: Record<string, unknown> | null;
  badge_icon: string | null;
  active: boolean;
};

function VipAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_vip"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_tiers").select("*").order("level");
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
  });

  const [draft, setDraft] = useState({ level: 1, name: "Bronze", price_coins: 10000, duration_days: 30, badge_icon: "👑" });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vip_tiers").insert({ ...draft, active: true, perks: {} });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("VIP tier added");
      qc.invalidateQueries({ queryKey: ["admin_vip"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Tier) => {
      const { error } = await supabase.from("vip_tiers").update({ active: !t.active }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_vip"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vip_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_vip"] }),
  });

  return (
    <>
      <AdminPageHeader title="VIP Tiers" subtitle="Membership levels and pricing" />
      <div className="grid gap-2 md:grid-cols-2">
        {list.data?.map((t) => (
          <div key={t.id} className="glass flex items-center gap-3 rounded-2xl p-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--gold)]/15 text-2xl">
              {t.badge_icon ?? <Crown className="h-6 w-6 text-[color:var(--gold)]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Lvl {t.level} · {t.name}</p>
              <p className="text-xs text-muted-foreground">{t.price_coins.toLocaleString()} coins / {t.duration_days} days</p>
            </div>
            <button
              onClick={() => toggle.mutate(t)}
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${t.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
            >
              {t.active ? "ON" : "OFF"}
            </button>
            <button onClick={() => confirm(`Delete ${t.name}?`) && remove.mutate(t.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="glass mt-4 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new tier</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {(
            [
              ["level", "Level", "number"],
              ["name", "Name", "text"],
              ["badge_icon", "Badge (emoji)", "text"],
              ["price_coins", "Price (coins)", "number"],
              ["duration_days", "Duration (days)", "number"],
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
          <Plus className="h-3 w-3" /> Add tier
        </button>
      </div>
    </>
  );
}
