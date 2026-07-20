import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Crown, Globe2, Users, Trophy, Flame, Gift, Mic2, Sparkles } from "lucide-react";
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

  // Realtime: refresh leaderboard when new gifts arrive
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
  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <>
      <AppShell title="Rankings" subtitle="">
        {/* ═══════ GOLDEN THEATER STAGE ═══════ */}
        <div className="relative overflow-hidden">
          {/* Curtain rays */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,_#c8802a_0%,_#7a3d0a_28%,_#2a0f04_62%,_transparent_85%)]" />
            <div className="absolute inset-x-0 top-0 h-[520px] opacity-70 mix-blend-screen"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, rgba(255,190,90,0.14) 0 2px, transparent 2px 22px)",
              }}
            />
            {/* light beams */}
            <div className="absolute left-1/2 top-0 h-[420px] w-[280px] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_0deg,rgba(255,220,150,0.35)_18deg,transparent_36deg,rgba(255,220,150,0.25)_54deg,transparent_72deg)] blur-[2px]" />
          </div>

          {/* ── Board segmented ── */}
          <div className="relative z-10 px-6 pt-3">
            <div className="mx-auto flex w-fit gap-6">
              {([
                { k: "gifters", label: "Gifters", Icon: Gift },
                { k: "hosts",   label: "Hosts",   Icon: Mic2 },
              ] as { k: Board; label: string; Icon: typeof Gift }[]).map(({ k, label, Icon }) => {
                const active = board === k;
                return (
                  <button
                    key={k}
                    onClick={() => setBoard(k)}
                    className={`relative pb-1.5 text-[15px] font-bold transition ${
                      active ? "text-white" : "text-white/45"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-4 w-4" strokeWidth={2.4} /> {label}
                    </span>
                    {active && (
                      <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Period pill row ── */}
          <div className="relative z-10 mt-4 flex justify-center gap-1.5 px-4">
            {([
              { k: "daily",   label: "Daily" },
              { k: "weekly",  label: "Weekly" },
              { k: "monthly", label: "Monthly" },
              { k: "yearly",  label: "Yearly" },
              { k: "all",     label: "All" },
            ] as { k: Period; label: string }[]).map(({ k, label }) => {
              const active = period === k;
              return (
                <button
                  key={k}
                  onClick={() => setPeriod(k)}
                  className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${
                    active
                      ? "bg-white text-black shadow-[0_4px_14px_rgba(255,220,150,0.35)]"
                      : "bg-white/8 text-white/60"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* ── Scope chips ── */}
          <div className="relative z-10 mt-3 flex justify-center gap-2 px-4">
            {([
              { k: "global",  label: "Global",  Icon: Globe2 },
              { k: "country", label: profile?.country || "Country", Icon: Sparkles },
              { k: "family",  label: "Family",  Icon: Users },
            ] as { k: Scope; label: string; Icon: typeof Globe2 }[]).map(({ k, label, Icon }) => {
              const active = scope === k;
              const disabled = k === "country" && !profile?.country;
              return (
                <button
                  key={k}
                  disabled={disabled}
                  onClick={() => setScope(k)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-30 ${
                    active
                      ? "border-[color:var(--gold)]/70 bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                      : "border-white/10 bg-white/[0.04] text-white/50"
                  }`}
                >
                  <Icon className="h-3 w-3" strokeWidth={2.5} /> {label}
                </button>
              );
            })}
          </div>

          {/* ── Podium ── */}
          <section className="relative z-10 px-4 pb-2 pt-6">
            {q.isLoading ? (
              <div className="flex items-end justify-center gap-4">
                {[0,1,2].map((i) => (
                  <div key={i} className={`animate-pulse rounded-xl bg-white/5 ${i===1?'h-40 w-24':'h-32 w-20'}`} />
                ))}
              </div>
            ) : top3.length > 0 ? (
              <StagePodium top3={top3} />
            ) : (
              <EmptyRoyalState board={board} />
            )}
          </section>

          {/* Ornate golden divider */}
          <div className="relative z-10 mt-2">
            <div className="mx-auto h-[2px] w-[92%] bg-gradient-to-r from-transparent via-[color:var(--gold)] to-transparent opacity-70" />
            <div className="mx-auto -mt-[9px] flex w-fit items-center gap-2 rounded-full bg-[#1a0b04] px-3">
              <span className="text-[color:var(--gold)]">◆</span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[color:var(--gold)]/80">Champions</span>
              <span className="text-[color:var(--gold)]">◆</span>
            </div>
          </div>
        </div>

        {/* ═══════ REWARD BANNER + COUNTDOWN ═══════ */}
        <section className="relative z-10 -mt-1 rounded-t-[26px] bg-[#100416] px-4 pb-2 pt-5">
          <RewardBanner board={board} period={period} />
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
              {board === "gifters" ? "Gifters" : "Hosts"} · {period}
            </span>
            <CountdownStrip period={period} />
          </div>
        </section>

        {/* ═══════ RANKS 4+ LIST ═══════ */}
        <section className="relative z-10 bg-[#100416] px-4 pb-8 pt-4">
          {q.isLoading ? (
            <div className="space-y-2">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {rest.map((e) => (
                <StageRow key={e.user_id} entry={e} />
              ))}
            </ul>
          )}
        </section>

      </AppShell>
      <BottomNav />
    </>
  );
}

