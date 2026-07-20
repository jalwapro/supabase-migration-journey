import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Globe2, Users, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { VipBadge } from "@/components/vip/VipBadge";
import { formatCoins } from "@/lib/vip-levels";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({
    meta: [
      { title: "Rankings — Jalwa" },
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

const HEADING = { fontFamily: "'Archivo Black', system-ui, sans-serif" } as const;
const BODY = { fontFamily: "'Hind', system-ui, sans-serif" } as const;

function RankPage() {
  const { profile } = useAuth();
  const [board, setBoard]   = useState<Board>("gifters");
  const [period, setPeriod] = useState<Period>("weekly");
  const [scope, setScope]   = useState<Scope>("global");

  const scopeValue = scope === "country" ? profile?.country ?? null : null;

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

  // Realtime refresh on new gifts (debounced)
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const bump = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        qc.invalidateQueries({ queryKey: ["vip-rank"] });
      }, 1500);
    };
    const ch = supabase.channel("rank-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_events" }, bump)
      .subscribe();
    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const list = q.data ?? [];
  const c1 = list[0]; const c2 = list[1]; const c3 = list[2];
  const rest = list.slice(3);

  return (
    <>
      <AppShell title="" subtitle="">
        <div className="relative min-h-full overflow-hidden bg-[#0a0a0f]" style={BODY}>
          {/* Ambient glows */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 left-1/4 h-64 w-64 rounded-full bg-[#ff2d95]/15 blur-[100px]" />
            <div className="absolute top-40 -right-10 h-52 w-52 rounded-full bg-[#8b5cf6]/15 blur-[80px]" />
            <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,45,149,0.08),transparent_70%)]" />
          </div>

          <div className="relative z-10 flex flex-col">
            {/* Header */}
            <div className="px-5 pt-6 pb-3 space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl uppercase italic tracking-tighter text-white" style={HEADING}>
                  Rankings
                </h1>
                <div className="flex p-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                  {(["gifters","hosts"] as Board[]).map((k) => {
                    const active = board === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setBoard(k)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition ${
                          active
                            ? "bg-gradient-to-r from-[#ff2d95] to-[#8b5cf6] text-white shadow-lg"
                            : "text-white/40 hover:text-white"
                        }`}
                        style={HEADING}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Period bar */}
              <div className="flex justify-between items-center bg-black/40 rounded-2xl p-1.5 border border-white/5">
                {([
                  { k: "daily",   label: "24H"   },
                  { k: "weekly",  label: "Week"  },
                  { k: "monthly", label: "Month" },
                  { k: "yearly",  label: "Year"  },
                  { k: "all",     label: "All"   },
                ] as { k: Period; label: string }[]).map(({ k, label }) => {
                  const active = period === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setPeriod(k)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition rounded-xl ${
                        active
                          ? "text-white bg-white/10 border border-white/10 shadow-inner"
                          : "text-white/40 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Scope chips + countdown */}
              <div className="flex items-center justify-between gap-2">
                <ScopeChips scope={scope} setScope={setScope} country={profile?.country} />
                <CountdownPill period={period} />
              </div>
            </div>

            {/* Podium */}
            <div className="px-5 py-4 flex items-end justify-center gap-3">
              <PodiumSide entry={c2} place={2} />
              <PodiumCenter entry={c1} />
              <PodiumSide entry={c3} place={3} />
            </div>

            {/* List container */}
            <div className="flex-1 bg-black/60 backdrop-blur-md rounded-t-[48px] border-t border-white/10 p-5 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pb-28">
              <div className="flex px-3 py-2 text-[10px] uppercase text-white/30 tracking-[0.2em]" style={HEADING}>
                <span className="w-10">Pos</span>
                <span className="flex-1">Challenger</span>
                <span className="text-right">Score</span>
              </div>

              {q.isLoading ? (
                <div className="space-y-2.5">
                  {[0,1,2,3,4].map((i) => (
                    <div key={i} className="h-[68px] animate-pulse rounded-3xl bg-white/5" />
                  ))}
                </div>
              ) : rest.length > 0 ? (
                <ul className="space-y-2.5">
                  {rest.map((e) => <RankRow key={e.user_id} entry={e} board={board} />)}
                </ul>
              ) : list.length === 0 ? (
                <EmptyState board={board} />
              ) : null}
            </div>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

/* ── Scope chips ── */
function ScopeChips({
  scope, setScope, country,
}: { scope: Scope; setScope: (s: Scope) => void; country?: string | null }) {
  const items: { k: Scope; label: string; Icon: typeof Globe2 }[] = [
    { k: "global",  label: "Global", Icon: Globe2 },
    { k: "country", label: country || "Country", Icon: Sparkles },
    { k: "family",  label: "Family", Icon: Users },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ k, label, Icon }) => {
        const active = scope === k;
        const disabled = k === "country" && !country;
        return (
          <button
            key={k}
            disabled={disabled}
            onClick={() => setScope(k)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] tracking-[0.14em] transition disabled:opacity-30 ${
              active
                ? "bg-white/15 text-white border border-white/25"
                : "bg-black/30 text-white/50 border border-white/10"
            }`}
            style={HEADING}
          >
            <Icon className="h-3 w-3" strokeWidth={2.5} /> {label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

/* ── Countdown pill ── */
function CountdownPill({ period }: { period: Period }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (period === "all") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#fbbf24]/40 bg-black/40 px-2.5 py-1 text-[10px] tracking-[0.2em] text-[#fbbf24]" style={HEADING}>
        ∞ FOREVER
      </span>
    );
  }
  const d = new Date(now);
  let end: Date;
  if (period === "daily") end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  else if (period === "weekly") {
    const day = d.getDay();
    const daysToMon = (8 - day) % 7 || 7;
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysToMon);
  } else if (period === "monthly") end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  else end = new Date(d.getFullYear() + 1, 0, 1);
  const diff = Math.max(0, end.getTime() - now);
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff2d95]/45 bg-black/60 px-2.5 py-1 text-[10px] tracking-[0.18em] text-white shadow-[0_0_16px_-4px_rgba(255,45,149,0.7)]" style={HEADING}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff2d95] shadow-[0_0_8px_#ff2d95]" />
      {pad(hh)}:{pad(mm)}:{pad(ss)}
    </span>
  );
}

