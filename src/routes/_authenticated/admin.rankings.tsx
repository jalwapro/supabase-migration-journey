import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Trophy, Gift, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rankings")({ component: RankingsAdmin });

type Period = "daily" | "weekly" | "monthly";
type Kind = "gifters" | "receivers";
type Row = { user_id: string; username: string | null; avatar: string | null; points: number; is_vip: boolean; level: number };

function useLeaderboard(kind: Kind, period: Period) {
  return useQuery({
    queryKey: ["leaderboard", kind, period],
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard", { _kind: kind, _period: period });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function List({ title, icon: Icon, rows, loading }: { title: string; icon: typeof Trophy; rows?: Row[]; loading: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-[color:var(--gold)]" /><p className="text-sm font-bold">{title}</p></div>
      {loading ? <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div> : (
        <div className="space-y-1.5">
          {(rows ?? []).slice(0, 20).map((p, i) => (
            <div key={p.user_id} className="flex items-center gap-2 rounded-lg bg-card/40 px-2 py-1.5">
              <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
              <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-primary/20">{p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" alt="" /> : <Users className="h-3 w-3" />}</div>
              <p className="min-w-0 flex-1 truncate text-xs">@{p.username ?? "user"}</p>
              {p.is_vip && <span className="text-[9px] font-bold text-[color:var(--gold)]">VIP</span>}
              <span className="text-[11px] font-bold text-[color:var(--gold)]">{Number(p.points).toLocaleString()}</span>
            </div>
          ))}
          {!rows?.length && <div className="py-6 text-center text-xs text-muted-foreground">No gifts in this period.</div>}
        </div>
      )}
    </div>
  );
}

function RankingsAdmin() {
  const [period, setPeriod] = useState<Period>("daily");
  const gifters = useLeaderboard("gifters", period);
  const receivers = useLeaderboard("receivers", period);
  return (
    <>
      <AdminPageHeader title="Rankings" subtitle="Gift activity leaderboard" />
      <div className="mb-3 flex gap-1 rounded-full border border-border bg-card/60 p-1">
        {(["daily", "weekly", "monthly"] as Period[]).map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`flex-1 rounded-full px-3 py-2 text-xs font-bold capitalize ${period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{value}</button>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <List title="Top Gifters" icon={Gift} rows={gifters.data} loading={gifters.isLoading} />
        <List title="Top Receivers" icon={Trophy} rows={receivers.data} loading={receivers.isLoading} />
      </div>
    </>
  );
}
