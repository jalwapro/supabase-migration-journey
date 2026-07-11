import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Handshake, Loader2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/partner")({
  component: PartnerDashboard,
});

type DailyRow = { day: string; revenue: number; coins: number; profit: number };
type Stats = {
  percentage: number;
  is_active: boolean;
  total_revenue: number;
  total_coins: number;
  total_profit: number;
  today_revenue: number;
  today_coins: number;
  today_profit: number;
  daily: DailyRow[];
};

function PartnerDashboard() {
  const { user } = useAuth();

  const stats = useQuery({
    queryKey: ["partner_stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  return (
    <>
      <AppShell>
        <div className="mx-auto max-w-md px-4 pb-24 pt-4 text-white">
          <div className="mb-4 flex items-center gap-2">
            <Link to="/me" className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-lg font-black">Partner Dashboard</p>
              <p className="text-[11px] text-white/60">Revenue-share earnings</p>
            </div>
            <Handshake className="ml-auto h-5 w-5 text-[color:var(--gold)]" />
          </div>

          {stats.isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            </div>
          )}

          {stats.error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              {(stats.error as Error).message}
            </div>
          )}

          {stats.data && (
            <>
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-[color:var(--gold)]/30 bg-gradient-to-r from-[color:var(--gold)]/20 to-[color:var(--primary)]/10 p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/60">Your share</p>
                  <p className="text-2xl font-black text-[color:var(--gold)]">{stats.data.percentage}%</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${stats.data.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
                >
                  {stats.data.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <Card label="Today profit" value={stats.data.today_profit} gold prefix="PKR " />
                <Card label="Today revenue" value={stats.data.today_revenue} prefix="PKR " />
                <Card label="Total profit" value={stats.data.total_profit} gold prefix="PKR " />
                <Card label="Total revenue" value={stats.data.total_revenue} prefix="PKR " />
              </div>

              <div className="glass rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[color:var(--gold)]" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Last 7 days</p>
                </div>
                {stats.data.daily.length === 0 ? (
                  <p className="py-4 text-center text-xs text-white/50">No approved recharges yet.</p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {stats.data.daily.map((d) => (
                      <div key={d.day} className="flex items-center justify-between py-2 text-xs">
                        <span className="text-white/70">{d.day}</span>
                        <div className="flex gap-3">
                          <span className="text-white/60">PKR {Number(d.revenue).toLocaleString()}</span>
                          <span className="font-bold text-[color:var(--gold)]">
                            +{Number(d.profit).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Card({
  label,
  value,
  gold,
  prefix,
}: {
  label: string;
  value: number;
  gold?: boolean;
  prefix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-white/60">{label}</p>
      <p className={`mt-1 text-lg font-black ${gold ? "text-[color:var(--gold)]" : "text-white"}`}>
        {prefix ?? ""}
        {Number(value ?? 0).toLocaleString()}
      </p>
    </div>
  );
}
