import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Save, Eye, EyeOff, Wrench, Search, Flag } from "lucide-react";
import { toast } from "sonner";
import type { MiniGame } from "@/lib/minigames";

export const Route = createFileRoute("/_authenticated/admin/minigames")({
  component: MiniGamesAdmin,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Failed to load: {error?.message}</div>
  ),
});

type Draft = Partial<MiniGame> & { id: string };

function MiniGamesAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const games = useQuery({
    queryKey: ["admin_mini_games"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mini_games").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MiniGame[];
    },
  });

  const flags = useQuery({
    queryKey: ["admin_mg_flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mini_game_flags")
        .select("id, user_id, slug, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const { id, ...patch } = d;
      const { error } = await supabase.from("mini_games").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, d) => {
      toast.success("Saved");
      setDrafts((s) => {
        const n = { ...s };
        delete n[d.id];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["admin_mini_games"] });
      qc.invalidateQueries({ queryKey: ["mini_games"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = (g: MiniGame, k: keyof MiniGame, v: unknown) =>
    setDrafts((s) => ({ ...s, [g.id]: { ...(s[g.id] ?? { id: g.id }), [k]: v } }));

  const val = <K extends keyof MiniGame>(g: MiniGame, k: K): MiniGame[K] =>
    (drafts[g.id]?.[k] as MiniGame[K] | undefined) ?? g[k];

  const list = (games.data ?? []).filter((g) =>
    `${g.name} ${g.slug}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="pb-24">
      <AdminPageHeader title="Mini Games" subtitle="Entry cost, rewards, XP, limits, cooldown & maintenance" />

      <div className="px-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games…"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {games.isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((g) => {
              const dirty = !!drafts[g.id];
              return (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl"
                      style={{ background: `${g.color}22`, border: `1px solid ${g.color}66` }}
                    >
                      {g.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{g.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">/{g.slug}</p>
                    </div>
                    <button
                      onClick={() => patch(g, "enabled", !val(g, "enabled"))}
                      title={val(g, "enabled") ? "Enabled" : "Hidden"}
                      className={`grid h-9 w-9 place-items-center rounded-xl border ${
                        val(g, "enabled") ? "border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      {val(g, "enabled") ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => patch(g, "maintenance", !val(g, "maintenance"))}
                      title="Maintenance mode"
                      className={`grid h-9 w-9 place-items-center rounded-xl border ${
                        val(g, "maintenance") ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      <Wrench className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Num label="Entry cost" value={val(g, "entry_cost")} onChange={(v) => patch(g, "entry_cost", v)} />
                    <Num label="Reward base" value={val(g, "reward_base")} onChange={(v) => patch(g, "reward_base", v)} />
                    <Num label="XP reward" value={val(g, "xp_reward")} onChange={(v) => patch(g, "xp_reward", v)} />
                    <Num label="Daily limit" value={val(g, "daily_limit")} onChange={(v) => patch(g, "daily_limit", v)} />
                    <Num label="Cooldown (s)" value={val(g, "cooldown_seconds")} onChange={(v) => patch(g, "cooldown_seconds", v)} />
                    <Num label="Sort order" value={val(g, "sort_order")} onChange={(v) => patch(g, "sort_order", v)} />
                    <Num label="Min duration (ms)" value={val(g, "min_duration_ms")} onChange={(v) => patch(g, "min_duration_ms", v)} />
                    <Num label="Max duration (ms)" value={val(g, "max_duration_ms")} onChange={(v) => patch(g, "max_duration_ms", v)} />
                    <Num label="Max score" value={val(g, "max_score")} onChange={(v) => patch(g, "max_score", v)} />
                  </div>

                  <label className="mt-2 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Config (JSON — tiers / prizes / rounds)
                    </span>
                    <textarea
                      defaultValue={JSON.stringify(g.config ?? {}, null, 2)}
                      onChange={(e) => {
                        try {
                          patch(g, "config", JSON.parse(e.target.value || "{}"));
                        } catch {
                          /* keep typing */
                        }
                      }}
                      rows={4}
                      spellCheck={false}
                      className="mt-1 w-full rounded-xl border border-border bg-background p-2 font-mono text-[11px] outline-none focus:border-primary"
                    />
                  </label>

                  <button
                    disabled={!dirty || save.isPending}
                    onClick={() => save.mutate({ ...drafts[g.id]!, id: g.id })}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
                  >
                    {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {dirty ? "Save changes" : "No changes"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <h3 className="mt-8 mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
          <Flag className="h-4 w-4 text-red-400" /> Anti-cheat flags
        </h3>
        <div className="space-y-1.5">
          {(flags.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
              No suspicious activity recorded.
            </p>
          ) : (
            flags.data!.map((f: { id: string; user_id: string; slug: string; reason: string; created_at: string }) => (
              <div key={f.id} className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px]">
                <span className="font-black">{f.slug}</span> · {f.reason}
                <span className="float-right text-muted-foreground">
                  {new Date(f.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