/* ══════════ STAGE PODIUM (Behance style) ══════════ */

function StagePodium({ top3 }: { top3: Entry[] }) {
  const [first, second, third] = top3;
  return (
    <div className="flex items-end justify-center gap-3">
      {second && <PodiumTile entry={second} place={2} />}
      {first  && <PodiumTile entry={first}  place={1} />}
      {third  && <PodiumTile entry={third}  place={3} />}
    </div>
  );
}

function PodiumTile({ entry, place }: { entry: Entry; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;
  // Crown & banner palette per rank
  const banner =
    place === 1 ? "from-[#8b3aa5] via-[#5a1e7e] to-[#3a0f5a]"     // purple
    : place === 2 ? "from-[#2c6df0] via-[#1948b8] to-[#0a2560]"    // royal blue
    : "from-[#e8873a] via-[#a34a10] to-[#5a2404]";                 // amber
  const avatarSize = isFirst ? "h-24 w-24" : "h-20 w-20";

  return (
    <Link
      to="/u/$userId"
      params={{ userId: entry.user_id }}
      className="flex flex-col items-center"
      style={{ transform: isFirst ? "translateY(-14px)" : undefined }}
    >
      {/* Crown */}
      <div className="relative">
        <Crown
          className={`${isFirst ? "h-11 w-11" : "h-8 w-8"} text-[color:var(--gold)] drop-shadow-[0_0_12px_rgba(255,200,80,0.85)]`}
          fill="currentColor"
          strokeWidth={1}
        />
        {isFirst && (
          <div className="absolute -inset-3 rounded-full bg-[color:var(--gold)]/25 blur-2xl animate-pulse" />
        )}
      </div>

      {/* Avatar with golden ring */}
      <div className={`relative -mt-1 ${avatarSize}`}>
        {/* outer ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#ffe8a8] via-[color:var(--gold)] to-[#7a5210] p-[3px] shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
          <div className="h-full w-full overflow-hidden rounded-full border-2 border-[#2a1002] bg-[#0a0514]">
            {entry.avatar ? (
              <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-black text-white/70">
                {(entry.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner (TOP N) */}
      <div className="relative mt-2">
        <div className={`relative bg-gradient-to-b ${banner} px-5 py-1 shadow-[0_6px_14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.2)]`}
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)" }}
        >
          <p className="text-[11px] font-black tracking-[0.28em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            TOP&nbsp;{place}
          </p>
        </div>
      </div>

      {/* Name + coins */}
      <p className={`mt-2 max-w-[100px] truncate text-center text-[12px] font-black text-white/95 ${isFirst ? "" : "opacity-90"}`}>
        {entry.username ?? "user"}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <VipBadge level={entry.vip_level ?? 0} size="xs" />
        {entry.country && <span className="text-[10px]">{entry.country}</span>}
      </div>
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur">
        <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[8px] font-black text-[#3a1e00]">$</span>
        <span className="text-[11px] font-black text-[color:var(--gold)]">{formatCoins(entry.total_coins)}</span>
      </div>
    </Link>
  );
}

/* ══════════ RANK ROW (4+) ══════════ */

function StageRow({ entry }: { entry: Entry }) {
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: entry.user_id }}
        className="relative flex items-center gap-3 rounded-2xl border border-white/8 bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5 transition active:scale-[0.99]"
      >
        {/* Rank number */}
        <span className="w-5 shrink-0 text-center text-[13px] font-black text-white/50">
          {entry.rnk}
        </span>

        {/* Avatar with pink ring */}
        <div className="relative h-11 w-11 shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[color:var(--primary)] to-[color:var(--secondary)] p-[2px]">
            <div className="h-full w-full overflow-hidden rounded-full border border-[#0a0514] bg-white/5">
              {entry.avatar ? (
                <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm font-black text-white/70">
                  {(entry.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Name + badges */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-white">
            {entry.username ?? "user"}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <VipBadge level={entry.vip_level ?? 0} size="xs" />
            {entry.country && (
              <span className="rounded-sm bg-white/5 px-1 py-0.5 text-[9px] font-bold uppercase text-white/50">
                {entry.country}
              </span>
            )}
          </div>
        </div>

        {/* Coins */}
        <div className="inline-flex shrink-0 items-center gap-1">
          <span className="text-[13px] font-black tracking-tight text-white">{formatCoins(entry.total_coins)}</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[9px] font-black text-[#3a1e00]">$</span>
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
      <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-[#ffe8a8] to-[#7a5210] p-[3px]">
        <div className="grid h-full w-full place-items-center rounded-full bg-[#0a0514]">
          <Trophy className="h-6 w-6 text-[color:var(--gold)]" />
        </div>
      </div>
      <h2 className="text-lg font-black uppercase tracking-[0.25em] text-white">Throne Awaits</h2>
      <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-white/50">
        Send gifts to be the first on the {board} board — claim the golden crown.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--primary)]">
        <Flame className="h-3 w-3" /> Season live
      </div>
    </div>
  );
}

/* ══════════ REWARD BANNER (fire throne) ══════════ */

function RewardBanner({ board, period }: { board: Board; period: Period }) {
  const periodLabel =
    period === "daily" ? "Daily" :
    period === "weekly" ? "Weekly" :
    period === "monthly" ? "Monthly" :
    period === "yearly" ? "Yearly" : "All-time";
  const badgeName = board === "gifters" ? "Champion" : "Boss";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/30 bg-gradient-to-r from-[#3a1400] via-[#5a2404] to-[#3a1400] p-3 shadow-[inset_0_1px_0_rgba(255,220,150,0.25)]">
      {/* ember rays */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-6 top-0 h-full w-24 bg-[radial-gradient(closest-side,rgba(255,180,60,0.35),transparent)] blur-xl" />
      </div>
      <div className="relative flex items-center gap-3">
        {/* Throne icon */}
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#ffd070] to-[#8a4a10] shadow-[0_4px_14px_rgba(255,150,50,0.35)]">
          <Flame className="h-5 w-5 text-[#3a1400]" strokeWidth={2.4} />
          <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--gold)] text-[8px] font-black text-[#3a1400]">👑</span>
        </div>
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-white/90">
          <span className="font-bold text-[color:var(--gold)]">{periodLabel} Top 1</span>{" "}
          {board === "gifters" ? "gifter" : "host"} earns the honorable{" "}
          <span className="font-bold text-white">{badgeName} badge</span>
          <span className="text-white/60"> · unlocks room aura & profile crown</span>
        </p>
      </div>
    </div>
  );
}

/* ══════════ COUNTDOWN STRIP ══════════ */

function CountdownStrip({ period }: { period: Period }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (period === "all") {
    return <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--gold)]">∞ Forever</span>;
  }

  const d = new Date(now);
  let end: Date;
  if (period === "daily") {
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
  } else if (period === "weekly") {
    const day = d.getDay(); // 0 Sun
    const daysToMon = (8 - day) % 7 || 7;
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysToMon, 0, 0, 0);
  } else if (period === "monthly") {
    end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0);
  } else {
    end = new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0);
  }

  const diff = Math.max(0, end.getTime() - now);
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--gold)]/30 bg-black/40 px-2 py-0.5 text-[10px] font-black tracking-wider text-[color:var(--gold)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--gold)]" />
      {pad(hh)}:{pad(mm)}:{pad(ss)}
    </span>
  );
}

