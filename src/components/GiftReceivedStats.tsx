import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Trophy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Period = "today" | "month" | "all_time";
type Supporter = {
  user_id: string;
  username: string | null;
  avatar: string | null;
  points: number;
  gifts: number;
};
type PeriodStats = {
  period: Period;
  total_coins: number;
  total_diamonds: number;
  gift_count: number;
  top_supporters: Supporter[] | null;
};

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  month: "This month",
  all_time: "All time",
};
const number = (value: unknown) => Number(value ?? 0).toLocaleString();

export function GiftReceivedStats({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");

  const stats = useQuery({
    queryKey: ["gift-received-stats", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Pass local calendar boundaries so "today" and "this month" match the
      // timezone the user is currently viewing the app in.
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data, error } = await supabase.rpc("get_user_gift_received_stats", {
        _user_id: userId,
        _today_start: todayStart.toISOString(),
        _month_start: monthStart.toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as unknown as PeriodStats[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`gift-received-stats:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `receiver_id=eq.${userId}` },
        () => { void qc.invalidateQueries({ queryKey: ["gift-received-stats", userId] }); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);

  const rows = stats.data ?? [];
  const getStats = (key: Period) => rows.find(row => row.period === key);
  const selected = getStats(period);
  const cards: Period[] = ["today", "month", "all_time"];
  const supporters = (selected?.top_supporters ?? []).slice(0, compact ? 3 : 5);

  return (
    <section className={compact
      ? "mt-3 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-400/[.08] to-fuchsia-500/[.06] p-3"
      : "mx-4 mt-3 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-400/[.08] to-fuchsia-500/[.06] p-4"}
      aria-label="Gift received statistics">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-200"><Gift className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-white">Gift received</h3>
          <p className="text-[10px] text-white/50">Verified gift transactions</p>
        </div>
        {stats.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" aria-label="Refreshing gift stats" />}
      </div>

      {stats.isError ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/60">
          Gift statistics are temporarily unavailable.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {cards.map(key => {
              const item = getStats(key);
              return (
                <div key={key} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="truncate text-[9px] font-bold text-white/50">{PERIOD_LABELS[key]}</div>
                  <div className="mt-1 text-[11px] font-black text-amber-200" title="Gift value in coins">{number(item?.total_coins)}</div>
                  <div className="text-[9px] text-white/45">Gift value</div>
                  <div className="mt-1 text-[11px] font-bold text-cyan-200" title="Diamonds credited">{number(item?.total_diamonds)}</div>
                  <div className="text-[9px] text-white/45">Diamonds</div>
                  <div className="mt-1 text-[9px] text-white/35">{number(item?.gift_count)} gifts</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
            <h4 className="min-w-0 flex-1 text-xs font-black text-white">Top supporters</h4>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(["today", "month", "all_time"] as Period[]).map(key => (
              <button key={key} type="button" onClick={() => setPeriod(key)} aria-pressed={period === key}
                className={`rounded-lg border px-1.5 py-2 text-[10px] font-bold transition ${period === key
                  ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                  : "border-white/10 bg-white/[.03] text-white/55"}`}>
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>
          {stats.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading supporters…</div>
          ) : supporters.length ? (
            <div className="mt-2 space-y-1.5">
              {supporters.map((supporter, index) => (
                <div key={supporter.user_id} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[.07] bg-black/15 px-2 py-1.5">
                  <span className="w-4 shrink-0 text-center text-[10px] font-black text-amber-200">{index + 1}</span>
                  {supporter.avatar
                    ? <img src={supporter.avatar} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white">{(supporter.username ?? "U").slice(0, 1).toUpperCase()}</span>}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{supporter.username ?? "User"}</span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] font-black text-amber-200">{number(supporter.points)}</span>
                    <span className="block text-[9px] text-white/40">{number(supporter.gifts)} gifts</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-white/10 bg-black/15 p-3 text-center text-[11px] text-white/45">No supporters for {PERIOD_LABELS[period].toLowerCase()} yet.</p>
          )}
        </>
      )}
    </section>
  );
}