/* ── Podium sides (#2 / #3) ── */
function PodiumSide({ entry, place }: { entry?: Entry; place: 2 | 3 }) {
  const theme = place === 2
    ? { border: "border-violet-500/30", chip: "bg-violet-500 text-white", rot: "rotate-[-4deg]", chipRot: "rotate-[4deg]", chipPos: "-top-2 -left-2", num: "text-[#8b5cf6]", glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]" }
    : { border: "border-amber-500/30", chip: "bg-amber-500 text-black", rot: "rotate-[4deg]",  chipRot: "rotate-[-4deg]", chipPos: "-top-2 -right-2", num: "text-[#fbbf24]", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]" };

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center gap-3 opacity-40">
        <div className={`w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-xl border ${theme.border} ${theme.rot} ${theme.glow} grid place-items-center`}>
          <span className="text-2xl text-white/30" style={HEADING}>{place}</span>
        </div>
        <p className="text-white/40 text-xs">—</p>
      </div>
    );
  }
  const initial = (entry.username ?? "?").slice(0, 1).toUpperCase();
  return (
    <Link to="/u/$userId" params={{ userId: entry.user_id }} className="flex-1 flex flex-col items-center gap-3">
      <div className="relative">
        <div className={`w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-xl border ${theme.border} p-1.5 ${theme.rot} ${theme.glow}`}>
          <div className="w-full h-full rounded-xl overflow-hidden bg-[#1a1a25] grid place-items-center">
            {entry.avatar
              ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              : <span className="text-2xl text-white/70" style={HEADING}>{initial}</span>}
          </div>
          <div className={`absolute ${theme.chipPos} w-8 h-8 ${theme.chip} flex items-center justify-center text-xs rounded-lg shadow-lg ${theme.chipRot}`} style={HEADING}>
            {place}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-sm tracking-tight truncate max-w-[92px]" style={BODY}>{entry.username ?? "user"}</p>
        <p className={`text-[10px] uppercase tracking-widest ${theme.num}`} style={HEADING}>{formatCoins(entry.total_coins)}</p>
      </div>
    </Link>
  );
}

