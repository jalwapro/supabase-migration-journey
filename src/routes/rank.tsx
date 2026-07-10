import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Crown, Trophy, Sparkles, Globe2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { VipBadge } from "@/components/vip/VipBadge";
import { RoyalBadge } from "@/components/vip/RoyalBadge";
import { formatCoins } from "@/lib/vip-levels";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({
    meta: [
      { title: "Leaderboard — Jalwa" },
      { name: "description", content: "Top VIP gifters and hosts on Jalwa. Daily, weekly, monthly, yearly and all-time rankings." },
    ],
  }),
});

type Board  = "gifters" | "hosts";
type Period = "daily" | "weekly" | "monthly" | "yearly" | "all";
type Scope  = "global" | "country" | "family";

type Entry = {
  user_id: string;
  username: string | null;
  avatar: string | null;
  country: string | null;
  vip_level: number;
  total_coins: number;
  rnk: number;
};

function RankPage() {
  const { profile } = useAuth();
  const [board,  setBoard]  = useState<Board>("gifters");
  const [period, setPeriod] = useState<Period>("weekly");
  const [scope,  setScope]  = useState<Scope>("global");

  const scopeValue =
    scope === "country" ? profile?.country ?? null :
    scope === "family"  ? null /* filled by RPC when family exists */ :
    null;

  const q = useQuery({
    queryKey: ["vip-rank", board, period, scope, scopeValue],
    staleTime: 30_000,
    queryFn: async () => {
      const rpc = board === "gifters" ? "rank_gifters" : "rank_hosts";
      const { data, error } = await supabase.rpc(rpc, {
        p_period: period, p_scope: scope, p_scope_value: scopeValue, p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const list = q.data ?? [];
  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <>
      <AppShell title="VIP Leaderboards" subtitle="Top gifters & hosts">
        {/* Board tabs */}
        <div className="px-4 pt-3">
          <div className="glass flex rounded-full p-1">
            {(["gifters","hosts"] as Board[]).map((b) => (
              <button key={b} onClick={() => setBoard(b)}
                className={`flex-1 rounded-full py-2 text-xs font-black uppercase tracking-wider transition ${
                  board === b
                    ? "bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-lg"
                    : "text-muted-foreground"
                }`}>
                {b === "gifters" ? "🎁 Gifters" : "👑 Hosts"}
              </button>
            ))}
          </div>
        </div>

        {/* Scope tabs */}
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-4">
          {(
            [
              { k: "global",  label: "Global",  icon: <Globe2 className="h-3 w-3" /> },
              { k: "country", label: profile?.country ? profile.country : "Country", icon: <Sparkles className="h-3 w-3" /> },
              { k: "family",  label: "Family",  icon: <Users  className="h-3 w-3" /> },
            ] as { k: Scope; label: string; icon: React.ReactNode }[]
          ).map((s) => {
            const active = scope === s.k;
            const disabled = (s.k === "country" && !profile?.country);
            return (
              <button key={s.k} disabled={disabled}
                onClick={() => setScope(s.k)}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[color:var(--primary)]/20 text-[color:var(--primary)] ring-1 ring-[color:var(--primary)]/40"
                    : "border border-border bg-card/60 text-foreground/80 disabled:opacity-40"
                }`}>
                {s.icon} {s.label}
              </button>
            );
          })}
        </div>

        {/* Period tabs */}
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-4">
          {(["daily","weekly","monthly","yearly","all"] as Period[]).map((p) => {
            const active = period === p;
            return (
              <button key={p} onClick={() => setPeriod(p)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                  active
                    ? "bg-gradient-to-r from-[color:var(--gold)]/30 to-[color:var(--primary)]/30 text-white ring-1 ring-[color:var(--gold)]/50"
                    : "border border-border bg-card/60 text-foreground/70"
                }`}>
                {p === "all" ? "All-time" : p}
              </button>
            );
          })}
        </div>

        {/* Podium */}
        <section className="px-4 pt-5">
          {q.isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-card/60" />
              ))}
            </div>
          ) : top3.length > 0 ? (
            <Podium top3={top3} />
          ) : null}
        </section>

        {/* List */}
        <section className="mt-4 px-4 pb-6">
          {q.isLoading ? (
            <div className="glass grid place-items-center rounded-2xl p-8 text-xs text-muted-foreground">
              <Sparkles className="mb-2 h-5 w-5 animate-pulse text-[color:var(--primary)]" />
              Loading rankings…
            </div>
          ) : list.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Trophy className="mx-auto h-8 w-8 text-[color:var(--gold)]" />
              <p className="mt-3 text-sm font-semibold">No rankings yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send gifts to appear on the {board} board.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rest.map((e) => (
                <RankRow key={e.user_id} entry={e} />
              ))}
            </ul>
          )}
        </section>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Podium({ top3 }: { top3: Entry[] }) {
  const [first, second, third] = top3;
  const cells = [
    { e: second, place: 2, h: "h-28", ring: "ring-[color:var(--secondary)]" },
    { e: first,  place: 1, h: "h-36", ring: "ring-[color:var(--gold)]" },
    { e: third,  place: 3, h: "h-24", ring: "ring-[color:var(--primary)]" },
  ].filter((c) => c.e);

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {cells.map(({ e, place, h, ring }) => (
        <Link key={place} to="/u/$userId" params={{ userId: e.user_id }}
          className="flex min-w-0 flex-col items-center">
          <div className="relative">
            {place === 1 && (
              <Crown className="absolute -top-5 left-1/2 h-6 w-6 -translate-x-1/2 text-[color:var(--gold)] drop-shadow" />
            )}
            <div className={`grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-card ring-2 ${ring} ring-offset-2 ring-offset-background`}>
              {e.avatar ? (
                <img src={e.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold">{(e.username ?? "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </div>
          <p className="mt-2 max-w-full truncate text-xs font-bold">@{e.username ?? "user"}</p>
          <VipBadge level={e.vip_level ?? 0} size="xs" className="mt-1" />
          <p className="mt-1 text-[10px] font-black text-[color:var(--gold)]">{formatCoins(e.total_coins)}</p>
          <div className={`mt-2 w-full ${h} rounded-t-2xl bg-gradient-to-t ${
              place === 1 ? "from-[color:var(--gold)]/40 to-[color:var(--gold)]/10"
              : place === 2 ? "from-[color:var(--secondary)]/40 to-[color:var(--secondary)]/10"
              : "from-[color:var(--primary)]/40 to-[color:var(--primary)]/10"
            } grid place-items-center border border-border`}>
            <span className="text-2xl font-black text-gradient">{place}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RankRow({ entry }: { entry: Entry }) {
  return (
    <li>
      <Link to="/u/$userId" params={{ userId: entry.user_id }}
        className="glass flex items-center gap-3 rounded-2xl p-3 transition hover:border-[color:var(--primary)]/40">
        <div className="w-7 shrink-0 text-center text-sm font-black text-muted-foreground">
          {entry.rnk}
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-card ring-1 ring-border">
          {entry.avatar ? (
            <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold">{(entry.username ?? "?").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold">@{entry.username ?? "user"}</p>
            <VipBadge level={entry.vip_level ?? 0} size="xs" />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {entry.country ?? "—"}
          </p>
        </div>
        <p className="shrink-0 text-sm font-black text-[color:var(--gold)]">
          {formatCoins(entry.total_coins)}
        </p>
      </Link>
    </li>
  );
}
