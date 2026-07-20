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

  // Realtime refresh on new gifts
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
        <div className="px-3 pb-6 pt-2">
          {/* ═════════ THEATRE CARD (whole leaderboard lives inside) ═════════ */}
          <div
            className="relative overflow-hidden rounded-[28px] border border-[#3a1f0a] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]"
            style={{
              background:
                "linear-gradient(180deg,#3d1a05 0%,#5a2a08 22%,#3a1704 50%,#20100a 78%,#180a08 100%)",
            }}
          >
            {/* Curtain rays behind stage */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(255,200,110,0.55)_0%,rgba(180,90,20,0.35)_25%,transparent_60%)]" />
              <div className="absolute inset-0 opacity-60 mix-blend-screen"
                style={{ backgroundImage:"repeating-linear-gradient(180deg,rgba(255,200,120,0.10) 0 2px,transparent 2px 26px)" }}
              />
              {/* focused light beam */}
              <div className="absolute left-1/2 top-0 h-[380px] w-[240px] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_0deg,rgba(255,225,160,0.45)_16deg,transparent_34deg,rgba(255,225,160,0.28)_52deg,transparent_74deg)] blur-[1.5px]" />
            </div>

            {/* ── Board tabs (Gifters / Hosts) ── */}
            <div className="relative z-10 px-6 pt-5">
              <div className="mx-auto flex w-fit gap-8">
                {([
                  { k: "gifters", label: "Gifters", Icon: Gift },
                  { k: "hosts",   label: "Hosts",   Icon: Mic2 },
                ] as { k: Board; label: string; Icon: typeof Gift }[]).map(({ k, label, Icon }) => {
                  const active = board === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setBoard(k)}
                      className={`relative pb-2 text-[15px] font-bold transition ${active ? "text-white" : "text-white/45"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-4 w-4" strokeWidth={2.4} /> {label}
                      </span>
                      {active && <span className="absolute -bottom-px left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,235,180,0.9)]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Period pills ── */}
            <div className="relative z-10 mt-4 flex justify-center gap-1.5 px-4">
              {([
                { k: "daily", label: "Daily" },
                { k: "weekly", label: "Weekly" },
                { k: "monthly", label: "Monthly" },
                { k: "yearly", label: "Yearly" },
                { k: "all", label: "All" },
              ] as { k: Period; label: string }[]).map(({ k, label }) => {
                const active = period === k;
                return (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${
                      active
                        ? "bg-white text-[#3a1400] shadow-[0_4px_14px_rgba(255,220,150,0.45)]"
                        : "bg-black/25 text-white/60 border border-white/8"
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
                        ? "border-[#ffcf6a]/70 bg-[#ffcf6a]/15 text-[#ffcf6a]"
                        : "border-white/10 bg-black/25 text-white/55"
                    }`}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.5} /> {label}
                  </button>
                );
              })}
            </div>

            {/* ── Podium ── */}
            <section className="relative z-10 px-4 pb-3 pt-8">
              {q.isLoading ? (
                <div className="flex items-end justify-center gap-4">
                  {[0,1,2].map((i) => (
                    <div key={i} className={`animate-pulse rounded-xl bg-white/5 ${i===1?'h-44 w-24':'h-36 w-20'}`} />
                  ))}
                </div>
              ) : top3.length > 0 ? (
                <StagePodium top3={top3} />
              ) : (
                <EmptyRoyalState board={board} />
              )}
            </section>

            {/* Ornate baroque divider */}
            <div className="relative z-10">
              <div className="mx-auto h-[1px] w-[92%] bg-gradient-to-r from-transparent via-[#ffcf6a]/70 to-transparent" />
              <div className="mx-auto -mt-2 flex w-fit items-center gap-2">
                <span className="text-[#ffcf6a] drop-shadow-[0_0_6px_rgba(255,200,90,0.7)]">◆</span>
                <span className="rounded-full bg-[#2a1204] px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.4em] text-[#ffcf6a]/90 border border-[#ffcf6a]/30">Champions</span>
                <span className="text-[#ffcf6a] drop-shadow-[0_0_6px_rgba(255,200,90,0.7)]">◆</span>
              </div>
            </div>

            {/* ── Reward + Countdown ── */}
            <section className="relative z-10 px-4 pt-5">
              <RewardBanner board={board} period={period} />
              <div className="mt-3 flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  {board === "gifters" ? "Gifters" : "Hosts"} · {period}
                </span>
                <CountdownStrip period={period} />
              </div>
            </section>

            {/* ── Ranks 4+ list (inside warm card) ── */}
            <section className="relative z-10 px-3 pb-5 pt-3">
              {q.isLoading ? (
                <div className="space-y-2">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : rest.length > 0 ? (
                <ul className="space-y-2">
                  {rest.map((e) => <StageRow key={e.user_id} entry={e} />)}
                </ul>
              ) : null}
            </section>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

/* ══════════ STAGE PODIUM ══════════ */

function StagePodium({ top3 }: { top3: Entry[] }) {
  const [first, second, third] = top3;
  return (
    <div className="flex items-end justify-center gap-1">
      {second && <PodiumTile entry={second} place={2} />}
      {first  && <PodiumTile entry={first}  place={1} />}
      {third  && <PodiumTile entry={third}  place={3} />}
    </div>
  );
}

function PodiumTile({ entry, place }: { entry: Entry; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;
  // Ribbon banner palette per rank
  const banner =
    place === 1 ? { from:"#a13fbd", via:"#6a1e8e", to:"#3a0f5a", glow:"rgba(190,90,220,0.5)" }
    : place === 2 ? { from:"#3c86ff", via:"#1e56cf", to:"#0a2560", glow:"rgba(60,140,255,0.45)" }
    : { from:"#e15a3a", via:"#a83015", to:"#5a1604", glow:"rgba(230,90,50,0.45)" };
  const avatarSize = isFirst ? "h-24 w-24" : "h-[74px] w-[74px]";

  return (
    <Link
      to="/u/$userId"
      params={{ userId: entry.user_id }}
      className="flex flex-col items-center px-2"
      style={{ transform: isFirst ? "translateY(-18px)" : undefined }}
    >
      {/* Ornate crown */}
      <div className="relative">
        <Crown
          className={`${isFirst ? "h-12 w-12" : "h-9 w-9"} text-[#ffd66a] drop-shadow-[0_0_14px_rgba(255,200,80,0.9)]`}
          fill="currentColor"
          strokeWidth={0.8}
        />
        {isFirst && <div className="absolute -inset-3 rounded-full bg-[#ffd66a]/30 blur-2xl animate-pulse" />}
      </div>

      {/* Avatar with ornate golden frame */}
      <div className={`relative -mt-1.5 ${avatarSize}`}>
        {/* outer ornate ring */}
        <div
          className="absolute inset-0 rounded-full p-[3px] shadow-[0_8px_28px_rgba(0,0,0,0.6)]"
          style={{
            background:
              "conic-gradient(from 210deg,#7a4a10 0deg,#ffe8a8 40deg,#ffcf6a 90deg,#7a4a10 150deg,#ffe8a8 220deg,#ffcf6a 280deg,#7a4a10 360deg)",
          }}
        >
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
        {/* ornate wing dots side ornaments */}
        <span className="absolute -left-2 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 rounded-sm bg-gradient-to-br from-[#ffe8a8] to-[#7a4a10] shadow" />
        <span className="absolute -right-2 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 rounded-sm bg-gradient-to-br from-[#ffe8a8] to-[#7a4a10] shadow" />
      </div>

      {/* Big ribbon banner */}
      <div className="relative -mt-2">
        <div
          className="relative px-7 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)",
            background: `linear-gradient(180deg, ${banner.from} 0%, ${banner.via} 55%, ${banner.to} 100%)`,
            boxShadow: `0 6px 22px ${banner.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
          }}
        >
          <p className="text-[12px] font-black tracking-[0.3em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
            TOP&nbsp;{place}
          </p>
        </div>
        {/* side ribbon tails */}
        <span className="absolute -left-1.5 top-1 h-3 w-3 rotate-45 bg-black/40" style={{ clipPath:"polygon(0 0,100% 0,100% 100%)" }} />
        <span className="absolute -right-1.5 top-1 h-3 w-3 -rotate-45 bg-black/40" style={{ clipPath:"polygon(0 0,100% 0,0 100%)" }} />
      </div>

      {/* Name */}
      <p className={`mt-2 max-w-[100px] truncate text-center text-[12px] font-black text-white ${isFirst ? "" : "opacity-95"}`}>
        {entry.username ?? "user"}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <VipBadge level={entry.vip_level ?? 0} size="xs" />
        {entry.country && <span className="text-[10px] leading-none">{entry.country}</span>}
      </div>
      {/* Coins */}
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur border border-[#ffcf6a]/25">
        <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[8px] font-black text-[#3a1e00]">$</span>
        <span className="text-[11px] font-black text-[#ffcf6a]">{formatCoins(entry.total_coins)}</span>
      </div>
    </Link>
  );
}

/* ══════════ RANK ROW (4+) — warm cream card ══════════ */

function StageRow({ entry }: { entry: Entry }) {
  const rankColor =
    entry.rnk <= 10 ? "text-[#ffcf6a]" : "text-white/55";
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: entry.user_id }}
        className="relative flex items-center gap-3 rounded-2xl border border-[#ffcf6a]/15 px-3 py-2.5 transition active:scale-[0.99]"
        style={{ background: "linear-gradient(180deg,rgba(60,30,10,0.55),rgba(30,15,8,0.55))" }}
      >
        {/* Rank number */}
        <span className={`w-6 shrink-0 text-center text-[14px] font-black ${rankColor}`}>
          {entry.rnk}
        </span>

        {/* Avatar with gold ring */}
        <div className="relative h-11 w-11 shrink-0">
          <div
            className="absolute inset-0 rounded-full p-[2px]"
            style={{ background:"conic-gradient(from 210deg,#7a4a10,#ffe8a8,#ffcf6a,#7a4a10,#ffe8a8,#ffcf6a,#7a4a10)" }}
          >
            <div className="h-full w-full overflow-hidden rounded-full border border-[#2a1002] bg-[#0a0514]">
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

        {/* Name + VIP */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-white">{entry.username ?? "user"}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <VipBadge level={entry.vip_level ?? 0} size="xs" />
            {entry.country && (
              <span className="rounded-sm bg-black/30 px-1 py-0.5 text-[9px] font-bold uppercase text-white/60">{entry.country}</span>
            )}
          </div>
        </div>

        {/* Coins */}
        <div className="inline-flex shrink-0 items-center gap-1">
          <span className="text-[14px] font-black tracking-tight text-white">{formatCoins(entry.total_coins)}</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-b from-[#ffe58a] to-[#c48a1a] text-[9px] font-black text-[#3a1e00]">$</span>
        </div>
      </Link>
    </li>
  );
}

/* ---------- Empty state ---------- */

function EmptyRoyalState({ board }: { board: Board }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#ffcf6a]/20 bg-black/25 p-8 text-center backdrop-blur">
      <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#ffcf6a]/15 blur-3xl" />
      <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-[#ffe8a8] to-[#7a5210] p-[3px]">
        <div className="grid h-full w-full place-items-center rounded-full bg-[#0a0514]">
          <Trophy className="h-6 w-6 text-[#ffcf6a]" />
        </div>
      </div>
      <h2 className="text-lg font-black uppercase tracking-[0.25em] text-white">Throne Awaits</h2>
      <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-white/60">
        Send gifts to be the first on the {board} board — claim the golden crown.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#ff3b8c]/40 bg-[#ff3b8c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#ff88b8]">
        <Flame className="h-3 w-3" /> Season live
      </div>
    </div>
  );
}

/* ══════════ REWARD BANNER ══════════ */

function RewardBanner({ board, period }: { board: Board; period: Period }) {
  const periodLabel =
    period === "daily" ? "Daily" :
    period === "weekly" ? "Weekly" :
    period === "monthly" ? "Monthly" :
    period === "yearly" ? "Yearly" : "All-time";
  const badgeName = board === "gifters" ? "Champion" : "Boss";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#ffcf6a]/35 p-3 shadow-[inset_0_1px_0_rgba(255,220,150,0.3)]"
      style={{ background: "linear-gradient(90deg,#4a1a02 0%,#7a3610 45%,#4a1a02 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-8 top-0 h-full w-32 bg-[radial-gradient(closest-side,rgba(255,180,60,0.45),transparent)] blur-xl" />
        <div className="absolute -right-8 top-0 h-full w-32 bg-[radial-gradient(closest-side,rgba(255,180,60,0.3),transparent)] blur-xl" />
      </div>
      <div className="relative flex items-center gap-3">
        {/* Throne icon */}
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#ffd070] to-[#8a4a10] shadow-[0_4px_14px_rgba(255,150,50,0.4)]">
          <Flame className="h-6 w-6 text-[#3a1400]" strokeWidth={2.4} />
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[14px] leading-none">👑</span>
        </div>
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-white/90">
          <span className="font-bold text-[#ffcf6a]">{periodLabel} Top 1</span>{" "}
          {board === "gifters" ? "gifter" : "host"} earns the honorable{" "}
          <span className="font-bold text-white">{badgeName} badge</span>
          <span className="text-white/60"> · unlocks room aura & profile crown</span>
        </p>
      </div>
    </div>
  );
}

/* ══════════ COUNTDOWN ══════════ */

function CountdownStrip({ period }: { period: Period }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (period === "all") {
    return <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffcf6a]">∞ Forever</span>;
  }

  const d = new Date(now);
  let end: Date;
  if (period === "daily") {
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
  } else if (period === "weekly") {
    const day = d.getDay();
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
    <span className="inline-flex items-center gap-1 rounded-full border border-[#ffcf6a]/40 bg-black/50 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-[#ffcf6a]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffcf6a]" />
      {pad(hh)}:{pad(mm)}:{pad(ss)}
    </span>
  );
}
