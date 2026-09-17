import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, HelpCircle, Trophy, Star, Mic, Gift, Swords, 
  Gem, Sparkles, Flame, Globe2, ShieldCheck, ArrowUpDown, 
  Crown, Medal, Zap, TrendingUp 
} from "lucide-react";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({ 
    meta: [
      { title: "Rankings — Jalwa Global Live" }, 
      { name: "description", content: "Top leaderboards and luxury rankings on Jalwa." }
    ] 
  }),
});

type Category = "points" | "hosts" | "gifters" | "pk" | "vip" | "royals" | "popular" | "country";
type Period = "daily" | "weekly" | "monthly" | "all";
type Scope = "global" | "country";
type Row = { user_id: string; username: string | null; avatar: string | null; country: string | null; vip_level: number; level: number; score: number; rnk: number };

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "points", label: "Gift Share", Icon: Star }, 
  { k: "hosts", label: "Room Gift", Icon: Gift },
  { k: "gifters", label: "Room Tier", Icon: Mic }, 
  { k: "pk", label: "Tribe", Icon: Swords },
  { k: "vip", label: "Rela", Icon: Gem }, 
  { k: "royals", label: "Royals", Icon: Sparkles },
  { k: "popular", label: "Popular", Icon: Flame }, 
  { k: "country", label: "Country", Icon: Globe2 },
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
  Nigeria: "🇳🇬", Morocco: "🇲🇦", Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦" 
};

function RankPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<Category>("hosts");
  const [period, setPeriod] = useState<Period>("daily");
  const [country, setCountry] = useState("Global");
  const [helpOpen, setHelpOpen] = useState(false);
  
  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country" ? (country === "Global" ? (profile?.country ?? "Pakistan") : country) : null;

  const q = useQuery({ 
    queryKey: ["rank_users_v2", category, period, scope, scopeValue], 
    staleTime: 30_000, 
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rank_users", { 
        p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue, p_limit: 100 
      });
      if (error) throw error; 
      return (data ?? []) as Row[];
    }
  });

  const meQ = useQuery({ 
    queryKey: ["rank_me_v2", category, period, scope, scopeValue, user?.id], 
    enabled: !!user?.id, 
    staleTime: 30_000, 
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rank_me", { 
        p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue 
      });
      if (error) throw error; 
      return (data?.[0] ?? null) as Row | null;
    }
  });

  const list = q.data ?? [], c1 = list[0], c2 = list[1], c3 = list[2], rest = list.slice(3);

  return (
    <>
      <AppShell title="" subtitle="" showHeader={false}>
        <main className="relative min-h-[100svh] overflow-x-clip bg-[#160104] text-white selection:bg-[#ffd76a] selection:text-[#1a0104]">
          
          {/* Luxury Ambient Lighting & Glows */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div 
              animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#e61937]/30 to-[#ffb703]/20 blur-[140px]" 
            />
            <div className="absolute top-[280px] -left-40 h-[400px] w-[400px] rounded-full bg-[#9c0a1a]/25 blur-[130px]" />
            <div className="absolute top-[550px] -right-40 h-[420px] w-[420px] rounded-full bg-[#ff334b]/15 blur-[140px]" />
            <div className="absolute inset-x-0 top-0 h-[280px] bg-gradient-to-b from-[#780816]/50 via-[#3a0309]/20 to-transparent" />
          </div>

          {/* Header Section */}
          <header className="relative z-20 px-3 pb-2" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
            <div className="mx-auto grid max-w-[430px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 px-1 pt-1">
              <motion.button 
                whileTap={{ scale: 0.92 }}
                onClick={() => router.history.back()} 
                className="grid h-10 w-10 place-items-center rounded-full border border-amber-500/30 bg-gradient-to-b from-white/10 to-white/5 text-amber-200 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>

              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent px-3 py-0.5 border border-amber-500/30">
                  <Sparkles className="h-2.5 w-2.5 text-amber-300 animate-pulse" />
                  <p className="text-[8px] font-extrabold uppercase tracking-[.38em] text-amber-200">JALWA LUXURY</p>
                </div>
                <h1 className="mt-1 font-serif text-[30px] font-extrabold italic leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ffe5e8] to-[#ffc56c] drop-shadow-[0_4px_12px_rgba(255,215,106,0.25)]">
                  Rankings
                </h1>
              </div>

              <motion.button 
                whileTap={{ scale: 0.92 }}
                onClick={() => setHelpOpen(true)} 
                className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-amber-500/30 bg-gradient-to-b from-white/10 to-white/5 text-amber-200 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              >
                <HelpCircle className="h-[18px] w-[18px]" />
              </motion.button>
            </div>

            {/* Category Navigation Bar */}
            <nav className="no-scrollbar mx-auto mt-4 max-w-[430px] overflow-x-auto px-1">
              <ul className="flex min-w-max items-center gap-[22px] border-b border-amber-500/15 pb-0 text-[10px] font-semibold text-white/60">
                {CATS.map(({ k, label, Icon }) => { 
                  const active = category === k; 
                  return (
                    <li key={k}>
                      <button 
                        onClick={() => setCategory(k)} 
                        className={`relative flex items-center gap-1.5 whitespace-nowrap pb-3 transition-all duration-300 ${active ? "font-bold text-amber-300 scale-105" : "hover:text-white/90"}`}
                      >
                        <Icon className={`h-3.5 w-3.5 transition-colors ${active ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-white/40"}`} />
                        {label}
                        {active && (
                          <motion.span 
                            layoutId="activeCategoryIndicator"
                            className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.9)]" 
                          />
                        )}
                      </button>
                    </li>
                  ); 
                })}
              </ul>
            </nav>

            {/* Period Filter & Country Selector */}
            <div className="mx-auto mt-3.5 flex max-w-[430px] items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-black/30 p-1 shadow-inner backdrop-blur-xl">
                {PERIODS.map(({ k, label }) => { 
                  const active = period === k; 
                  return (
                    <button 
                      key={k} 
                      onClick={() => setPeriod(k)} 
                      className={`relative rounded-full px-3 py-1.5 text-[9px] font-extrabold tracking-wider transition-all ${active ? "bg-gradient-to-r from-amber-300 to-amber-500 text-[#2b0307] shadow-[0_3px_15px_rgba(255,215,106,0.35)] scale-105" : "text-white/65 hover:text-white"}`}
                    >
                      {label}
                    </button>
                  ); 
                })}
              </div>
              <CountrySelect value={country} onChange={setCountry} compact />
            </div>
          </header>

          {/* Top 3 Podium Section */}
          <section className="relative z-10 mx-auto mt-4 max-w-[430px] px-3">
            <div className="relative overflow-hidden rounded-[32px] border border-amber-400/30 bg-gradient-to-b from-[#5c0712]/95 via-[#350308]/95 to-[#1a0104]/98 px-2 pb-4 pt-9 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              
              {/* Luxury Gold Shimmer Border Glow */}
              <div aria-hidden className="absolute inset-0 rounded-[32px] border border-white/10 pointer-events-none" />
              <div aria-hidden className="absolute left-1/2 top-0 h-28 w-[85%] -translate-x-1/2 rounded-b-[50%] bg-gradient-to-b from-amber-400/20 to-transparent blur-2xl" />
              <div aria-hidden className="absolute left-1/2 top-0 h-px w-[75%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
              
              <div className="relative grid grid-cols-[1fr_1.15fr_1fr] items-end gap-1.5 sm:gap-2">
                <PodiumCard row={c2} place={2} />
                <PodiumCard row={c1} place={1} />
                <PodiumCard row={c3} place={3} />
              </div>
            </div>
          </section>

          {/* Leaderboard List Section */}
          <section className="relative z-10 mx-auto mt-4 max-w-[430px] px-3 pb-36">
            <div className="mb-2.5 flex items-center justify-between px-1.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[9px] font-black uppercase tracking-[.25em] text-amber-200/80">Elite Rankings</p>
              </div>
              <p className="text-[9px] font-bold text-amber-300/60 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {list.length ? `${list.length} Contenders` : "Live Feed"}
              </p>
            </div>

            {q.isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-[68px] animate-pulse rounded-2xl border border-amber-500/15 bg-white/5 backdrop-blur-md" />
                ))}
              </div>
            ) : q.isError ? (
              <div className="rounded-2xl border border-red-500/25 bg-black/30 p-6 text-center text-xs text-red-200 backdrop-blur-xl">
                Rankings could not be synced securely. Please retry.
              </div>
            ) : rest.length === 0 && list.length <= 3 ? (
              <EmptyState />
            ) : (
              <motion.ul 
                initial="hidden" 
                animate="show" 
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
                className="space-y-2.5"
              >
                {rest.map((r, index) => (
                  <motion.li 
                    key={r.user_id}
                    variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                  >
                    <RankItem row={r} index={index + 4} />
                  </motion.li>
                ))}
              </motion.ul>
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
  const first = place === 1, second = place === 2;
  const accent = first ? "#fbbf24" : second ? "#93c5fd" : "#f59e0b";
  const cardGradient = first 
    ? "from-[#990d21] via-[#6e0815] to-[#42040c]" 
    : second 
    ? "from-[#3b5985] via-[#263c59] to-[#162232]" 
    : "from-[#8c4912] via-[#613109] to-[#361a05]";

  const content = (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      className={`group relative flex min-h-[175px] w-full flex-col items-center overflow-visible rounded-[24px] border px-1.5 pb-3.5 pt-4 bg-gradient-to-b ${cardGradient} ${first ? "min-h-[200px] -mt-5" : ""}`}
      style={{ 
        borderColor: `${accent}44`, 
        boxShadow: first ? `0 20px 50px rgba(251,191,36,0.22), inset 0 1px 0 rgba(255,255,255,0.25)` : `0 14px 35px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)` 
      }}
    >
      {/* Background Glow */}
      <div aria-hidden className="absolute inset-x-2 top-1 h-16 rounded-full blur-xl" style={{ background: `${accent}25` }} />
      
      {/* Crown / Badge Header */}
      <div className="relative z-10 flex h-6 items-center justify-center">
        {first ? (
          <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <Crown className="h-6 w-6 text-amber-300 fill-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
          </motion.div>
        ) : (
          <Medal className="h-4 w-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ color: accent }} />
        )}
      </div>

      {/* Avatar Container with Animated Rings */}
      <div 
        className={`relative z-10 mt-1 rounded-full border-2 bg-black/40 p-[3px] shadow-2xl ${first ? "h-[76px] w-[76px]" : "h-[64px] w-[64px]"}`} 
        style={{ borderColor: accent, boxShadow: `0 0 0 4px ${accent}20, 0 10px 25px rgba(0,0,0,0.5)` }}
      >
        <LevelAvatar src={row?.avatar ?? undefined} name={row?.username ?? undefined} level={row?.level ?? 0} size={first ? "lg" : "md"} showBadge={false} />
      </div>

      {/* Rank Badge */}
      <div 
        className="relative z-20 -mt-2 rounded-full border px-2.5 py-0.5 text-[8px] font-black tracking-[.15em] shadow-lg" 
        style={{ background: `${accent}30`, borderColor: `${accent}70`, color: accent }}
      >
        #{place}
      </div>

      {/* User Name */}
      <p className="mt-1.5 max-w-[105px] truncate text-center text-[11px] font-extrabold text-white drop-shadow">
        {row?.username ?? "—"}
      </p>

      {/* Level & Country Info */}
      <div className="mt-0.5 flex items-center gap-1 text-[8px] font-semibold text-white/65">
        <span>LVL {row?.level ?? 1}</span>
        {row?.country && <><span>•</span><span>{COUNTRY_FLAG[row.country] ?? "🌐"}</span></>}
      </div>

      {/* Score */}
      <p className="mt-1.5 text-[13px] font-black tracking-tight" style={{ color: accent, textShadow: `0 2px 10px ${accent}40` }}>
        {formatScore(row?.score ?? 0)}
      </p>

      {/* Bottom Shimmer Line */}
      {first && (
        <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      )}
    </motion.div>
  );

  if (!row) return <div className="opacity-30 filter grayscale">{content}</div>;
  return <Link to="/u/$userId" params={{ userId: row.user_id }} className="block min-w-0">{content}</Link>;
}

