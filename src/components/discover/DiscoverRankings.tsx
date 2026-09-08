import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Gift, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCompact } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly";
type Kind = "gifters" | "receivers";
const kinds: { key: Kind; label: string; icon: typeof Gift }[] = [
  { key: "gifters", label: "Gifters", icon: Gift },
  { key: "receivers", label: "Receivers", icon: Users },
];
const periods: { key: Period; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];
type Row = { user_id: string; username: string | null; avatar: string | null; points: number; is_vip?: boolean; level?: number };

export function DiscoverRankings() {
  const [kind, setKind] = useState<Kind>("gifters");
  const [period, setPeriod] = useState<Period>("daily");
  const ranking = useQuery({
    queryKey: ["discover-ranking", kind, period],
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard", { _kind: kind, _period: period });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-[color:var(--gold)]" /><h2 className="text-xs font-black uppercase tracking-wider">Rankings</h2></div><div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">{periods.map((p) => <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-full px-2 py-1 text-[9px] font-bold ${period === p.key ? "bg-white/15" : "text-muted-foreground"}`}>{p.label}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/5 p-1">{kinds.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setKind(key)} className={`flex items-center justify-center gap-1 rounded-full py-1.5 text-[10px] font-bold ${kind === key ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground" : "text-muted-foreground"}`}><Icon className="h-3 w-3" /> {label}</button>)}</div>
      <div className="space-y-1.5">
        {ranking.isLoading ? <div className="py-5 text-center text-xs text-muted-foreground">Loading rankings…</div> : ranking.isError ? <div className="py-5 text-center text-xs text-muted-foreground">Rankings unavailable</div> : (ranking.data ?? []).map((row, index) => (
          <Link key={row.user_id} to="/u/$userId" params={{ userId: row.user_id }} className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
            <span className="w-5 text-center text-[10px] font-black text-[color:var(--gold)]">#{index + 1}</span>
            <span className="grid h-9 w-9 shrink-0 overflow-hidden rounded-full bg-card">{row.avatar ? <img src={row.avatar} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xs font-bold">{(row.username ?? "?").charAt(0).toUpperCase()}</span>}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.username ?? "User"}</span>
            <span className="text-[10px] font-bold text-muted-foreground">{formatCompact(Number(row.points ?? 0))}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
