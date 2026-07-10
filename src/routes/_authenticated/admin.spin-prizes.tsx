import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/spin-prizes")({
  component: SpinPrizesAdmin,
});

type Prize = {
  id: string;
  label: string;
  kind: "coins" | "diamonds" | "theme" | "frame" | "nothing";
  min_amount: number;
  max_amount: number;
  duration_days: number | null;
  weight: number;
  color: string;
  is_active: boolean;
  sort: number;
};

type Cfg = {
  daily_spin_enabled: boolean;
  daily_spin_cooldown_hours: number;
  custom_theme_enabled: boolean;
  custom_theme_price_coins: number;
  custom_theme_duration_hours: number;
};

function SpinPrizesAdmin() {
  const qc = useQueryClient();

  const cfgQ = useQuery({
    queryKey: ["spin_prize_cfg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("daily_spin_enabled,daily_spin_cooldown_hours,custom_theme_enabled,custom_theme_price_coins,custom_theme_duration_hours")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw error;
      return data as Cfg;
    },
  });

  const [cfg, setCfg] = useState<Cfg | null>(null);
  useEffect(() => {
    if (cfgQ.data) setCfg(cfgQ.data);
  }, [cfgQ.data]);

  const saveCfg = useMutation({
    mutationFn: async () => {
      if (!cfg) return;
      const { error } = await supabase.from("app_settings").update(cfg).eq("id", "global");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Settings saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const list = useQuery({
    queryKey: ["admin_spin_prizes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("spin_prizes").select("*").order("sort");
      if (error) throw error;
      return (data ?? []) as Prize[];
    },
  });

  const totalWeight = list.data?.filter((p) => p.is_active).reduce((s, p) => s + p.weight, 0) ?? 0;

  const update = useMutation({
    mutationFn: async (p: Prize) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("spin_prizes").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin_spin_prizes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spin_prizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_spin_prizes"] }),
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("spin_prizes").insert({
        label: "New Prize",
        kind: "coins",
        min_amount: 100,
        max_amount: 100,
        weight: 1,
        color: "#7c3aed",
        is_active: true,
        sort: (list.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_spin_prizes"] }),
  });

  return (
    <>
      <AdminPageHeader
        title="Daily Spin & Custom Themes"
        subtitle="Configure prize pool, odds, and custom theme pricing"
      />

      {cfg && (
        <div className="glass mb-4 rounded-2xl p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Global settings
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5">
              <input type="checkbox" checked={cfg.daily_spin_enabled} onChange={(e) => setCfg({ ...cfg, daily_spin_enabled: e.target.checked })} />
              Daily spin enabled
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5">
              <span className="text-muted-foreground">Cooldown (h)</span>
              <input type="number" value={cfg.daily_spin_cooldown_hours} onChange={(e) => setCfg({ ...cfg, daily_spin_cooldown_hours: Number(e.target.value) })} className="w-full bg-transparent text-right outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5">
              <input type="checkbox" checked={cfg.custom_theme_enabled} onChange={(e) => setCfg({ ...cfg, custom_theme_enabled: e.target.checked })} />
              Custom themes enabled
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5">
              <span className="text-muted-foreground">Price (coins)</span>
              <input type="number" value={cfg.custom_theme_price_coins} onChange={(e) => setCfg({ ...cfg, custom_theme_price_coins: Number(e.target.value) })} className="w-full bg-transparent text-right outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5">
              <span className="text-muted-foreground">Duration (h)</span>
              <input type="number" value={cfg.custom_theme_duration_hours} onChange={(e) => setCfg({ ...cfg, custom_theme_duration_hours: Number(e.target.value) })} className="w-full bg-transparent text-right outline-none" />
            </label>
          </div>
          <button
            onClick={() => saveCfg.mutate()}
            disabled={saveCfg.isPending}
            className="mt-2 flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {saveCfg.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save settings
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Total active weight: <span className="font-bold text-foreground">{totalWeight}</span>
          {totalWeight > 0 && " (probability = weight ÷ total)"}
        </p>
        <button onClick={() => add.mutate()} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          <Plus className="h-3 w-3" /> Add prize
        </button>
      </div>

      <div className="space-y-2">
        {list.data?.map((p) => (
          <PrizeRow key={p.id} prize={p} totalWeight={totalWeight} onSave={(x) => update.mutate(x)} onDelete={() => remove.mutate(p.id)} />
        ))}
      </div>
    </>
  );
}

function PrizeRow({
  prize,
  totalWeight,
  onSave,
  onDelete,
}: {
  prize: Prize;
  totalWeight: number;
  onSave: (p: Prize) => void;
  onDelete: () => void;
}) {
  const [p, setP] = useState<Prize>(prize);
  useEffect(() => setP(prize), [prize]);
  const dirty = JSON.stringify(p) !== JSON.stringify(prize);
  const pct = totalWeight > 0 && p.is_active ? ((p.weight / totalWeight) * 100).toFixed(1) : "—";

  return (
    <div className="glass grid grid-cols-2 gap-2 rounded-2xl p-3 md:grid-cols-8">
      <input value={p.label} onChange={(e) => setP({ ...p, label: e.target.value })} placeholder="Label" className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
      <select value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as Prize["kind"] })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none">
        <option value="coins">coins</option>
        <option value="diamonds">diamonds</option>
        <option value="frame">frame</option>
        <option value="theme">theme</option>
        <option value="nothing">nothing</option>
      </select>
      <input type="number" value={p.min_amount} onChange={(e) => setP({ ...p, min_amount: Number(e.target.value) })} placeholder="min" className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
      <input type="number" value={p.max_amount} onChange={(e) => setP({ ...p, max_amount: Number(e.target.value) })} placeholder="max" className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
      <label className="flex items-center gap-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
        <span className="text-muted-foreground">W</span>
        <input type="number" value={p.weight} onChange={(e) => setP({ ...p, weight: Math.max(1, Number(e.target.value)) })} className="w-full bg-transparent text-right outline-none" />
        <span className="ml-1 text-[10px] text-[color:var(--gold)]">{pct}%</span>
      </label>
      <input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} className="h-8 w-full cursor-pointer rounded bg-transparent" />
      <div className="flex items-center gap-1">
        <label className="flex flex-1 items-center gap-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
          <input type="checkbox" checked={p.is_active} onChange={(e) => setP({ ...p, is_active: e.target.checked })} />
          On
        </label>
        <button onClick={() => onSave(p)} disabled={!dirty} className="rounded-full bg-primary/80 p-1.5 text-primary-foreground disabled:opacity-40">
          <Save className="h-3 w-3" />
        </button>
        <button onClick={() => confirm(`Delete "${p.label}"?`) && onDelete()} className="rounded-full bg-red-500/20 p-1.5 text-red-400">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