function RankItem({ row, index }: { row: Row; index: number }) { 
  const special = row.rnk <= 10; 
  return (
    <Link 
      to="/u/$userId" 
      params={{ userId: row.user_id }} 
      className="group grid grid-cols-[34px_48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[20px] border border-amber-500/15 bg-gradient-to-r from-white/[.08] via-white/[.04] to-white/[.02] px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-300 hover:border-amber-400/40 hover:bg-white/[.1]"
    >
      <div className={`text-center text-[13px] font-black ${special ? "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-white/50"}`}>
        {row.rnk}
      </div>
      
      <div className="h-12 w-12 rounded-full border border-amber-500/30 bg-black/30 p-[2.5px] shadow-md">
        <LevelAvatar src={row.avatar ?? undefined} name={row.username ?? undefined} level={row.level ?? 0} size="sm" showBadge={false} />
      </div>
      
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-white group-hover:text-amber-200 transition-colors">
          {row.username ?? "user"}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[9px] font-medium text-white/50">
          <span className="text-amber-400/90 font-semibold">Lvl {row.level}</span>
          <span>•</span>
          <span>{row.country ? (COUNTRY_FLAG[row.country] ?? row.country) : "🌐"}</span>
        </div>
      </div>
      
      <div className="text-right">
        <p className="text-[13px] font-black text-amber-300 tracking-tight drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]">
          {formatScore(row.score)}
        </p>
        <p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-widest text-amber-200/40">score</p>
      </div>
    </Link>
  ); 
}

