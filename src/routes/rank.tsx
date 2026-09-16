import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, HelpCircle, Trophy, Star, Mic, Gift, Swords, Gem, Sparkles,
  Flame, Globe2, ChevronDown, ShieldCheck, ArrowUpDown,
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
type Scope = "global" | "country";

type Row = {
  user_id: string; username: string | null; avatar: string | null;
  country: string | null; vip_level: number; level: number;
  score: number; rnk: number;
};

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "points",   label: "Gift Share", Icon: Star },
  { k: "hosts",    label: "Room Gift",  Icon: Gift },
  { k: "gifters",  label: "Room Tier",  Icon: Mic },
  { k: "pk",       label: "Tribe",      Icon: Swords },
  { k: "vip",      label: "Rela",       Icon: Gem },
  { k: "royals",   label: "Royals",     Icon: Sparkles },
  { k: "popular",  label: "Popular",    Icon: Flame },
  { k: "country",  label: "Country",    Icon: Globe2 },
];

const PERIODS: { k: Period; label: string }[] = [
  { k: "daily", label: "Daily" },
  { k: "weekly", label: "Weekly" },
  { k: "monthly", label: "Monthly" },
  { k: "all", label: "All" },
];

const COUNTRY_FLAG: Record<string, string> = {
  Pakistan: "🇵🇰", India: "🇮🇳", Bangladesh: "🇧🇩", "Saudi Arabia": "🇸🇦",
  UAE: "🇦🇪", Turkey: "🇹🇷", Egypt: "🇪🇬", Indonesia: "🇮🇩", Malaysia: "🇲🇾",
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", Philippines: "🇵🇭",
  Nigeria: "🇳🇬", Morocco: "🇲🇦", Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦",
};

const PODIUM_ASSETS: Record<1 | 2 | 3, string> = {
  1: "/images/top1.png",
  2: "/images/top2.png",
  3: "/images/top3.png",
};

function RankPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [category, setCategory] = useState<Category>("hosts");
  const [period, setPeriod] = useState<Period>("daily");
  const [country, setCountry] = useState<string>("Global");
  const [helpOpen, setHelpOpen] = useState(false);

  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country"
    ? (country === "Global" ? (profile?.country ?? "Pakistan") : country)
    : null;

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
        <main className="relative min-h-[100svh] overflow-x-clip bg-[#3a0508] text-white selection:bg-red-300 selection:text-[#3a0508]">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-[430px] w-[430px] -translate-x-1/2 rounded-full bg-[#ff4d5d]/25 blur-[110px]" />
            <div className="absolute top-20 -left-32 h-[360px] w-[360px] rounded-full bg-[#b9001b]/30 blur-[100px]" />
            <div className="absolute top-[330px] -right-36 h-[380px] w-[380px] rounded-full bg-[#ff3048]/20 blur-[120px]" />
            <div className="absolute top-[145px] left-1/2 h-[2px] w-[125%] -translate-x-1/2 rotate-[14deg] bg-white/35 blur-[1px]" />
          </div>

          <header
            className="relative z-20 px-3 pb-1"
            style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
          >
            <div className="mx-auto grid max-w-[430px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 px-1 pt-1">
              <button
                aria-label="Go back"
                onClick={() => router.history.back()}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/10 text-white/90 transition active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <h1 className="text-center font-serif text-[30px] font-bold italic leading-none tracking-tight text-[#ffd2d8] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]">
                Rankings
              </h1>

              <button
                aria-label="Ranking information"
                onClick={() => setHelpOpen(true)}
                className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-white/75 bg-black/10 text-white transition active:scale-95"
              >
                <HelpCircle className="h-[18px] w-[18px]" />
              </button>
            </div>

            <nav className="no-scrollbar mx-auto mt-4 max-w-[430px] overflow-x-auto px-0.5">
              <ul className="flex min-w-max items-center gap-[26px] text-[10px] font-medium text-white/75">
                {CATS.map(({ k, label }) => {
                  const active = category === k;
                  return (
                    <li key={k}>
                      <button
                        onClick={() => setCategory(k)}
                        className={`relative whitespace-nowrap pb-2 transition ${active ? "font-bold text-white" : "text-white/70"}`}
                      >
                        {label}
                        {active && <span className="absolute inset-x-0 -bottom-px mx-auto h-[2px] rounded-full bg-white" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mx-auto mt-2 flex max-w-[430px] items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur-sm">
                {PERIODS.map(({ k, label }) => {
                  const active = period === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setPeriod(k)}
                      className={`rounded-full px-3 py-1 text-[10px] font-medium transition ${active ? "bg-white text-[#8f1019] shadow-sm" : "text-white/80"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <CountrySelect value={country} onChange={setCountry} compact />
            </div>
          </header>

          <section className="relative z-10 mx-auto mt-3 max-w-[430px] px-3">
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#50070d]/75 px-2 pb-2 pt-7 shadow-[0_18px_50px_rgba(45,0,4,.35)] backdrop-blur-sm">
              <div aria-hidden className="absolute -top-16 left-1/2 h-32 w-[125%] -translate-x-1/2 rounded-[50%] border-b border-white/20 bg-[#a70b19]/45" />
              <div className="relative grid grid-cols-3 items-end gap-1.5 sm:gap-2">
                <PodiumCard row={c2} place={2} />
                <PodiumCard row={c1} place={1} />
                <PodiumCard row={c3} place={3} />
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto mt-3 max-w-[430px] px-3 pb-32">
            {q.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[62px] animate-pulse rounded-xl border border-white/10 bg-white/5" />
                ))}
              </div>
            ) : q.isError ? (
              <div className="rounded-xl border border-white/10 bg-black/15 p-5 text-center text-xs text-white/70">
                Rankings could not be loaded right now.
              </div>
            ) : rest.length === 0 && list.length <= 3 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-2">
                {rest.map((r) => <RankItem key={r.user_id} row={r} />)}
              </ul>
            )}
          </section>
        </main>
      </AppShell>

      {user && <MyRankCard row={meQ.data ?? null} fallback={profile} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <BottomNav />
    </>
  );
}

function PodiumCard({ row, place }: { row?: Row; place: 1 | 2 | 3 }) {
  const isFirst = place === 1;
  const tone = place === 1
    ? { card: "bg-[#a90b1b]/90 border-[#e83248]", label: "bg-[#f1b41b] text-[#5b1d00]", avatar: "border-white", score: "text-[#ffe66b]" }
    : place === 2
    ? { card: "bg-[#10529d]/90 border-[#2278c8]", label: "bg-[#1d70cf] text-white", avatar: "border-[#8ad7ff]", score: "text-[#ffe66b]" }
    : { card: "bg-[#bd7106]/90 border-[#e3a21d]", label: "bg-[#e2a915] text-[#5b2100]", avatar: "border-[#ffe18a]", score: "text-[#ffe66b]" };

  const content = (
    <div className={`relative flex min-h-[154px] w-full flex-col items-center rounded-[14px] border px-1.5 pb-2 pt-3 shadow-[0_12px_25px_rgba(0,0,0,.22)] ${tone.card} ${isFirst ? "min-h-[176px] -mt-3" : ""}`}>
      {/* Custom Figma podium/crown artwork. Upload these exact files to public/images/. */}
      <img
        src={PODIUM_ASSETS[place]}
        alt={`Top ${place}`}
        className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 object-contain drop-shadow-[0_4px_5px_rgba(0,0,0,.35)] ${isFirst ? "-top-[58px] h-[118px] w-[118px]" : "-top-[50px] h-[100px] w-[100px]"}`}
        draggable={false}
      />

      <div className={`relative z-20 mt-8 rounded-full border-2 bg-white p-[2px] shadow-[0_4px_12px_rgba(0,0,0,.28)] ${isFirst ? "h-[68px] w-[68px]" : "h-[58px] w-[58px]"} ${tone.avatar}`}>
        <LevelAvatar
          src={row?.avatar ?? undefined}
          name={row?.username ?? undefined}
          level={row?.level ?? 0}
          size={isFirst ? "lg" : "md"}
          showBadge={false}
        />
      </div>

      <span className={`relative z-30 -mt-1 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[8px] font-extrabold uppercase shadow-sm ${tone.label}`}>
        TOP {place}
      </span>

      <p className="mt-1 max-w-[94px] truncate text-center text-[10px] font-bold text-white">
        {row?.username ?? "—"}
      </p>
      <div className="mt-1 flex items-center gap-1 text-[8px] text-white/90">
        <span className="rounded bg-black/15 px-1.5 py-0.5">N{row?.level ?? 1}</span>
        <span className="rounded bg-black/15 px-1.5 py-0.5">Lvl{row?.level ?? 1}</span>
      </div>
      <p className={`mt-1 text-[12px] font-extrabold ${tone.score}`}>
        {formatScore(row?.score ?? 0)}
      </p>
    </div>
  );

  if (!row) return <div className="opacity-35">{content}</div>;
  return <Link to="/u/$userId" params={{ userId: row.user_id }} className="block min-w-0">{content}</Link>;
}

function RankItem({ row }: { row: Row }) {
  return (
    <li>
      <Link
        to="/u/$userId"
        params={{ userId: row.user_id }}
        className="grid grid-cols-[24px_40px_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-white/20 bg-[#650a11]/45 px-2.5 py-2.5 shadow-[0_5px_18px_rgba(0,0,0,.12)] backdrop-blur-sm transition active:scale-[.99]"
      >
        <span className="text-center text-[15px] font-medium text-white">{row.rnk}</span>
        <div className="h-10 w-10 rounded-full border border-white/30 bg-white/10 p-[2px]">
          <LevelAvatar
            src={row.avatar ?? undefined}
            name={row.username ?? undefined}
            level={row.level ?? 0}
            size="sm"
            showBadge={false}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">{row.username ?? "user"}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/75">
            <span className="rounded bg-black/15 px-1.5 py-0.5">N{row.level}</span>
            <span>•</span>
            <span>Lvl{row.level}</span>
            <span className="text-[12px]">{row.country && COUNTRY_FLAG[row.country] ? COUNTRY_FLAG[row.country] : "🇵🇰"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[12px] font-bold text-[#ffe36a]">
          <span className="text-[11px]">◉</span>{formatScore(row.score)}
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
    <div className="fixed inset-x-0 bottom-16 z-40 px-3">
      <div className="mx-auto max-w-[430px] rounded-2xl border border-[#ffb4bd]/40 bg-[#4a070d]/95 p-3 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,.3)]">
        <div className="grid grid-cols-[auto_40px_minmax(0,1fr)] items-center gap-3">
          <div className="text-center px-1">
            <p className="text-[8px] uppercase tracking-wider text-[#ffcbd1] font-bold">My Rank</p>
            <p className="text-base font-extrabold text-white">{rank ? `#${rank}` : "—"}</p>
          </div>
          <LevelAvatar src={avatar ?? undefined} name={row?.username ?? fallback?.username ?? undefined} level={level} size="sm" showBadge={false} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{row?.username ?? fallback?.username ?? "You"}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/75">
              <span>Lvl{level}</span>
              <span>{country && COUNTRY_FLAG[country] ? COUNTRY_FLAG[country] : "🌐"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CountrySelect({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
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
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${compact ? "px-3 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"} inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#7f0d17]/70 font-semibold text-white backdrop-blur-md transition active:scale-95`}
      >
        <span>{value === "Global" ? "Today" : value}</span>
        <ArrowUpDown className="h-3 w-3 text-white/80" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 max-h-64 w-44 overflow-auto rounded-xl border border-white/15 bg-[#4a070d]/98 p-1 shadow-2xl backdrop-blur-xl">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${value === c ? "bg-white/15 text-white font-bold" : "text-white/75 hover:bg-white/10"}`}
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
    <div className="mx-auto mt-5 max-w-[280px] rounded-2xl border border-white/15 bg-white/5 p-7 text-center backdrop-blur-md">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#ffd45d]"><Trophy className="h-6 w-6" /></div>
      <p className="text-sm font-bold text-white">No Rankings Yet</p>
      <p className="mt-1 text-xs text-white/60">Be the first to claim your spot on the leaderboard.</p>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#4a070d]/98 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white"><ShieldCheck className="h-5 w-5 text-[#ffd45d]" /> Ranking Rules</h2>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">Close</button>
        </div>
        <ul className="space-y-2.5 text-xs leading-relaxed text-white/75">
          <li><b className="text-[#ffd45d]">Room Gift</b> — Calculated based on gifts received during live streams.</li>
          <li><b className="text-[#ffd45d]">Points & XP</b> — Earned through general activity across app features.</li>
          <li><b className="text-[#ffd45d]">PK Battles</b> — Ranked by total successful victories in PK matches.</li>
          <li><b className="text-[#ffd45d]">VIP & Royals</b> — Based on active VIP tier status and progression.</li>
        </ul>
        <p className="mt-4 text-center text-[10px] text-white/40">Resets daily at 00:00 UTC · Weekly on Monday · Monthly on the 1st</p>
      </div>
    </div>
  );
}

function formatScore(score: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(score || 0);
}

declare module "react" { interface CSSProperties { WebkitOverflowScrolling?: "auto" | "touch" } }
