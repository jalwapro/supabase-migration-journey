import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, HelpCircle, Trophy, Star, Mic, Gift, Swords, Gem, Sparkles,
  Flame, Globe2, ChevronDown, Crown, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({
    meta: [
      { title: "Rankings — Jalwa Global Live" },
      { name: "description", content: "Top leaderboards and rankings on Jalwa." },
    ],
  }),
});

type Category =
  | "points" | "hosts" | "gifters"
  | "pk"     | "vip"    | "royals" | "popular" | "country";
type Period = "daily" | "weekly" | "monthly" | "all";
type Scope  = "global" | "country";

type Row = {
  user_id: string; username: string | null; avatar: string | null;
  country: string | null; vip_level: number; level: number;
  score: number; rnk: number;
};

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "hosts",    label: "Room Gift", Icon: Gift },
  { k: "points",   label: "Points",    Icon: Star },
  { k: "gifters",  label: "Gifters",   Icon: Mic },
  { k: "pk",       label: "PK King",   Icon: Swords },
  { k: "vip",      label: "VIP",       Icon: Gem },
  { k: "royals",   label: "Royals",    Icon: Sparkles },
  { k: "popular",  label: "Popular",   Icon: Flame },
  { k: "country",  label: "Country",   Icon: Globe2 },
];

const PERIODS: { k: Period; label: string }[] = [
  { k: "daily", label: "Daily" },
  { k: "weekly", label: "Weekly" },
  { k: "monthly", label: "Monthly" },
  { k: "all", label: "All-Time" },
];

const COUNTRY_FLAG: Record<string, string> = {
  Pakistan: "🇵🇰", India: "🇮🇳", Bangladesh: "🇧🇩", "Saudi Arabia": "🇸🇦",
  UAE: "🇦🇪", Turkey: "🇹🇷", Egypt: "🇪🇬", Indonesia: "🇮🇩", Malaysia: "🇲🇾",
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", Philippines: "🇵🇭",
  Nigeria: "🇳🇬", Morocco: "🇲🇦", Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦",
};

function RankPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const [category, setCategory] = useState<Category>("hosts");
  const [period, setPeriod]     = useState<Period>("daily");
  const [country, setCountry]   = useState<string>("Global");
  const [helpOpen, setHelpOpen] = useState(false);

  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country" ? (country === "Global" ? (profile?.country ?? "Pakistan") : country) : null;

  const qKey = ["rank_users_v2", category, period, scope, scopeValue] as const;
  const q = useQuery({
    queryKey: qKey,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rank_users", {
        p_category: category, p_period: period, p_scope: scope,
        p_scope_value: scopeValue, p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const meQ = useQuery({
    queryKey: ["rank_me_v2", category, period, scope, scopeValue, user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rank_me", {
        p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as Row | null;
    },
  });

  const list = q.data ?? [];
  const [c1, c2, c3] = [list[0], list[1], list[2]];
  const rest = list.slice(3);

  return (
    <>
      <AppShell title="" subtitle="" showHeader={false}>
        <div className="relative min-h-full [overflow-x:clip] pb-36 text-slate-100 bg-[#070514] selection:bg-amber-500 selection:text-black">
          
          {/* Cyberpunk / Deep Violet Ambient Glows */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
            <div className="absolute top-40 -left-20 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[130px]" />
            <div className="absolute top-96 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-[140px]" />
          </div>

          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070514]/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
              <button
                onClick={() => router.history.back()}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <h1 className="text-base font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400">
                  Global Rankings
                </h1>
              </div>

              <button
                onClick={() => setHelpOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>

            {/* Horizontal Category Nav */}
            <nav className="overflow-x-auto no-scrollbar px-4 pb-2.5 pt-1">
              <ul className="flex gap-2">
                {CATS.map(({ k, label, Icon }) => {
                  const active = category === k;
                  return (
                    <li key={k}>
                      <button
                        onClick={() => setCategory(k)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/25 font-bold"
                            : "bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${active ? "text-black" : "text-slate-400"}`} />
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </header>

          {/* Period Filter & Country Selector */}
          <section className="relative z-10 mt-4 px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 backdrop-blur-md">
              {PERIODS.map(({ k, label }) => {
                const active = period === k;
                return (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={`rounded-lg px-3 py-1 text-[11px] font-medium transition ${
                      active
                        ? "bg-white/15 text-white font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <CountrySelect value={country} onChange={setCountry} />
          </section>

          {/* ── Podium Section (Modern Floating Glass Cards) ── */}
          <section className="relative z-10 mt-6 px-4">
            <div className="grid grid-cols-3 items-end gap-3 pt-6">
              <PodiumCard row={c2} place={2} />
              <PodiumCard row={c1} place={1} />
              <PodiumCard row={c3} place={3} />
            </div>
          </section>

          {/* ── Leaderboard List (Rank 4 onwards) ── */}
          <section className="relative z-10 mt-6 px-4">
            {q.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5 border border-white/5" />
                ))}
              </div>
            ) : rest.length === 0 && list.length <= 3 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-2.5">
                {rest.map((r) => (
                  <RankItem key={r.user_id} row={r} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </AppShell>

      {/* Sticky My Rank Footer */}
      {user && <MyRankCard row={meQ.data ?? null} fallback={profile} />}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <BottomNav />
    </>
  );
}

/* ──────────────────────── Subcomponents ──────────────────────── */

function PodiumCard({ row, place }: { row?: Row; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;

  const borderColor = isFirst
    ? "border-amber-400/60 bg-gradient-to-b from-amber-500/20 via-slate-900/80 to-slate-950/90 shadow-[0_0_30px_rgba(251,191,36,0.15)]"
    : place === 2
    ? "border-slate-300/40 bg-gradient-to-b from-slate-300/15 via-slate-900/80 to-slate-950/90 shadow-[0_0_20px_rgba(203,213,225,0.1)]"
    : "border-amber-700/40 bg-gradient-to-b from-amber-700/20 via-slate-900/80 to-slate-950/90 shadow-[0_0_20px_rgba(217,119,6,0.1)]";

  const badgeColor = isFirst
    ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black"
    : place === 2
    ? "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black"
    : "bg-gradient-to-r from-amber-600 to-amber-800 text-white font-black";

  const content = (
    <div className={`relative flex flex-col items-center rounded-3xl border p-3 backdrop-blur-xl transition hover:scale-[1.02] ${borderColor} ${isFirst ? "-mt-4 pb-5 pt-5" : "pb-3 pt-4"}`}>
      
      {/* Crown / Trophy icon */}
      <div className={`absolute -top-4 grid h-8 w-8 place-items-center rounded-full border border-white/20 shadow-lg ${badgeColor}`}>
        {isFirst ? <Crown className="h-4 w-4 fill-current" /> : <span className="text-xs font-extrabold">{place}</span>}
      </div>

      {/* Avatar */}
      <div className={`relative rounded-full p-0.5 mt-2 border-2 ${isFirst ? "border-amber-400 h-16 w-16" : "border-white/20 h-13 w-13"}`}>
        <LevelAvatar
          src={row?.avatar ?? undefined}
          name={row?.username ?? undefined}
          level={row?.level ?? 0}
          size={isFirst ? "lg" : "md"}
          showBadge={false}
        />
      </div>

      {/* Username */}
      <p className="mt-2 max-w-[90px] truncate text-center text-[13px] font-bold text-white">
        {row?.username ?? "—"}
      </p>

      {/* Badges row */}
      <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">
          N{row?.level ?? 1}
        </span>
        <span className="rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5">
          VIP {row?.vip_level ?? 0}
        </span>
      </div>
    </div>
  );

  if (!row) return <div className="opacity-30">{content}</div>;
  return (
    <Link to="/u/$userId" params={{ userId: row.user_id }} className="block">
      {content}
    </Link>
  );
}

function RankItem({ row }: { row: Row }) {
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: row.user_id }}
        className="grid grid-cols-[36px_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 backdrop-blur-md transition hover:border-amber-500/40 hover:bg-white/[0.06]"
      >
        <span className="text-center text-sm font-extrabold text-slate-400">
          {row.rnk}
        </span>

        <LevelAvatar
          src={row.avatar ?? undefined}
          name={row.username ?? undefined}
          level={row.level ?? 0}
          size="sm"
          showBadge={false}
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">
            {row.username ?? "user"}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300 font-medium">
              Level {row.level}
            </span>
            {row.country && COUNTRY_FLAG[row.country] && (
              <span className="flex items-center gap-1 text-slate-400">
                {COUNTRY_FLAG[row.country]} {row.country}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function MyRankCard({ row, fallback }: { row: Row | null; fallback: any }) {
  const avatar = row?.avatar ?? fallback?.avatar ?? null;
  const country = row?.country ?? fallback?.country ?? null;
  const rank = row?.rnk ?? null;
  const level = row?.level ?? fallback?.level ?? 1;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-4">
      <div className="mx-auto max-w-[520px] rounded-2xl border border-amber-500/40 bg-[#120e26]/95 p-3.5 backdrop-blur-2xl shadow-[0_0_30px_rgba(251,191,36,0.15)]">
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3">
          <div className="text-center px-1">
            <p className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">My Rank</p>
            <p className="text-base font-extrabold text-white">{rank ? `#${rank}` : "—"}</p>
          </div>

          <LevelAvatar
            src={avatar ?? undefined}
            name={row?.username ?? fallback?.username ?? undefined}
            level={level}
            size="sm"
            showBadge={false}
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {row?.username ?? fallback?.username ?? "You"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold">
                Level {level}
              </span>
              <span className="text-[11px] text-slate-400">
                {country && COUNTRY_FLAG[country] ? COUNTRY_FLAG[country] : "🌐"} {country ?? "Global"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  const { data: dbCountries } = useQuery({
    queryKey: ["rank-countries-v2"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("country").not("country", "is", null).limit(2000);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as { country: string | null }[]) {
        if (r.country && r.country.trim()) set.add(r.country.trim());
      }
      return Array.from(set).sort();
    },
  });

  const options = useMemo(() => ["Global", ...(dbCountries ?? [])], [dbCountries]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-md hover:bg-white/10 transition"
      >
        <Globe2 className="h-3.5 w-3.5 text-amber-400" />
        {value} <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-72 w-44 overflow-auto rounded-2xl border border-white/10 bg-[#120e26]/95 p-1 shadow-2xl backdrop-blur-xl">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-white/10 ${value === c ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-300"}`}
            >
              <span>{c === "Global" ? "🌐" : (COUNTRY_FLAG[c] ?? "🏳️")}</span>{c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-6 max-w-[280px] rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-md">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
        <Trophy className="h-6 w-6" />
      </div>
      <p className="text-sm font-bold text-white">No Rankings Yet</p>
      <p className="mt-1 text-xs text-slate-400">Be the first to claim your spot on the leaderboard.</p>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-white/15 bg-[#120e26]/95 p-6 shadow-2xl backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" /> Ranking Rules
          </h2>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">Close</button>
        </div>
        <ul className="space-y-2.5 text-xs leading-relaxed text-slate-300">
          <li><b className="text-amber-300">Room Gift</b> — Calculated based on gifts received during live streams.</li>
          <li><b className="text-amber-300">Points & XP</b> — Earned through general activity across app features.</li>
          <li><b className="text-amber-300">PK Battles</b> — Ranked by total successful victories in PK matches.</li>
          <li><b className="text-amber-300">VIP & Royals</b> — Based on active VIP tier status and progression.</li>
        </ul>
        <p className="mt-4 text-[10px] text-slate-500 text-center">
          Resets daily at 00:00 UTC · Weekly on Monday · Monthly on the 1st
        </p>
      </div>
    </div>
  );
}

declare module "react" { interface CSSProperties { WebkitOverflowScrolling?: "auto" | "touch" } }