function MyRankCard({ row, fallback }: { row: Row | null; fallback: any }) { 
  const avatar = row?.avatar ?? fallback?.avatar ?? null;
  const country = row?.country ?? fallback?.country ?? null;
  const rank = row?.rnk ?? null;
  const level = row?.level ?? fallback?.level ?? 1; 

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mx-auto max-w-[430px] rounded-[24px] border border-amber-400/40 bg-[#2b0308]/98 p-3 shadow-[0_15px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
      >
        <div className="grid grid-cols-[46px_46px_minmax(0,1fr)_auto] items-center gap-2.5">
          <div className="text-center bg-amber-500/10 py-1 rounded-xl border border-amber-500/20">
            <p className="text-[7px] font-black uppercase tracking-wider text-amber-300/80">My Rank</p>
            <p className="text-xs font-black text-amber-200">{rank ? `#${rank}` : "—"}</p>
          </div>
          
          <div className="h-11 w-11 rounded-full border border-amber-400/50 p-[2px] shadow-lg bg-black/40">
            <LevelAvatar src={avatar ?? undefined} name={row?.username ?? fallback?.username ?? undefined} level={level} size="sm" showBadge={false} />
          </div>
          
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">
              {row?.username ?? fallback?.username ?? "You"}
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-white/50">
              Lvl {level} · {country ? (COUNTRY_FLAG[country] ?? country) : "🌐"}
            </p>
          </div>
          
          <div className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-[10px] font-black text-[#2b0307] shadow-[0_4px_15px_rgba(251,191,36,0.4)]">
            {formatScore(row?.score ?? 0)}
          </div>
        </div>
      </motion.div>
    </div>
  ); 
}

function CountrySelect({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) { 
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null); 

  const { data: dbCountries } = useQuery({ 
    queryKey: ["rank-countries-v2"], 
    staleTime: 5 * 60_000, 
    queryFn: async () => { 
      const { data, error } = await supabase.from("profiles").select("country").not("country", "is", null).limit(2000); 
      if (error) throw error; 
      const set = new Set<string>(); 
      for (const r of (data ?? []) as { country: string | null }[]) 
        if (r.country?.trim()) set.add(r.country.trim()); 
      return Array.from(set).sort(); 
    } 
  }); 

  const options = useMemo(() => ["Global", ...(dbCountries ?? [])], [dbCountries]); 

  useEffect(() => { 
    const off = (e: MouseEvent) => { 
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); 
    }; 
    document.addEventListener("mousedown", off); 
    return () => document.removeEventListener("mousedown", off); 
  }, []); 

  return (
    <div ref={ref} className="relative shrink-0">
      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)} 
        className={`${compact ? "px-3.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"} inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-gradient-to-b from-white/10 to-white/5 font-extrabold text-amber-200 backdrop-blur-xl shadow-lg`}
      >
        <span>{value === "Global" ? "🌐 Global" : `${COUNTRY_FLAG[value] ?? "🏳️"} ${value}`}</span>
        <ArrowUpDown className="h-3 w-3 text-amber-400" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 z-50 mt-2 max-h-64 w-48 overflow-auto rounded-2xl border border-amber-500/30 bg-[#280206]/98 p-1.5 shadow-2xl backdrop-blur-2xl no-scrollbar"
          >
            {options.map(c => (
              <button 
                key={c} 
                onClick={() => { onChange(c); setOpen(false); }} 
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${value === c ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                <span>{c === "Global" ? "🌐" : (COUNTRY_FLAG[c] ?? "🏳️")}</span>
                <span className="truncate">{c}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ); 
}

function EmptyState() { 
  return (
    <div className="mx-auto mt-6 max-w-[280px] rounded-3xl border border-amber-500/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 text-center backdrop-blur-xl shadow-2xl">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
        <Trophy className="h-7 w-7" />
      </div>
      <p className="text-sm font-extrabold text-white">No Rankings Yet</p>
      <p className="mt-1 text-xs text-white/50 leading-relaxed">Be the first trailblazer to claim your elite spot on the leaderboard.</p>
    </div>
  ); 
}

function HelpModal({ onClose }: { onClose: () => void }) { 
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md rounded-[28px] border border-amber-500/30 bg-[#2b0308]/98 p-6 shadow-2xl backdrop-blur-2xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <ShieldCheck className="h-5 w-5 text-amber-400" /> Ranking Guidelines
          </h2>
          <button onClick={onClose} className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-bold text-white/80 hover:bg-white/10">
            Close
          </button>
        </div>
        <ul className="space-y-3 text-xs leading-relaxed text-white/70">
          <li><b className="text-amber-300">Room Gift</b> — Calculated precisely from live stream gift valuations.</li>
          <li><b className="text-amber-300">Gift Share & XP</b> — Earned via active engagement and platform events.</li>
          <li><b className="text-amber-300">Tribe / PK</b> — Ranked by victorious battle scores and arena wins.</li>
          <li><b className="text-amber-300">Royals & VIP</b> — Driven by exclusive tier progressions and status.</li>
        </ul>
        <p className="mt-5 text-center text-[10px] font-medium text-amber-300/40 uppercase tracking-wider">
          Resets Daily @ 00:00 UTC · Weekly on Monday · Monthly on the 1st
        </p>
      </motion.div>
    </div>
  ); 
}

function formatScore(n: number) { 
  if (!Number.isFinite(n)) return "0"; 
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`; 
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`; 
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`; 
  return String(Math.round(n)); 
}
