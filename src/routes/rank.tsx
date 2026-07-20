import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { formatCoins } from "@/lib/vip-levels";
import {
  ArrowLeft, HelpCircle, Crown, Star, Heart, Mic, Gift, Swords, Gem, Sparkles,
  Flame, Globe2, ChevronDown, Coins, Bell, Wallet as WalletIcon,
} from "lucide-react";
import { formatCompact } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/useNotifications";


export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({
    meta: [
      { title: "Rankings — Jalwa Global Live" },
      { name: "description", content: "Top hosts, gifters, wealth, charm, PK kings and royals on Jalwa. Live daily, weekly, monthly and all-time leaderboards." },
    ],
  }),
});

/* ─────────────────────────────  Types & config  ───────────────────────────── */

type Category =
  | "wealth" | "points" | "charm" | "hosts" | "gifters"
  | "pk"     | "vip"    | "royals" | "popular" | "country";
type Period = "daily" | "weekly" | "monthly" | "all";
type Scope  = "global" | "country";

type Row = {
  user_id: string; username: string | null; avatar: string | null;
  country: string | null; vip_level: number; level: number;
  score: number; rnk: number;
};

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }>; unit: string; }[] = [
  { k: "wealth",  label: "Wealth",  Icon: Crown,    unit: "Coins" },
  { k: "points",  label: "Points",  Icon: Star,     unit: "XP" },
  { k: "charm",   label: "Charm",   Icon: Heart,    unit: "Fans" },
  { k: "hosts",   label: "Hosts",   Icon: Mic,      unit: "Coins" },
  { k: "gifters", label: "Gifters", Icon: Gift,     unit: "Coins" },
  { k: "pk",      label: "PK King", Icon: Swords,   unit: "Wins" },
  { k: "vip",     label: "VIP",     Icon: Gem,      unit: "Level" },
  { k: "royals",  label: "Royals",  Icon: Sparkles, unit: "Level" },
  { k: "popular", label: "Popular", Icon: Flame,    unit: "Coins" },
  { k: "country", label: "Country", Icon: Globe2,   unit: "Coins" },
];

const PERIODS: { k: Period; label: string }[] = [
  { k: "daily", label: "Daily Ranking" },
  { k: "weekly", label: "Weekly Ranking" },
  { k: "monthly", label: "Monthly Ranking" },
  { k: "all", label: "Overall Ranking" },
];

/* Country flags — extended dynamically with countries actually present in DB. */
const COUNTRY_FLAG: Record<string, string> = {
  Pakistan: "🇵🇰", India: "🇮🇳", Bangladesh: "🇧🇩", "Saudi Arabia": "🇸🇦",
  UAE: "🇦🇪", Turkey: "🇹🇷", Egypt: "🇪🇬", Indonesia: "🇮🇩", Malaysia: "🇲🇾",
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", Philippines: "🇵🇭",
  Nigeria: "🇳🇬", Morocco: "🇲🇦", Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦",
  Oman: "🇴🇲", Bahrain: "🇧🇭", Jordan: "🇯🇴", Syria: "🇸🇾", Yemen: "🇾🇪",
  Afghanistan: "🇦🇫", Iran: "🇮🇷", Russia: "🇷🇺", China: "🇨🇳", Japan: "🇯🇵",
  Germany: "🇩🇪", France: "🇫🇷", Canada: "🇨🇦", Brazil: "🇧🇷", Mexico: "🇲🇽",
};

/* ─────────────────────────────  Page  ───────────────────────────── */

function RankPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const [category, setCategory] = useState<Category>("wealth");
  const [period, setPeriod]     = useState<Period>("daily");
  const [country, setCountry]   = useState<string>("Global");
  const [helpOpen, setHelpOpen] = useState(false);

  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country" ? (country === "Global" ? (profile?.country ?? "Pakistan") : country) : null;

  const qKey = ["rank_users", category, period, scope, scopeValue] as const;
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
    queryKey: ["rank_me", category, period, scope, scopeValue, user?.id],
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

  /* Realtime: debounced refresh on gift / profile / pk changes */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const bump = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        qc.invalidateQueries({ queryKey: ["rank_users"] });
        qc.invalidateQueries({ queryKey: ["rank_me"] });
      }, 1500);
    };
    const ch = supabase.channel("rankings-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_sends" }, bump)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pk_matches"  }, bump)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles"    }, bump)
      .subscribe();
    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      supabase.removeChannel(ch);
    };
  }, [qc]);

  /* Auto refresh countdown (per minute) */
  const [refreshIn, setRefreshIn] = useState(60);
  useEffect(() => {
    const t = setInterval(() => {
      setRefreshIn((n) => {
        if (n <= 1) { qc.invalidateQueries({ queryKey: qKey }); return 60; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [qc, qKey]);

  const list = q.data ?? [];
  const [c1, c2, c3] = [list[0], list[1], list[2]];
  const rest = list.slice(3);
  const activeCat = CATS.find((c) => c.k === category)!;

  return (
    <>
      <AppShell title="" subtitle="" showHeader={false}>
        <div className="relative min-h-full overflow-hidden bg-[#090A14] pb-32 text-white">
          {/* ambient glows */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-[100px]" />
            <div className="absolute top-40 -left-16 h-52 w-52 rounded-full bg-violet-600/15 blur-[90px]" />
            <div className="absolute top-96 -right-16 h-56 w-56 rounded-full bg-amber-500/10 blur-[100px]" />
          </div>

          {/* ── Header ───────────────────────────────────────────────── */}
          <RankHeader onBack={() => router.history.back()} onHelp={() => setHelpOpen(true)} profile={profile} userId={user?.id} />


          {/* ── Category tabs ────────────────────────────────────────── */}
          <nav className="relative z-10 mt-5 overflow-x-auto no-scrollbar">
            <ul className="flex gap-2 px-4">
              {CATS.map(({ k, label, Icon }) => {
                const active = category === k;
                return (
                  <li key={k}>
                    <button
                      onClick={() => setCategory(k)}
                      className={`group inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border px-3.5 py-2 text-[12px] font-semibold transition ${
                        active
                          ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600/70 via-violet-600/70 to-purple-700/70 text-white shadow-[0_0_20px_-4px_rgba(217,70,239,0.75)]"
                          : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-white/25"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" : "text-white/50"}`} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ── Top 3 podium ─────────────────────────────────────────── */}
          <section className="relative z-10 mt-6 px-4">
            <div className="grid grid-cols-3 items-end gap-2.5">
              <Podium row={c2} place={2} unit={activeCat.unit} />
              <Podium row={c1} place={1} unit={activeCat.unit} />
              <Podium row={c3} place={3} unit={activeCat.unit} />
            </div>
          </section>

          {/* ── Filter bar ───────────────────────────────────────────── */}
          <section className="relative z-10 mt-6 px-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {PERIODS.map(({ k, label }) => {
                const active = period === k;
                return (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={`whitespace-nowrap rounded-2xl border px-3.5 py-2 text-[12px] font-semibold transition ${
                      active
                        ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600/60 to-violet-600/60 text-white shadow-[0_0_16px_-4px_rgba(217,70,239,0.7)]"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <div className="ml-auto">
                <CountrySelect value={country} onChange={setCountry} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full border border-white/15">⟳</span>
                Ranking refreshes in {String(Math.floor(refreshIn / 60)).padStart(2, "0")}:{String(refreshIn % 60).padStart(2, "0")}
              </span>
              <span className="inline-flex items-center gap-1 text-white/60">
                {activeCat.label} ({activeCat.unit}) <span className="text-white/30">ⓘ</span>
              </span>
              <span className="text-white/45">Country</span>
            </div>
          </section>

          {/* ── Leaderboard list ─────────────────────────────────────── */}
          <section className="relative z-10 mt-4 px-4">
            {q.isLoading ? (
              <ul className="space-y-2">
                {[0,1,2,3,4,5].map((i) => (
                  <li key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </ul>
            ) : rest.length === 0 && list.length <= 3 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-2">
                {rest.map((r) => <RankRow key={r.user_id} row={r} unit={activeCat.unit} />)}
              </ul>
            )}
          </section>

          {/* ── Bottom info ─────────────────────────────────────────── */}
          <section className="relative z-10 mt-6 px-4 text-[11px] leading-relaxed text-white/50">
            <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
              <Crown className="mt-[2px] h-4 w-4 shrink-0 text-amber-300" />
              <p>
                Rankings indicate the total {activeCat.unit.toLowerCase()} for the selected category.
                Daily resets at 00:00 UTC, weekly on Monday, monthly on the 1st. Overall never resets.
                Rewards are distributed at each reset — see rules for details.
              </p>
            </div>
          </section>
        </div>
      </AppShell>

      {/* Sticky "My Rank" */}
      {user && (
        <MyRank
          row={meQ.data ?? null}
          fallback={profile}
          unit={activeCat.unit}
        />
      )}

      {/* Help modal */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <BottomNav />
    </>
  );
}

/* ─────────────────────────────  Podium  ───────────────────────────── */

function Podium({ row, place, unit }: { row?: Row; place: 1 | 2 | 3; unit: string }) {
  const theme = place === 1
    ? { ring: "ring-2 ring-amber-300/80 shadow-[0_0_40px_-8px_rgba(251,191,36,0.75)]", border: "border-amber-300/50", chip: "from-amber-400 to-yellow-500 text-black", num: "text-amber-300", pad: "-mt-6 h-32 w-32", crown: "text-amber-300" }
    : place === 2
    ? { ring: "ring-2 ring-violet-400/70 shadow-[0_0_28px_-8px_rgba(139,92,246,0.75)]", border: "border-violet-400/40", chip: "from-violet-500 to-indigo-500 text-white", num: "text-violet-300", pad: "h-24 w-24", crown: "text-violet-300" }
    : { ring: "ring-2 ring-orange-400/70 shadow-[0_0_28px_-8px_rgba(251,146,60,0.75)]", border: "border-orange-400/40", chip: "from-orange-500 to-amber-600 text-white", num: "text-orange-300", pad: "h-24 w-24", crown: "text-orange-300" };

  const initial = (row?.username ?? "?").slice(0, 1).toUpperCase();

  const content = (
    <div className={`relative flex flex-col items-center gap-2 rounded-3xl border ${theme.border} bg-white/[0.04] p-3 backdrop-blur-md ${place === 1 ? "shadow-[0_0_28px_-10px_rgba(251,191,36,0.7)]" : ""}`}>
      {/* rank crown chip */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-b ${theme.chip} text-sm font-black shadow-lg`}>
          {place}
        </span>
      </div>

      <div className={`relative mt-3 grid ${theme.pad} place-items-center rounded-full ${theme.ring}`}>
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
        <span className="relative grid h-[86%] w-[86%] place-items-center overflow-hidden rounded-full bg-[#120820] text-2xl font-black text-white/80">
          {row?.avatar
            ? <img src={row.avatar} alt="" className="h-full w-full object-cover" />
            : initial}
        </span>
        {place === 1 && (
          <Crown className={`absolute -top-4 h-6 w-6 ${theme.crown} drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]`} />
        )}
      </div>

      <p className="mt-1 max-w-full truncate text-center text-[13px] font-bold">
        {row?.username ?? "—"}
        {row?.country && COUNTRY_FLAG[row.country] && <span className="ml-1">{COUNTRY_FLAG[row.country]}</span>}
      </p>
      <span className="rounded-lg bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-fuchsia-200">
        Lv {row?.level ?? 0}
      </span>

    </div>
  );

  if (!row) return <div className="opacity-40">{content}</div>;
  return (
    <Link to="/u/$userId" params={{ userId: row.user_id }} className="block hover-scale">
      {content}
    </Link>
  );
}

/* ─────────────────────────────  Row  ───────────────────────────── */

function RankRow({ row, unit }: { row: Row; unit: string }) {
  const initial = (row.username ?? "?").slice(0, 1).toUpperCase();
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: row.user_id }}
        className="grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-md transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
      >
        <span className="text-center text-lg font-black text-white/60">{row.rnk}</span>

        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-2 ring-fuchsia-400/40 p-[2px]">
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#120820] text-sm font-black text-white/80">
              {row.avatar ? <img src={row.avatar} alt="" className="h-full w-full object-cover" /> : initial}
            </span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-tight">{row.username ?? "user"}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-fuchsia-400/30 bg-fuchsia-500/10 px-1.5 py-[1px] text-[10px] font-bold text-fuchsia-200">
              Lv {row.level}
            </span>
          </div>
        </div>

        <span />


        <span className="hidden text-[11px] text-white/60 xs:inline-flex items-center gap-1 sm:inline-flex">
          {row.country && COUNTRY_FLAG[row.country] ? COUNTRY_FLAG[row.country] : "🌐"}
          <span className="max-w-[70px] truncate">{row.country ?? "—"}</span>
          <span className="sr-only">{unit}</span>
        </span>
      </Link>
    </li>
  );
}

/* ─────────────────────────────  My Rank sticky  ───────────────────────────── */

function MyRank({ row, fallback, unit }: { row: Row | null; fallback: any; unit: string }) {
  const initial = (row?.username ?? fallback?.username ?? "?").slice(0, 1).toUpperCase();
  const avatar = row?.avatar ?? fallback?.avatar ?? null;
  const country = row?.country ?? fallback?.country ?? null;
  const rank = row?.rnk ?? null;
  const score = row?.score ?? Number(fallback?.coins ?? 0);
  const level = row?.level ?? fallback?.level ?? 1;
  const vip = row?.vip_level ?? fallback?.vip_level ?? 0;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3">
      <div className="mx-auto max-w-[520px] rounded-2xl border border-fuchsia-400/40 bg-[#0f0820]/85 p-3 backdrop-blur-xl shadow-[0_0_24px_-4px_rgba(217,70,239,0.55)]">
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-amber-300">My Rank</p>
            <p className="text-xl font-black leading-none">{rank ? `#${rank}` : "—"}</p>
          </div>

          <span className="grid h-12 w-12 place-items-center rounded-full ring-2 ring-amber-300/70 p-[2px]">
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#120820] text-sm font-black text-white/80">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
            </span>
          </span>

          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-bold">
              {row?.username ?? fallback?.username ?? "You"}
              <span className="rounded-md bg-fuchsia-500/20 px-1.5 py-[1px] text-[9px] font-black text-fuchsia-200">You</span>
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-500/10 px-1.5 py-[1px] text-[10px] font-bold text-amber-200">
              Lv {level} • VIP {vip}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[13px] font-black text-white">
            {formatCoins(score)} <Coins className="h-3.5 w-3.5 text-amber-300" />
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] text-white/60">
            {country && COUNTRY_FLAG[country] ? COUNTRY_FLAG[country] : "🌐"}
            <span className="max-w-[60px] truncate">{country ?? "—"}</span>
            <span className="sr-only">{unit}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  Bits  ───────────────────────────── */

function Laurel({ side }: { side: "left" | "right" }) {
  return (
    <svg viewBox="0 0 40 40" className={`h-8 w-8 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] ${side === "right" ? "-scale-x-100" : ""}`} fill="currentColor" aria-hidden>
      <path d="M8 34c8-2 14-8 16-16 1 6-2 14-9 18-2 1-5 1-7-2zm-2-10c4-3 7-8 7-14 3 4 3 12-2 16-2 2-4 1-5-2zm4 16c6-1 12-6 14-13 0 8-6 15-13 15-1 0-1-1-1-2z" />
    </svg>
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

  // Live list of countries from actual users in DB
  const { data: dbCountries } = useQuery({
    queryKey: ["rank-countries"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("country")
        .not("country", "is", null)
        .limit(2000);
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
        className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-white/80 backdrop-blur-md"
      >
        <Globe2 className="h-4 w-4 text-violet-300" />
        {value} <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-72 w-44 overflow-auto rounded-2xl border border-white/10 bg-[#12081e]/95 p-1 shadow-2xl backdrop-blur-xl">
          {options.length === 1 ? (
            <p className="px-3 py-2 text-[11px] text-white/50">No country data yet</p>
          ) : options.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] transition hover:bg-white/10 ${value === c ? "bg-white/10 text-white" : "text-white/70"}`}
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
    <div className="mx-auto mt-6 max-w-[280px] rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center backdrop-blur-md">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/40 bg-amber-500/10">
        <Crown className="h-6 w-6 text-amber-300" />
      </div>
      <p className="text-sm font-bold">Throne awaits</p>
      <p className="mt-1 text-xs text-white/50">Be the first to climb this leaderboard.</p>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-fuchsia-400/40 bg-[#0f0820]/95 p-5 shadow-[0_0_40px_-8px_rgba(217,70,239,0.6)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Ranking rules</h2>
          <button onClick={onClose} className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10">Close</button>
        </div>
        <ul className="space-y-2 text-[13px] leading-relaxed text-white/75">
          <li><b className="text-amber-300">Wealth</b> — total coins owned by users.</li>
          <li><b className="text-amber-300">Points</b> — XP earned across the app.</li>
          <li><b className="text-amber-300">Charm</b> — number of unique fans who gifted you.</li>
          <li><b className="text-amber-300">Hosts</b> — coins received via gifts.</li>
          <li><b className="text-amber-300">Gifters</b> — coins spent on gifts.</li>
          <li><b className="text-amber-300">PK King</b> — PK battles won.</li>
          <li><b className="text-amber-300">VIP / Royals</b> — VIP level progression (Royals = Lv 10+).</li>
          <li><b className="text-amber-300">Popular</b> — combined engagement in period.</li>
          <li><b className="text-amber-300">Country</b> — same as Wealth, filtered by country.</li>
        </ul>
        <p className="mt-3 text-[11px] text-white/45">
          Daily resets 00:00 UTC · Weekly Monday · Monthly on the 1st · Overall never resets. Rankings update live after every gift.
        </p>
      </div>
    </div>
  );
}

/* Utility: hide scrollbar for horizontal rows */
declare module "react" { interface CSSProperties { WebkitOverflowScrolling?: "auto" | "touch" } }
