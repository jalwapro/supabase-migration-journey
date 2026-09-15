import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, HelpCircle, Star, Mic, Gift, Swords, Gem, Sparkles,
  Flame, Globe2, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({
    meta: [
      { title: "Rankings — Jalwa Global Live" },
      { name: "description", content: "Top hosts, gifters, wealth, charm, PK kings and royals on Jalwa." },
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

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }>; unit: string; }[] = [
  { k: "hosts",    label: "Room Gift", Icon: Gift,     unit: "Coins" },
  { k: "points",   label: "Points",    Icon: Star,     unit: "XP" },
  { k: "gifters",  label: "Gifters",   Icon: Gift,     unit: "Coins" },
  { k: "pk",       label: "PK King",   Icon: Swords,   unit: "Wins" },
  { k: "vip",      label: "VIP",       Icon: Gem,      unit: "Level" },
  { k: "royals",   label: "Royals",    Icon: Sparkles, unit: "Level" },
  { k: "popular",  label: "Popular",   Icon: Flame,    unit: "Coins" },
  { k: "country",  label: "Country",   Icon: Globe2,   unit: "Coins" },
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
  Oman: "🇴🇲", Bahrain: "🇧🇭", Jordan: "🇯🇴", Syria: "🇸🇾", Yemen: "🇾🇪",
  Afghanistan: "🇦🇫", Iran: "🇮🇷", Russia: "🇷🇺", China: "🇨🇳", Japan: "🇯🇵",
  Germany: "🇩🇪", France: "🇫🇷", Canada: "🇨🇦", Brazil: "🇧🇷", Mexico: "🇲🇽",
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

  const list = q.data ?? [];
  const [c1, c2, c3] = [list[0], list[1], list[2]];
  const rest = list.slice(3);
  const activeCat = CATS.find((c) => c.k === category)!;

  return (
    <>
      <AppShell title="" subtitle="" showHeader={false}>
        <div className="relative min-h-full [overflow-x:clip] pb-36 text-white bg-[#1a0003] selection:bg-rose-600">
          {/* Velvet Red Background Curves */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-rose-600/20 blur-[150px]" />
            <div className="absolute top-28 -left-32 h-80 w-80 rounded-full bg-red-900/30 blur-[120px]" />
            <div className="absolute top-72 -right-32 h-80 w-80 rounded-full bg-rose-600/15 blur-[120px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/70 via-[#1e0003]/90 to-[#0a0001]" />
          </div>

          {/* Header */}
          <RankHeader onBack={() => router.history.back()} onHelp={() => setHelpOpen(true)} userId={user?.id} />

          {/* Categories Navigation */}
          <nav className="relative z-10 mt-1 overflow-x-auto no-scrollbar border-b border-white/10 pb-2">
            <ul className="flex gap-6 px-4">
              {CATS.map(({ k, label, Icon }) => {
                const active = category === k;
                return (
                  <li key={k}>
                    <button
                      onClick={() => setCategory(k)}
                      className={`group inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium transition py-1 border-b-2 ${
                        active
                          ? "border-amber-300 text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                          : "border-transparent text-white/65 hover:text-white"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${active ? "text-amber-300" : "text-white/50"}`} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sub-Filter Bar */}
          <section className="relative z-10 mt-3 px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-md">
              {PERIODS.map(({ k, label }) => {
                const active = period === k;
                return (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      active
                        ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-900/50"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <CountrySelect value={country} onChange={setCountry} />
          </section>

          {/* ── Top 3 Podium Section: [3rd Left | 1st Center Top | 2nd Right] ── */}
          <section className="relative z-10 mt-6 px-2">
            <div className="grid grid-cols-3 items-end gap-1.5 pt-12">
              <Podium row={c3} place={3} />
              <Podium row={c1} place={1} />
              <Podium row={c2} place={2} />
            </div>
          </section>

          {/* ── Leaderboard List (Rank 4 onwards - No Coins displayed) ── */}
          <section className="relative z-10 mt-6 px-4">
            {q.isLoading ? (
              <ul className="space-y-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </ul>
            ) : rest.length === 0 && list.length <= 3 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-2.5">
                {rest.map((r) => <RankRow key={r.user_id} row={r} />)}
              </ul>
            )}
          </section>
        </div>
      </AppShell>

      {/* Sticky "My Rank" Footer Bar (No Coins shown) */}
      {user && (
        <MyRank
          row={meQ.data ?? null}
          fallback={profile}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <BottomNav />
    </>
  );
}

function RankHeader({ onBack, onHelp, userId: _userId }: {
  onBack: () => void; onHelp: () => void; userId: string | undefined;
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/5 bg-[#140002]/90 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
        <button
          onClick={onBack}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/90 hover:text-amber-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 text-center">
          <h1 className="text-lg font-black tracking-wider text-rose-100 font-serif italic drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
            Rankings
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onHelp}
            aria-label="Ranking rules"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/90 hover:text-amber-300"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────  Podium Component (Image Placeholders Ready)  ───────────────────────────── */

function Podium({ row, place }: { row?: Row; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;
  const isSecond = place === 2;

  // Aap yahan apni image files ke paths set kar sakte hain (jaise public/images/crown-1.png)
  const crownImage = isFirst 
    ? "/images/crown-1.png" 
    : isSecond 
    ? "/images/crown-2.png" 
    : "/images/crown-3.png";

  const bannerGradient = isFirst
    ? "from-[#8a0f1e] via-[#52030b] to-[#240003] border-amber-400/90 shadow-[0_0_35px_rgba(251,191,36,0.45)]"
    : isSecond
    ? "from-[#0d3e75] via-[#072445] to-[#020e1c] border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.4)]"
    : "from-[#8a440f] via-[#542804] to-[#240d01] border-amber-600/80 shadow-[0_0_25px_rgba(245,158,11,0.4)]";

  const content = (
    <div className={`relative flex flex-col items-center ${isFirst ? "-mt-16" : "-mt-4"}`}>
      {/* 3D Crown Image Container (Aap yahan apni crown image laga dein) */}
      <div className={`absolute z-30 pointer-events-none ${isFirst ? "-top-16 h-20 w-20" : "-top-14 h-16 w-16"}`}>
        <img 
          src={crownImage} 
          alt={`Crown ${place}`} 
          className="w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.95)]" 
          onError={(e) => {
            // Fallback agar image na mile taake layout kharab na ho
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      {/* Main Shield Banner Container (No coins displayed inside) */}
      <div className={`relative w-full rounded-2xl border-2 pt-7 pb-4 px-2 flex flex-col items-center bg-gradient-to-b ${bannerGradient}`}>
        {/* Top Tag Badge */}
        <div className="absolute top-2 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/15 text-[8px] font-black tracking-widest text-amber-300 uppercase shadow">
          TOP {place}
        </div>

        {/* Avatar Ring */}
        <div className={`relative rounded-full p-0.5 mt-3 border-2 ${isFirst ? "border-amber-300 h-16 w-16 shadow-[0_0_15px_rgba(251,191,36,0.7)]" : "border-white/30 h-14 w-14"}`}>
          <LevelAvatar
            src={row?.avatar ?? undefined}
            name={row?.username ?? undefined}
            level={row?.level ?? 0}
            size={isFirst ? "lg" : "md"}
            showBadge={false}
          />
        </div>

        {/* Username */}
        <p className="mt-2 max-w-[85px] truncate text-center text-[12px] font-black text-white drop-shadow">
          {row?.username ?? "—"}
        </p>

        {/* Level and Country details */}
        <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-white/95">
          <span className="rounded bg-amber-500/25 border border-amber-400/40 px-1 py-0.5 text-amber-300 font-bold">
            N{row?.level ?? 1}
          </span>
          <span className="rounded bg-purple-500/25 border border-purple-400/40 px-1 py-0.5 text-purple-200">
            Lv.{row?.vip_level ?? 0}
          </span>
          {row?.country && COUNTRY_FLAG[row.country] && (
            <span>{COUNTRY_FLAG[row.country]}</span>
          )}
        </div>
      </div>
    </div>
  );

  if (!row) return <div className="opacity-40">{content}</div>;
  return (
    <Link to="/u/$userId" params={{ userId: row.user_id }} className="block">
      {content}
    </Link>
  );
}

/* ─────────────────────────────  Rank Row (Ranks 4+) - No Coins  ───────────────────────────── */

function RankRow({ row }: { row: Row }) {
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: row.user_id }}
        className="grid grid-cols-[32px_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-rose-600/25 bg-gradient-to-r from-rose-950/50 via-red-950/25 to-black/50 px-3.5 py-2.5 backdrop-blur-md transition hover:border-rose-400/60 hover:bg-rose-900/40 shadow-lg shadow-black/30"
      >
        <span className="text-center text-[14px] font-black text-white/75 font-serif">
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
          <p className="truncate text-[13px] font-bold leading-tight text-white">
            {row.username ?? "user"}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded bg-amber-500/20 border border-amber-400/30 px-1 py-[0.5px] text-[9px] font-bold text-amber-300">
              N{row.level}
            </span>
            <span className="rounded bg-purple-500/20 border border-purple-400/30 px-1.5 py-[0.5px] text-[9px] font-bold text-purple-200">
              Lv.{row.vip_level}
            </span>
            <span className="text-xs">
              {row.country && COUNTRY_FLAG[row.country] ? COUNTRY_FLAG[row.country] : "🌐"}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

/* ─────────────────────────────  My Rank Footer (No Coins)  ───────────────────────────── */

function MyRank({ row, fallback }: { row: Row | null; fallback: any }) {
  const avatar = row?.avatar ?? fallback?.avatar ?? null;
  const country = row?.country ?? fallback?.country ?? null;
  const rank = row?.rnk ?? null;
  const level = row?.level ?? fallback?.level ?? 1;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3">
      <div className="mx-auto max-w-[520px] rounded-2xl border border-amber-400/50 bg-[#1d0003]/95 p-3 backdrop-blur-xl shadow-[0_0_30px_rgba(251,191,36,0.3)]">
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3">
          <div className="text-center px-1">
            <p className="text-[9px] uppercase tracking-wider text-amber-300">My Rank</p>
            <p className="text-lg font-black leading-none text-white">{rank ? `#${rank}` : "—"}</p>
          </div>

          <LevelAvatar
            src={avatar ?? undefined}
            name={row?.username ?? fallback?.username ?? undefined}
            level={level}
            size="sm"
            showBadge={false}
          />

          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-white">
              {row?.username ?? fallback?.username ?? "You"}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <span className="rounded bg-amber-500/20 border border-amber-400/30 px-1 py-[0.5px] text-[9px] font-bold text-amber-300">
                N{level}
              </span>
              <span className="text-[10px] text-white/60 truncate">
                {country ?? "Pakistan"} {country && COUNTRY_FLAG[country] ? COUNTRY_FLAG[country] : "🇵🇰"}
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
        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md"
      >
        <Globe2 className="h-3.5 w-3.5 text-amber-300" />
        {value} <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-72 w-44 overflow-auto rounded-2xl border border-rose-500/30 bg-[#140002]/95 p-1 shadow-2xl backdrop-blur-xl">
          {options.length === 1 ? (
            <p className="px-3 py-2 text-[11px] text-white/50">No country data yet</p>
          ) : options.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] transition hover:bg-rose-900/40 ${value === c ? "bg-rose-900/50 text-amber-300 font-bold" : "text-white/70"}`}
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
    <div className="mx-auto mt-6 max-w-[280px] rounded-2xl border border-white/10 bg-black/20 p-6 text-center backdrop-blur-md">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/40 bg-amber-500/10">
        <Gem className="h-6 w-6 text-amber-300" />
      </div>
      <p className="text-sm font-bold text-white">Throne awaits</p>
      <p className="mt-1 text-xs text-white/50">Be the first to climb this leaderboard.</p>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#140002]/95 p-5 shadow-2xl shadow-rose-950/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-rose-100">Ranking rules</h2>
          <button onClick={onClose} className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">Close</button>
        </div>
        <ul className="space-y-2 text-[13px] leading-relaxed text-white/80">
          <li><b className="text-amber-300">Room Gift</b> — total coins received through live room gifts.</li>
          <li><b className="text-amber-300">Points</b> — XP earned across your app activities.</li>
          <li><b className="text-amber-300">Gifters</b> — total coins spent sending gifts.</li>
          <li><b className="text-amber-300">PK King</b> — battles won in live PK matches.</li>
          <li><b className="text-amber-300">VIP / Royals</b> — VIP level progression tiers.</li>
        </ul>
      </div>
    </div>
  );
}

declare module "react" { interface CSSProperties { WebkitOverflowScrolling?: "auto" | "touch" } }
