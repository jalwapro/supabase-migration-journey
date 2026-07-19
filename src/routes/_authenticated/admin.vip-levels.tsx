import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { VipBadge } from "@/components/vip/VipBadge";
import { formatCoins, vipTierForLevel } from "@/lib/vip-levels";
import { frameForLevel, seriesForLevel } from "@/lib/levelFrames";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { Loader2, Save, Search, Crown, TrendingUp, Users, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/vip-levels")({
  component: VipLevelsAdmin,
});

type Row = {
  level: number;
  threshold_coins: number;
  tier: string;
  title: string;
  badge_url: string | null;
  frame_url: string | null;
  bubble_url: string | null;
  entrance_url: string | null;
  name_color: string | null;
  reward_coins: number;
  reward_bundle: Record<string, unknown>;
  privileges: Record<string, unknown>;
};

function VipLevelsAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

  const cfg = useQuery({
    queryKey: ["admin_vip_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_level_config")
        .select("*")
        .order("level");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const stats = useQuery({
    queryKey: ["admin_vip_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("vip_level, total_gifted_coins")
        .gt("vip_level", 0);
      if (error) throw error;
      const rows = (data ?? []) as { vip_level: number; total_gifted_coins: number | null }[];
      const total = rows.length;
      const totalCoins = rows.reduce((s, r) => s + (r.total_gifted_coins ?? 0), 0);
      const byLevel = new Map<number, number>();
      rows.forEach((r) => byLevel.set(r.vip_level, (byLevel.get(r.vip_level) ?? 0) + 1));
      const top = [...byLevel.entries()].sort((a, b) => b[0] - a[0])[0];
      return { total, totalCoins, topLevel: top?.[0] ?? 0, topCount: top?.[1] ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("vip_level_config")
        .update({
          threshold_coins: row.threshold_coins,
          tier: row.tier,
          title: row.title,
          badge_url: row.badge_url,
          frame_url: row.frame_url,
          bubble_url: row.bubble_url,
          entrance_url: row.entrance_url,
          name_color: row.name_color,
          reward_coins: row.reward_coins,
          reward_bundle: row.reward_bundle,
          privileges: row.privileges,
          updated_at: new Date().toISOString(),
        })
        .eq("level", row.level);
      if (error) throw error;
      await supabase.from("vip_admin_logs").insert({
        action: "vip_level_edit",
        target: String(row.level),
        details: { level: row.level, threshold_coins: row.threshold_coins, title: row.title },
      }).throwOnError().then(() => {}, () => {});
    },
    onSuccess: () => {
      toast.success("VIP level updated");
      qc.invalidateQueries({ queryKey: ["admin_vip_levels"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = cfg.data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter(
      (r) =>
        String(r.level).includes(t) ||
        r.tier.toLowerCase().includes(t) ||
        r.title.toLowerCase().includes(t),
    );
  }, [cfg.data, q]);

  return (
    <>
      <AdminPageHeader
        title="VIP Levels"
        subtitle="Manage all 101 gifting levels — thresholds, titles, rewards, privileges"
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard icon={Users} label="Active VIPs" value={stats.data?.total.toLocaleString() ?? "—"} />
        <StatCard icon={Coins} label="Total gifted" value={stats.data ? formatCoins(stats.data.totalCoins) : "—"} />
        <StatCard icon={TrendingUp} label="Top level" value={stats.data ? `L${stats.data.topLevel}` : "—"} />
        <StatCard icon={Crown} label="Max tier holders" value={stats.data?.topCount.toLocaleString() ?? "—"} />
      </div>

      <div className="glass mb-4 flex items-center gap-2 rounded-full px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search level, tier, or title…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {cfg.isLoading ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="hidden grid-cols-[64px_64px_1fr_1fr_1fr_120px_100px] gap-2 border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:grid">
            <span>Lvl</span><span>Frame</span><span>Tier</span><span>Title</span><span>Threshold</span><span>Reward</span><span></span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const tier = vipTierForLevel(r.level);
              const frameUrl = r.frame_url || frameForLevel(r.level);
              const series = seriesForLevel(r.level);
              return (
                <li
                  key={r.level}
                  className="grid grid-cols-[64px_64px_1fr_120px] items-center gap-2 px-3 py-2 md:grid-cols-[64px_64px_1fr_1fr_1fr_120px_100px]"
                >
                  <VipBadge level={r.level} size="sm" />
                  <FramePreview url={frameUrl} label={series?.series} />
                  <span className="truncate text-xs font-semibold" style={{ color: tier.glow }}>
                    {r.tier}
                  </span>
                  <span className="hidden truncate text-xs md:inline">{r.title}</span>
                  <span className="hidden text-xs text-muted-foreground md:inline">
                    {formatCoins(r.threshold_coins)}
                  </span>
                  <span className="hidden text-xs md:inline">
                    {r.reward_coins > 0 ? `💰 ${formatCoins(r.reward_coins)}` : "—"}
                  </span>
                  <button
                    onClick={() => setEditing(r)}
                    className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary"
                  >
                    Edit
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={(r) => save.mutate(r)}
          saving={save.isPending}
        />
      )}
    </>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function EditModal({
  row,
  onClose,
  onSave,
  saving,
}: {
  row: Row;
  onClose: () => void;
  onSave: (r: Row) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Row>(row);
  const set = <K extends keyof Row>(k: K, v: Row[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] rounded-t-3xl border-t border-border bg-background p-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-3 flex items-center gap-2">
          <VipBadge level={row.level} size="md" />
          <div>
            <p className="text-lg font-bold">Level {row.level}</p>
            <p className="text-[11px] text-muted-foreground">Edit tier, title, threshold, rewards</p>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          <Field label="Tier">
            <input value={draft.tier} onChange={(e) => set("tier", e.target.value)} className={input} />
          </Field>
          <Field label="Title">
            <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={input} />
          </Field>
          <Field label="Threshold coins (lifetime gifted)">
            <input type="number" value={draft.threshold_coins} onChange={(e) => set("threshold_coins", Number(e.target.value))} className={input} />
          </Field>
          <Field label="Reward coins (level-up bonus)">
            <input type="number" value={draft.reward_coins} onChange={(e) => set("reward_coins", Number(e.target.value))} className={input} />
          </Field>
          <Field label="Name color (hex)">
            <input value={draft.name_color ?? ""} onChange={(e) => set("name_color", e.target.value || null)} placeholder="#ec4899" className={input} />
          </Field>
          <Field label="Badge URL">
            <input value={draft.badge_url ?? ""} onChange={(e) => set("badge_url", e.target.value || null)} className={input} />
          </Field>
          <Field label="Frame URL">
            <input value={draft.frame_url ?? ""} onChange={(e) => set("frame_url", e.target.value || null)} className={input} />
          </Field>
          <Field label="Bubble URL">
            <input value={draft.bubble_url ?? ""} onChange={(e) => set("bubble_url", e.target.value || null)} className={input} />
          </Field>
          <Field label="Entrance URL">
            <input value={draft.entrance_url ?? ""} onChange={(e) => set("entrance_url", e.target.value || null)} className={input} />
          </Field>
          <Field label="Reward bundle (JSON)">
            <JsonField value={draft.reward_bundle} onChange={(v) => set("reward_bundle", v)} />
          </Field>
          <Field label="Privileges (JSON)">
            <JsonField value={draft.privileges} onChange={(v) => set("privileges", v)} />
          </Field>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border bg-card py-2 text-sm font-bold">
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>
    </>
  );
}

const input =
  "w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function JsonField({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value || "{}");
            setErr(null);
            onChange(parsed);
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
        rows={4}
        className={`${input} font-mono`}
      />
      {err && <p className="mt-0.5 text-[10px] text-red-400">{err}</p>}
    </div>
  );
}
