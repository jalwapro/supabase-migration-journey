import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Crown, Globe2, Users, Trophy, Flame, Gift, Mic2, Sparkles, TrendingUp, Zap } from "lucide-react";
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
  const [board,  setBoard]  = useState<Board>("gifters");
  const [period, setPeriod] = useState<Period>("daily");
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

  // Realtime refresh on new gifts (debounced)
  const qc = useQueryClient();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        qc.invalidateQueries({ queryKey: ["vip-rank"] });
      }, 1500);
    };
    const channel = supabase
      .channel("rank-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_events" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const list = q.data ?? [];
  const champion = list[0];
  const runners  = list.slice(1, 3);
  const rest     = list.slice(3);

  return (
    <>
      <AppShell title="Rankings" subtitle="">
        <div className="relative min-h-full overflow-hidden" style={BODY}>
          {/* Neon arena backdrop */}
          <ArenaBackdrop />

          <div className="relative z-10 px-3 pb-6 pt-2">
            {/* ── Board Tabs ── */}
            <BoardTabs board={board} setBoard={setBoard} />

            {/* ── Period Segmented Bar ── */}
            <div className="mt-3 mb-2">
              <PeriodBar period={period} setPeriod={setPeriod} />
            </div>

            {/* ── Scope chips + Countdown ── */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <ScopeChips scope={scope} setScope={setScope} country={profile?.country} />
              <CountdownPill period={period} />
            </div>

            {/* ═════════════ HERO CHAMPION ═════════════ */}
            {q.isLoading ? (
              <ChampionSkeleton />
            ) : champion ? (
              <ChampionCard entry={champion} board={board} />
            ) : (
              <EmptyThrone board={board} />
            )}

            {/* ═════════════ RUNNERS UP GRID ═════════════ */}
            {runners.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {runners.map((e, i) => (
                  <RunnerCard key={e.user_id} entry={e} place={(i + 2) as 2 | 3} />
                ))}
              </div>
            )}

            {/* ── Section separator ── */}
            <SectionBar label={board === "gifters" ? "Top Gifters" : "Top Hosts"} count={rest.length} />

            {/* ── Ranks 4+ grid ── */}
            {q.isLoading ? (
              <div className="grid gap-2">
                {[0,1,2,3,4].map((i) => (
                  <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : rest.length > 0 ? (
              <ul className="space-y-2">
                {rest.map((e) => <RankRow key={e.user_id} entry={e} />)}
              </ul>
            ) : list.length > 0 ? null : null}

            {/* ── Reward footer ── */}
            {list.length > 0 && <RewardFooter board={board} period={period} />}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

/* ══════════ ARENA BACKDROP ══════════ */
function ArenaBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Radial glow anchors */}
      <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.35)_0%,rgba(139,92,246,0.18)_35%,transparent_70%)]" />
      <div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.35),transparent_70%)] blur-2xl" />
      <div className="absolute top-96 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.28),transparent_70%)] blur-2xl" />
      {/* Grid floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-64 opacity-25"
        style={{
          background:
            "linear-gradient(180deg,transparent,rgba(139,92,246,0.35)),repeating-linear-gradient(90deg,rgba(236,72,153,0.35) 0 1px,transparent 1px 32px),repeating-linear-gradient(0deg,rgba(236,72,153,0.35) 0 1px,transparent 1px 32px)",
          maskImage: "linear-gradient(180deg,transparent 0%,black 100%)",
        }}
      />
      {/* Floating sparks */}
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-[#ffcf6a] shadow-[0_0_8px_rgba(255,207,106,0.9)] animate-pulse"
          style={{
            top: `${(i * 37) % 90}%`,
            left: `${(i * 53) % 95}%`,
            animationDelay: `${(i % 6) * 0.3}s`,
            animationDuration: `${2 + (i % 4)}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ══════════ BOARD TABS ══════════ */
function BoardTabs({ board, setBoard }: { board: Board; setBoard: (b: Board) => void }) {
  return (
    <div className="relative flex rounded-2xl border border-white/10 bg-black/45 p-1 backdrop-blur-lg">
      <span
        className="pointer-events-none absolute inset-y-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300"
        style={{
          left: board === "gifters" ? 4 : "calc(50% + 0px)",
          background: "linear-gradient(135deg,#ec4899 0%,#a855f7 60%,#7c3aed 100%)",
          boxShadow: "0 8px 30px -6px rgba(236,72,153,0.6), inset 0 1px 0 rgba(255,255,255,0.35)",
        }}
      />
      {([
        { k: "gifters", label: "GIFTERS", Icon: Gift },
        { k: "hosts",   label: "HOSTS",   Icon: Mic2 },
      ] as { k: Board; label: string; Icon: typeof Gift }[]).map(({ k, label, Icon }) => {
        const active = board === k;
        return (
          <button
            key={k}
            onClick={() => setBoard(k)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 py-2.5 text-[13px] tracking-[0.15em] transition ${
              active ? "text-white" : "text-white/50"
            }`}
            style={HEADING}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════ PERIOD BAR ══════════ */
function PeriodBar({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  const items: { k: Period; label: string }[] = [
    { k: "daily",   label: "24H"  },
    { k: "weekly",  label: "WEEK" },
    { k: "monthly", label: "MONTH"},
    { k: "yearly",  label: "YEAR" },
    { k: "all",     label: "ALL"  },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {items.map(({ k, label }) => {
        const active = period === k;
        return (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] tracking-[0.18em] transition ${
              active
                ? "bg-gradient-to-r from-[#ffe08a] via-[#ffcf6a] to-[#c48a1a] text-[#2a0f00] shadow-[0_6px_18px_rgba(255,207,106,0.45)]"
                : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"
            }`}
            style={HEADING}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════ SCOPE CHIPS ══════════ */
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
                ? "bg-white/15 text-white border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                : "bg-black/30 text-white/50 border border-white/8"
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

/* ══════════ COUNTDOWN PILL ══════════ */
function CountdownPill({ period }: { period: Period }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (period === "all") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#ffcf6a]/40 bg-black/40 px-2.5 py-1 text-[10px] tracking-[0.2em] text-[#ffcf6a]" style={HEADING}>
        ∞ FOREVER
      </span>
    );
  }

  const d = new Date(now);
  let end: Date;
  if (period === "daily") end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
  else if (period === "weekly") {
    const day = d.getDay();
    const daysToMon = (8 - day) % 7 || 7;
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysToMon, 0, 0, 0);
  } else if (period === "monthly") end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0);
  else end = new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0);

  const diff = Math.max(0, end.getTime() - now);
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff4d94]/45 bg-black/60 px-2.5 py-1 text-[10px] tracking-[0.18em] text-white shadow-[0_0_16px_-4px_rgba(255,77,148,0.7)]" style={HEADING}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff4d94] shadow-[0_0_8px_#ff4d94]" />
      {pad(hh)}:{pad(mm)}:{pad(ss)}
    </span>
  );
}

/* ══════════ HERO CHAMPION CARD ══════════ */
function ChampionCard({ entry, board }: { entry: Entry; board: Board }) {
  return (
    <Link
      to="/u/$userId"
      params={{ userId: entry.user_id }}
      className="relative block overflow-hidden rounded-[26px] border border-[#ffcf6a]/40 shadow-[0_25px_60px_-15px_rgba(236,72,153,0.55)]"
      style={{
        background:
          "linear-gradient(140deg,#3a0a4a 0%,#5c1170 35%,#8d1a5c 65%,#c22a56 100%)",
      }}
    >
      {/* Beam sweep */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 bg-[radial-gradient(circle,rgba(255,220,140,0.55),transparent_60%)] blur-2xl" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "repeating-linear-gradient(115deg,rgba(255,255,255,0.08) 0 2px,transparent 2px 14px)",
        }}/>
      </div>

      {/* CHAMPION Banner */}
      <div className="relative flex items-center justify-between px-5 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] tracking-[0.25em] text-[#ffe08a] border border-[#ffcf6a]/40" style={HEADING}>
          <Crown className="h-3 w-3 fill-current" /> CHAMPION
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] tracking-[0.2em] text-white border border-white/15" style={HEADING}>
          <Zap className="h-3 w-3" /> LIVE
        </span>
      </div>

      {/* Avatar + laurels */}
      <div className="relative mt-3 flex justify-center">
        {/* Laurel wreath simulation */}
        <div className="absolute inset-x-0 top-3 mx-auto h-32 w-32 rounded-full border-[3px] border-[#ffcf6a]/25 [mask-image:linear-gradient(180deg,black,transparent)]" />
        <div className="relative h-28 w-28">
          <div
            className="absolute inset-0 rounded-full p-[3px] animate-[spin_10s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg,#ffe8a8,#ec4899,#a855f7,#ffe8a8,#ec4899,#a855f7,#ffe8a8)",
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-full border-4 border-[#1a0522] bg-[#0a0514]">
              {entry.avatar ? (
                <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl text-white/80" style={HEADING}>
                  {(entry.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          {/* #1 medallion */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="rounded-full bg-gradient-to-b from-[#ffe08a] to-[#c48a1a] px-3 py-0.5 text-[12px] text-[#2a0f00] shadow-[0_4px_12px_rgba(255,207,106,0.55)] border border-[#3a1e00]/40" style={HEADING}>
              #1
            </div>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="relative mt-4 px-5 text-center">
        <p className="truncate text-[22px] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" style={HEADING}>
          {entry.username ?? "user"}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <VipBadge level={entry.vip_level ?? 0} size="sm" />
          {entry.country && (
            <span className="rounded-md bg-black/40 px-2 py-0.5 text-[10px] tracking-[0.12em] text-white/70 border border-white/10" style={HEADING}>
              {entry.country.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Coin trophy */}
      <div className="relative mt-4 flex items-center justify-center gap-2 px-5 pb-5">
        <div className="flex items-center gap-2 rounded-2xl border border-[#ffcf6a]/40 bg-black/50 px-4 py-2 backdrop-blur">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[11px] text-[#2a0f00]" style={HEADING}>$</span>
          <span className="text-[20px] text-[#ffe08a] drop-shadow-[0_0_12px_rgba(255,207,106,0.6)]" style={HEADING}>
            {formatCoins(entry.total_coins)}
          </span>
          <span className="text-[10px] tracking-[0.2em] text-white/50" style={HEADING}>
            {board === "gifters" ? "SENT" : "EARNED"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ChampionSkeleton() {
  return <div className="h-[340px] animate-pulse rounded-[26px] bg-white/5" />;
}

/* ══════════ RUNNER-UP CARD ══════════ */
function RunnerCard({ entry, place }: { entry: Entry; place: 2 | 3 }) {
  const theme =
    place === 2
      ? {
          bg: "linear-gradient(150deg,#1c1830 0%,#2b2154 45%,#4a3aa8 100%)",
          accent: "#a5b8ff",
          ring: "conic-gradient(from 210deg,#4a5bbf,#c9d3ff,#7188dc,#4a5bbf,#c9d3ff)",
          glow: "rgba(122,148,255,0.5)",
          label: "#2",
        }
      : {
          bg: "linear-gradient(150deg,#2a1005 0%,#5a2010 45%,#c94a1a 100%)",
          accent: "#ffbe8a",
          ring: "conic-gradient(from 210deg,#a83d10,#ffcfa3,#e07640,#a83d10,#ffcfa3)",
          glow: "rgba(255,140,80,0.45)",
          label: "#3",
        };

  return (
    <Link
      to="/u/$userId"
      params={{ userId: entry.user_id }}
      className="relative block overflow-hidden rounded-2xl border border-white/10 p-3 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]"
      style={{ background: theme.bg, boxShadow: `0 10px 30px -10px ${theme.glow}` }}
    >
      <div className="flex items-start justify-between">
        <span
          className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] tracking-[0.18em] border"
          style={{ ...HEADING, color: theme.accent, borderColor: `${theme.accent}55` }}
        >
          {theme.label}
        </span>
        <Crown className="h-4 w-4 opacity-70" style={{ color: theme.accent }} fill="currentColor" strokeWidth={0.8} />
      </div>

      <div className="mt-1 flex justify-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full p-[2px]" style={{ background: theme.ring }}>
            <div className="h-full w-full overflow-hidden rounded-full border-2 border-black/50 bg-[#0a0514]">
              {entry.avatar ? (
                <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-lg text-white/80" style={HEADING}>
                  {(entry.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 truncate text-center text-[12px] text-white" style={HEADING}>
        {entry.username ?? "user"}
      </p>
      <div className="mt-1 flex justify-center">
        <VipBadge level={entry.vip_level ?? 0} size="xs" />
      </div>
      <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-black/45 px-2 py-1 border border-white/10">
        <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[8px] text-[#2a0f00]" style={HEADING}>$</span>
        <span className="text-[12px]" style={{ ...HEADING, color: theme.accent }}>
          {formatCoins(entry.total_coins)}
        </span>
      </div>
    </Link>
  );
}

/* ══════════ SECTION BAR ══════════ */
function SectionBar({ label, count }: { label: string; count: number }) {
  return (
    <div className="mt-5 mb-2.5 flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-[#ffcf6a]/40 bg-black/45 px-3 py-1 text-[10px] tracking-[0.22em] text-[#ffe08a]"
        style={HEADING}
      >
        <TrendingUp className="h-3 w-3" strokeWidth={2.5} /> {label.toUpperCase()}
      </span>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#ffcf6a]/40 via-[#ec4899]/25 to-transparent" />
      {count > 0 && (
        <span className="text-[10px] tracking-widest text-white/40" style={HEADING}>{count}</span>
      )}
    </div>
  );
}

/* ══════════ RANK ROW (4+) ══════════ */
function RankRow({ entry }: { entry: Entry }) {
  const isTopTen = entry.rnk <= 10;
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: entry.user_id }}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 backdrop-blur transition active:scale-[0.99] hover:border-[#ec4899]/40"
      >
        {/* Rank number capsule */}
        <div
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
          style={
            isTopTen
              ? {
                  background: "linear-gradient(160deg,#ec4899,#a855f7)",
                  borderColor: "rgba(255,207,106,0.5)",
                  boxShadow: "0 4px 14px -4px rgba(236,72,153,0.6)",
                }
              : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }
          }
        >
          <span
            className={`text-[14px] leading-none ${isTopTen ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" : "text-white/60"}`}
            style={HEADING}
          >
            {entry.rnk}
          </span>
        </div>

        {/* Avatar */}
        <div className="relative h-11 w-11 shrink-0">
          <div
            className="absolute inset-0 rounded-full p-[2px]"
            style={{
              background: isTopTen
                ? "conic-gradient(from 210deg,#ec4899,#ffe8a8,#a855f7,#ec4899,#ffe8a8)"
                : "linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))",
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-full border border-black/40 bg-[#0a0514]">
              {entry.avatar ? (
                <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-white/70" style={HEADING}>
                  {(entry.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Name + VIP */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white" style={HEADING}>{entry.username ?? "user"}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <VipBadge level={entry.vip_level ?? 0} size="xs" />
            {entry.country && (
              <span className="rounded-sm bg-black/40 px-1 py-0.5 text-[9px] tracking-[0.1em] text-white/55" style={HEADING}>
                {entry.country.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Coins */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[14px] text-white" style={HEADING}>{formatCoins(entry.total_coins)}</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[9px] text-[#2a0f00]" style={HEADING}>$</span>
        </div>
      </Link>
    </li>
  );
}

/* ══════════ REWARD FOOTER ══════════ */
function RewardFooter({ board, period }: { board: Board; period: Period }) {
  const periodLabel =
    period === "daily" ? "Daily" :
    period === "weekly" ? "Weekly" :
    period === "monthly" ? "Monthly" :
    period === "yearly" ? "Yearly" : "All-time";
  const badgeName = board === "gifters" ? "Champion" : "Boss";

  return (
    <div
      className="relative mt-5 overflow-hidden rounded-2xl border border-[#ffcf6a]/35 p-3.5"
      style={{
        background:
          "linear-gradient(120deg,rgba(58,10,74,0.85) 0%,rgba(140,26,92,0.7) 55%,rgba(58,10,74,0.85) 100%)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-6 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,180,60,0.4),transparent_65%)] blur-xl" />
        <div className="absolute -right-6 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.35),transparent_65%)] blur-xl" />
      </div>
      <div className="relative flex items-center gap-3">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#ffe08a] to-[#8a4a10] shadow-[0_4px_18px_rgba(255,180,80,0.5)]">
          <Trophy className="h-6 w-6 text-[#2a0f00]" strokeWidth={2.4} />
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[14px] leading-none">👑</span>
        </div>
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-white/90" style={BODY}>
          <span className="text-[#ffe08a]" style={HEADING}>{periodLabel} #1</span>{" "}
          {board === "gifters" ? "gifter" : "host"} unlocks the{" "}
          <span className="text-white" style={HEADING}>{badgeName}</span> badge
          <span className="text-white/60"> · room aura + profile crown</span>
        </p>
      </div>
    </div>
  );
}

/* ══════════ EMPTY THRONE ══════════ */
function EmptyThrone({ board }: { board: Board }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-[#ffcf6a]/25 p-8 text-center backdrop-blur"
      style={{ background: "linear-gradient(140deg,#1a0730 0%,#2b0a48 100%)" }}
    >
      <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#ec4899]/25 blur-3xl" />
      <div className="relative mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-[#ffe08a] to-[#7a5210] p-[3px]">
        <div className="grid h-full w-full place-items-center rounded-full bg-[#0a0514]">
          <Trophy className="h-8 w-8 text-[#ffcf6a]" />
        </div>
      </div>
      <h2 className="text-lg tracking-[0.25em] text-white" style={HEADING}>THRONE AWAITS</h2>
      <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-white/60" style={BODY}>
        Send gifts to claim the crown on the {board} board.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#ff3b8c]/40 bg-[#ff3b8c]/10 px-3 py-1 text-[10px] tracking-[0.2em] text-[#ff88b8]" style={HEADING}>
        <Flame className="h-3 w-3" /> SEASON LIVE
      </div>
    </div>
  );
}