/* ── Podium center (#1) ── */
function PodiumCenter({ entry }: { entry?: Entry }) {
  if (!entry) {
    return (
      <div className="flex-[1.2] flex flex-col items-center gap-4 -mt-6 opacity-50">
        <div className="w-28 h-28 rounded-3xl border-2 border-[#ff2d95]/40 grid place-items-center bg-white/5">
          <span className="text-4xl text-white/40" style={HEADING}>1</span>
        </div>
        <p className="text-white/50 text-sm uppercase" style={HEADING}>Throne awaits</p>
      </div>
    );
  }
  const initial = (entry.username ?? "?").slice(0, 1).toUpperCase();
  return (
    <Link to="/u/$userId" params={{ userId: entry.user_id }} className="flex-[1.2] flex flex-col items-center gap-4 -mt-6">
      <div className="relative">
        <div className="absolute -inset-4 bg-[#ff2d95]/20 blur-2xl rounded-full animate-pulse" />
        <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-2xl border-2 border-[#ff2d95] p-2 shadow-[0_0_30px_rgba(255,45,149,0.3)] relative">
          <div className="w-full h-full rounded-2xl overflow-hidden bg-[#1a1a25] grid place-items-center">
            {entry.avatar
              ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              : <span className="text-4xl text-white/80" style={HEADING}>{initial}</span>}
          </div>
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
            <svg className="w-10 h-10 fill-[#fbbf24]" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z" />
            </svg>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#ff2d95] flex items-center justify-center text-sm text-white px-4 py-1 rounded-full shadow-[0_4px_15px_rgba(255,45,149,0.5)] border-2 border-[#0a0a0f]" style={HEADING}>
            1
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white text-lg italic tracking-tight uppercase leading-none truncate max-w-[160px]" style={HEADING}>
          {entry.username ?? "user"}
        </p>
        <p className="text-[#ff2d95] text-[11px] uppercase tracking-[0.2em] mt-1" style={HEADING}>
          {formatCoins(entry.total_coins)} PTS
        </p>
        <div className="mt-1.5 flex justify-center">
          <VipBadge level={entry.vip_level ?? 0} size="xs" />
        </div>
      </div>
    </Link>
  );
}

/* ── Row 4+ ── */
function RankRow({ entry, board }: { entry: Entry; board: Board }) {
  const initial = (entry.username ?? "?").slice(0, 1).toUpperCase();
  const accent = board === "gifters" ? "#ff2d95" : "#8b5cf6";
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: entry.user_id }}
        className="group flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/5 hover:border-[#ff2d95]/30 transition-all"
      >
        <div className="w-8 italic text-white/25 text-lg" style={HEADING}>
          {String(entry.rnk).padStart(2, "0")}
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 p-1 shrink-0">
          <div className="w-full h-full rounded-xl overflow-hidden bg-[#1a1a25] grid place-items-center">
            {entry.avatar
              ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              : <span className="text-sm text-white/70" style={HEADING}>{initial}</span>}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate" style={BODY}>
            {entry.username ?? "user"}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <VipBadge level={entry.vip_level ?? 0} size="xs" />
            {entry.country && (
              <span className="rounded-sm bg-black/40 px-1 py-0.5 text-[9px] tracking-[0.1em] text-white/55" style={HEADING}>
                {entry.country.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white text-sm tracking-tighter" style={HEADING}>
            {formatCoins(entry.total_coins)}
          </p>
          <p className="text-[9px] uppercase tracking-widest opacity-60" style={{ ...HEADING, color: accent }}>
            Points
          </p>
        </div>
      </Link>
    </li>
  );
}

/* ── Empty state ── */
function EmptyState({ board }: { board: Board }) {
  return (
    <div className="mt-6 mx-auto max-w-[280px] text-center py-10">
      <div className="mx-auto mb-4 w-16 h-16 rounded-2xl border border-[#ff2d95]/40 bg-white/5 grid place-items-center">
        <span className="text-2xl">👑</span>
      </div>
      <p className="text-white text-sm uppercase tracking-[0.2em]" style={HEADING}>Throne awaits</p>
      <p className="text-white/50 text-xs mt-2" style={BODY}>
        Send gifts to claim the crown on the {board} board.
      </p>
    </div>
  );
}
