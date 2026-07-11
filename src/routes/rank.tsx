import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Crown, Sparkles, Globe2, Users, Trophy, Flame } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { VipBadge } from "@/components/vip/VipBadge";
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
    scope === "family"  ? null :
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
        {/* Ambient prism aurora */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(255,0,127,0.22),_rgba(138,43,226,0.12)_45%,_transparent_72%)]" />
          <div className="absolute top-10 left-1/2 h-[2px] w-[300px] -translate-x-1/2 rotate-[28deg] bg-gradient-to-r from-transparent via-[color:var(--gold)]/50 to-transparent" />
          <div className="absolute top-10 left-1/2 h-[2px] w-[300px] -translate-x-1/2 -rotate-[28deg] bg-gradient-to-r from-transparent via-[color:var(--gold)]/50 to-transparent" />
        </div>

        {/* Board toggle */}
        <div className="relative z-10 px-5 pt-4">
          <div className="flex rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-xl">
            {(["gifters","hosts"] as Board[]).map((b) => (
              <button key={b} onClick={() => setBoard(b)}
                className={`flex-1 rounded-full py-2 text-[11px] font-black uppercase tracking-[0.2em] transition ${
                  board === b
                    ? "bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_0_18px_rgba(255,0,127,0.35)]"
                    : "text-white/40"
                }`}>
                {b === "gifters" ? "Gifters" : "Hosts"}
              </button>
            ))}
          </div>

          {/* Scope */}
          <div className="mt-4 flex justify-center gap-7">
            {([
              { k: "global",  label: "Global",  icon: <Globe2 className="h-3 w-3" /> },
              { k: "country", label: profile?.country || "Country", icon: <Sparkles className="h-3 w-3" /> },
              { k: "family",  label: "Family",  icon: <Users className="h-3 w-3" /> },
            ] as { k: Scope; label: string; icon: React.ReactNode }[]).map((s) => {
              const active = scope === s.k;
              const disabled = s.k === "country" && !profile?.country;
              return (
                <button key={s.k} disabled={disabled} onClick={() => setScope(s.k)}
                  className={`flex items-center gap-1.5 pb-1 text-[10px] font-black uppercase tracking-[0.25em] transition disabled:opacity-30 ${
                    active
                      ? "border-b-2 border-[color:var(--gold)] text-[color:var(--gold)] [text-shadow:0_0_8px_rgba(212,175,55,0.5)]"
                      : "text-white/30"
                  }`}>
                  {s.icon} {s.label}
                </button>
              );
            })}
          </div>

          {/* Period */}
          <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
            {(["daily","weekly","monthly","yearly","all"] as Period[]).map((p) => {
              const active = period === p;
              return (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`shrink-0 rounded-lg px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    active
                      ? "border border-[color:var(--primary)]/50 bg-white/10 text-white shadow-[0_0_12px_rgba(255,0,127,0.25)]"
                      : "border border-white/10 bg-white/[0.03] text-white/50"
                  }`}>
                  {p === "all" ? "All-time" : p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Diamond Podium */}
        <section className="relative z-10 px-4 pt-8">
          {q.isLoading ? (
            <div className="flex items-end justify-center gap-3">
              {[0,1,2].map((i) => (
                <div key={i} className="h-24 w-16 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : top3.length > 0 ? (
            <DiamondPodium top3={top3} />
          ) : (
            <EmptyRoyalState board={board} />
          )}
        </section>

        {/* Faceted list */}
        <section className="relative z-10 mt-6 px-4 pb-8">
          {!q.isLoading && list.length > 0 && (
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Rank · Champion</span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Coins</span>
            </div>
          )}
          {q.isLoading ? (
            <div className="space-y-2">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {rest.map((e, idx) => (
                <FacetedRow key={e.user_id} entry={e} accentIdx={idx} />
              ))}
            </ul>
          )}
        </section>
      </AppShell>
      <BottomNav />
    </>
  );
}

/* ---------- Diamond Podium ---------- */

function DiamondPodium({ top3 }: { top3: Entry[] }) {
  const [first, second, third] = top3;
  return (
    <div className="flex items-end justify-center gap-3">
      {second && <DiamondCell entry={second} place={2} />}
      {first  && <DiamondCell entry={first}  place={1} />}
      {third  && <DiamondCell entry={third}  place={3} />}
    </div>
  );
}

function DiamondCell({ entry, place }: { entry: Entry; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;
  const frame =
    place === 1 ? "from-[#fff2a8] via-[color:var(--gold)] to-[#8a6a1c]"
    : place === 2 ? "from-slate-200 via-slate-400 to-slate-600"
    : "from-[#f4c8a3] via-[#cd7f32] to-[#6b3a1a]";
  const rankPill =
    place === 1 ? "bg-[color:var(--gold)] text-black"
    : place === 2 ? "bg-slate-300 text-black"
    : "bg-[#cd7f32] text-white";
  const coinColor = isFirst ? "text-[color:var(--gold)]" : "text-[color:var(--primary)]";
  const boxSize = isFirst ? "h-24 w-24" : "h-16 w-16";
  const innerSize = isFirst ? "h-20 w-20" : "h-14 w-14";

  return (
    <Link
      to="/u/$userId"
      params={{ userId: entry.user_id }}
      className="flex min-w-0 flex-col items-center"
      style={{ transform: isFirst ? "scale(1.08)" : undefined }}
    >
      {/* Diamond frame */}
      <div className={`relative ${boxSize}`}>
        {isFirst && (
          <div className="absolute -inset-3 rounded-full bg-[color:var(--gold)]/25 blur-2xl animate-pulse" />
        )}
        <div className={`absolute inset-0 rotate-45 rounded-md bg-gradient-to-br ${frame} shadow-2xl`} />
        <div className="absolute inset-[3px] rotate-45 rounded-md bg-[#0a0514] overflow-hidden">
          <div className={`absolute inset-0 -rotate-45 grid place-items-center`}>
            <div className={`${innerSize} overflow-hidden rounded-full border border-white/10`}>
              {entry.avatar ? (
                <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-white/5 text-lg font-black text-white/70">
                  {(entry.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
        {isFirst && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Crown className="h-8 w-8 text-[color:var(--gold)] drop-shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
          </div>
        )}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-sm px-2 py-0.5 text-[9px] font-black tracking-widest ${rankPill}`}>
          {place === 1 ? "1ST" : place === 2 ? "2ND" : "3RD"}
        </div>
      </div>

      <p className={`mt-5 max-w-[90px] truncate text-[11px] font-black uppercase tracking-wide ${isFirst ? "text-white" : "text-white/80"}`}>
        @{entry.username ?? "user"}
      </p>
      <VipBadge level={entry.vip_level ?? 0} size="xs" className="mt-1" />
      <p className={`mt-1 text-[11px] font-black tracking-tight ${coinColor}`}>
        {formatCoins(entry.total_coins)}
      </p>
    </Link>
  );
}

/* ---------- Faceted rank row ---------- */

function FacetedRow({ entry, accentIdx }: { entry: Entry; accentIdx: number }) {
  const accents = ["var(--primary)", "var(--secondary)", "var(--gold)"];
  const accent = accents[accentIdx % accents.length];
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: entry.user_id }}
        className="relative block overflow-hidden transition active:scale-[0.99]"
      >
        <div
          className="absolute inset-0 border-l-2 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent"
          style={{
            borderColor: `color-mix(in oklab, ${accent} 70%, transparent)`,
            clipPath: "polygon(0 0, 96% 0, 100% 100%, 4% 100%)",
          }}
        />
        <div className="relative flex items-center gap-3 py-3 pl-5 pr-6">
          <span className="w-6 text-center text-sm font-black italic text-white/40">
            {String(entry.rnk).padStart(2, "0")}
          </span>
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
            {entry.avatar ? (
              <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold">{(entry.username ?? "?").slice(0,1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-black text-white">@{entry.username ?? "user"}</p>
              <VipBadge level={entry.vip_level ?? 0} size="xs" />
            </div>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              {entry.country ?? "Global"}
            </p>
          </div>
          <p className="shrink-0 text-sm font-black tracking-tight" style={{ color: `color-mix(in oklab, ${accent} 90%, white 10%)` }}>
            {formatCoins(entry.total_coins)}
          </p>
        </div>
      </Link>
    </li>
  );
}

/* ---------- Empty state ---------- */

function EmptyRoyalState({ board }: { board: Board }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 text-center">
      <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[color:var(--gold)]/15 blur-3xl" />
      <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center">
        <div className="absolute inset-0 rotate-45 rounded-md bg-gradient-to-br from-[#fff2a8] via-[color:var(--gold)] to-[#8a6a1c] shadow-2xl" />
        <div className="absolute inset-[3px] rotate-45 rounded-md bg-[#0a0514] grid place-items-center">
          <Trophy className="h-6 w-6 -rotate-0 text-[color:var(--gold)]" />
        </div>
      </div>
      <h2 className="text-lg font-black uppercase tracking-[0.25em] text-white">Throne Awaits</h2>
      <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-white/50">
        Send gifts to be the first on the {board} board — claim the diamond crown.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--primary)]">
        <Flame className="h-3 w-3" /> Season live
      </div>
    </div>
  );
}
