import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useThemeMode } from "@/hooks/useThemeMode";
import { ArrowLeft, HelpCircle, Trophy, Star, Mic, Gift, Swords, Gem, Sparkles, Flame, Globe2, ShieldCheck, ArrowUpDown, Crown, Medal, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({ meta: [{ title: "Rankings — Jalwa Global Live" }, { name: "description", content: "Top leaderboards and luxury rankings on Jalwa." }] }),
});

type Category = "points" | "hosts" | "gifters" | "pk" | "vip" | "royals" | "popular" | "country";
type Period = "daily" | "weekly" | "monthly" | "all";
type Scope = "global" | "country";
type Row = { user_id: string; username: string | null; avatar: string | null; country: string | null; vip_level: number; level: number; score: number; rnk: number };

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "points", label: "Gift Share", Icon: Star }, { k: "hosts", label: "Room Gift", Icon: Gift }, { k: "gifters", label: "Room Tier", Icon: Mic }, { k: "pk", label: "Tribe", Icon: Swords }, { k: "vip", label: "Rela", Icon: Gem }, { k: "royals", label: "Royals", Icon: Sparkles }, { k: "popular", label: "Popular", Icon: Flame }, { k: "country", label: "Country", Icon: Globe2 },
];
const PERIODS: { k: Period; label: string }[] = [{ k: "daily", label: "Daily" }, { k: "weekly", label: "Weekly" }, { k: "monthly", label: "Monthly" }, { k: "all", label: "All" }];
const COUNTRY_FLAG: Record<string, string> = { Pakistan: "🇵🇰", India: "🇮🇳", Bangladesh: "🇧🇩", "Saudi Arabia": "🇸🇦", UAE: "🇦🇪", Turkey: "🇹🇷", Egypt: "🇪🇬", Indonesia: "🇮🇩", Malaysia: "🇲🇾", "United States": "🇺🇸", "United Kingdom": "🇬🇧", Philippines: "🇵🇭", Nigeria: "🇳🇬", Morocco: "🇲🇦", Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦" };

function RankPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { mode } = useThemeMode();
  const [category, setCategory] = useState<Category>("hosts");
  const [period, setPeriod] = useState<Period>("daily");
  const [country, setCountry] = useState("Global");
  const [helpOpen, setHelpOpen] = useState(false);
  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country" ? (country === "Global" ? (profile?.country ?? "Pakistan") : country) : null;

  const q = useQuery({ queryKey: ["rank_users_v2", category, period, scope, scopeValue], staleTime: 30_000, queryFn: async () => { const { data, error } = await supabase.rpc("rank_users", { p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue, p_limit: 100 }); if (error) throw error; return (data ?? []) as Row[]; } });
  const meQ = useQuery({ queryKey: ["rank_me_v2", category, period, scope, scopeValue, user?.id], enabled: !!user?.id, staleTime: 30_000, queryFn: async () => { const { data, error } = await supabase.rpc("rank_me", { p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue }); if (error) throw error; return (data?.[0] ?? null) as Row | null; } });
  const list = q.data ?? [], c1 = list[0], c2 = list[1], c3 = list[2], rest = list.slice(3);

  return (<>
    <AppShell title="" subtitle="" showHeader={false}>
      <main data-theme-mode={mode} className="relative min-h-[100svh] overflow-x-clip bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <header className="relative z-20 px-3 pb-2" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
          <div className="mx-auto grid max-w-[430px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 px-1 pt-1">
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => router.history.back()} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground backdrop-blur-xl shadow-sm"><ArrowLeft className="h-5 w-5" /></motion.button>
            <div className="text-center"><div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-0.5 border border-border"><Sparkles className="h-2.5 w-2.5 text-primary" /><p className="text-[8px] font-extrabold uppercase tracking-[.38em] text-muted-foreground">JALWA GLOBAL</p></div><h1 className="mt-1 font-serif text-[30px] font-extrabold italic leading-none tracking-tight text-foreground">Rankings</h1></div>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setHelpOpen(true)} className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground backdrop-blur-xl shadow-sm"><HelpCircle className="h-[18px] w-[18px]" /></motion.button>
          </div>
          <nav className="no-scrollbar mx-auto mt-4 max-w-[430px] overflow-x-auto px-1"><ul className="flex min-w-max items-center gap-[22px] border-b border-border pb-0 text-[10px] font-semibold text-muted-foreground">{CATS.map(({ k, label, Icon }) => { const active = category === k; return <li key={k}><button onClick={() => setCategory(k)} className={`relative flex items-center gap-1.5 whitespace-nowrap pb-3 transition-all duration-300 ${active ? "font-bold text-foreground scale-105" : "hover:text-foreground/80"}`}><Icon className={`h-3.5 w-3.5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />{label}{active && <motion.span layoutId="activeCategoryIndicator" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-primary shadow-sm" />}</button></li>; })}</ul></nav>
          <div className="mx-auto mt-3.5 flex max-w-[430px] items-center justify-between gap-2 px-1"><div className="flex items-center gap-1 rounded-full border border-border bg-card/50 p-1 shadow-inner backdrop-blur-xl">{PERIODS.map(({ k, label }) => { const active = period === k; return <button key={k} onClick={() => setPeriod(k)} className={`relative rounded-full px-3 py-1.5 text-[9px] font-extrabold tracking-wider transition-all ${active ? "bg-primary text-primary-foreground shadow-sm scale-105" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>; })}</div><CountrySelect value={country} onChange={setCountry} compact /></div>
        </header>

        <section className="relative z-10 mx-auto mt-5 max-w-[430px] px-2">
          <div className="relative overflow-hidden rounded-[34px] border border-border bg-card/90 px-1.5 pb-5 pt-5 shadow-2xl backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
            <div className="relative mb-3 flex items-center justify-center gap-2"><span className="h-px w-10 bg-border" /><span className="rounded-full border border-border bg-secondary/80 px-3 py-1 text-[8px] font-black uppercase tracking-[.28em] text-muted-foreground">Top Champions</span><span className="h-px w-10 bg-border" /></div>
            <div className="relative grid grid-cols-[1fr_1.12fr_1fr] items-end gap-1 sm:gap-1.5">
              <PodiumCard row={c2} place={2} />
              <PodiumCard row={c1} place={1} />
              <PodiumCard row={c3} place={3} />
            </div>
            <div className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>
        </section>

        <section className="relative z-10 mx-auto mt-4 max-w-[430px] px-3 pb-36">
          <div className="mb-2.5 flex items-center justify-between px-1.5"><div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-primary" /><p className="text-[9px] font-black uppercase tracking-[.25em] text-muted-foreground">Elite Rankings</p></div><p className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[9px] font-bold text-muted-foreground">{list.length ? `${list.length} Contenders` : "Live Feed"}</p></div>
          {q.isLoading ? <div className="space-y-2.5">{[1, 2, 3, 4].map(i => <div key={i} className="h-[68px] animate-pulse rounded-2xl border border-border bg-card/40 backdrop-blur-md" />)}</div> : q.isError ? <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-center text-xs text-destructive backdrop-blur-xl">Rankings could not be synced securely. Please retry.</div> : rest.length === 0 && list.length <= 3 ? <EmptyState /> : <motion.ul initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }} className="space-y-2.5">{rest.map((r, index) => <motion.li key={r.user_id} variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}><RankItem row={r} index={index + 4} /></motion.li>)}</motion.ul>}
        </section>
      </main>
    </AppShell>
    {user && <MyRankCard row={meQ.data ?? null} fallback={profile} />}
    {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    <BottomNav />
  </>);
}

function PodiumCard({ row, place }: { row?: Row; place: 1 | 2 | 3 }) {
  const first = place === 1;
  const second = place === 2;
  const rankLabel = first ? "CHAMPION" : second ? "RUNNER UP" : "TOP 3";
  const cardHeight = first ? "min-h-[218px] -mt-7" : "min-h-[184px]";
  const avatarSize = first ? "h-[82px] w-[82px]" : "h-[68px] w-[68px]";
  const ring = first ? "border-primary/60 bg-primary/10" : "border-border bg-secondary/80";
  const medalClass = first ? "h-6 w-6 text-primary" : "h-5 w-5 text-muted-foreground";

  const content = (
    <motion.div whileHover={{ y: -5, scale: 1.018 }} whileTap={{ scale: 0.985 }} className={`group relative flex w-full flex-col items-center overflow-visible rounded-[26px] border border-border bg-card/95 px-1.5 pb-3.5 pt-4 shadow-xl backdrop-blur-xl ${cardHeight}`}>
      {first && <><motion.div animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.9, 1.05, 0.9] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="pointer-events-none absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-full bg-primary/20 blur-2xl" /><div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-primary/60" /></>}
      <div className="relative z-10 mb-1 flex items-center justify-center">
        {first ? <motion.div animate={{ y: [0, -2, 0], rotate: [0, -4, 4, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} className="relative"><div className="absolute inset-0 rounded-full bg-primary/30 blur-md" /><Crown className="relative h-7 w-7 fill-primary text-primary drop-shadow-lg" /></motion.div> : <Medal className={medalClass} />}
      </div>
      <div className={`relative z-10 rounded-full border-2 p-[3px] shadow-lg ${avatarSize} ${ring}`}>
        {first && <motion.div animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} className="absolute -inset-1 rounded-full border border-primary/30" />}
        <div className="relative h-full w-full overflow-hidden rounded-full"><LevelAvatar src={row?.avatar ?? undefined} name={row?.username ?? undefined} level={row?.level ?? 0} size={first ? "lg" : "md"} showBadge={false} /></div>
      </div>
      <div className={`relative z-20 -mt-2 flex items-center gap-1 rounded-full border px-2.5 py-0.5 shadow-md ${first ? "border-primary/40 bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"}`}>
        {first && <Sparkles className="h-2.5 w-2.5" />}<span className="text-[8px] font-black tracking-[.18em]">#{place}</span>
      </div>
      <span className={`mt-1.5 text-[7px] font-black uppercase tracking-[.2em] ${first ? "text-primary" : "text-muted-foreground"}`}>{rankLabel}</span>
      <p className={`mt-1 max-w-[112px] truncate text-center font-extrabold text-foreground ${first ? "text-[12px]" : "text-[11px]"}`}>{row?.username ?? "—"}</p>
      <div className="mt-0.5 flex items-center gap-1 text-[8px] font-semibold text-muted-foreground"><span>LVL {row?.level ?? 1}</span>{row?.country && <><span>•</span><span>{COUNTRY_FLAG[row.country] ?? "🌐"}</span></>}</div>
      <div className={`mt-2 rounded-full border px-3 py-1 ${first ? "border-primary/30 bg-primary/10" : "border-border bg-secondary/70"}`}><p className={`text-[13px] font-black tracking-tight ${first ? "text-primary" : "text-foreground"}`}>{formatScore(row?.score ?? 0)}</p></div>
      {!row && <div className="absolute inset-0 rounded-[26px] bg-background/25" />}
    </motion.div>
  );
  if (!row) return <div className="min-w-0 opacity-45 grayscale">{content}</div>;
  return <Link to="/u/$userId" params={{ userId: row.user_id }} className="block min-w-0">{content}</Link>;
}

function RankItem({ row, index }: { row: Row; index?: number }) { const special = row.rnk <= 10; return <Link to="/u/$userId" params={{ userId: row.user_id }} className="group grid grid-cols-[34px_48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[20px] border border-border bg-card px-3 py-2.5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/80"><div className={`text-center text-[13px] font-black ${special ? "text-primary" : "text-muted-foreground"}`}>{row.rnk}</div><div className="h-12 w-12 rounded-full border border-border bg-secondary p-[2.5px]"><LevelAvatar src={row.avatar ?? undefined} name={row.username ?? undefined} level={row.level ?? 0} size="sm" showBadge={false} /></div><div className="min-w-0"><p className="truncate text-[13px] font-bold text-foreground group-hover:text-primary transition-colors">{row.username ?? "user"}</p><div className="mt-1 flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground"><span className="font-semibold text-foreground">Lvl {row.level}</span><span>•</span><span>{row.country ? (COUNTRY_FLAG[row.country] ?? row.country) : "🌐"}</span></div></div><div className="text-right"><p className="text-[13px] font-black tracking-tight text-primary">{formatScore(row.score)}</p><p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground">score</p></div></Link>; }

function MyRankCard({ row, fallback }: { row: Row | null; fallback: any }) { const avatar = row?.avatar ?? fallback?.avatar ?? null; const country = row?.country ?? fallback?.country ?? null; const rank = row?.rnk ?? null; const level = row?.level ?? fallback?.level ?? 1; return <div className="fixed inset-x-0 bottom-16 z-40 px-3"><motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-auto max-w-[430px] rounded-[24px] border border-border bg-card p-3 shadow-xl backdrop-blur-2xl"><div className="grid grid-cols-[46px_46px_minmax(0,1fr)_auto] items-center gap-2.5"><div className="rounded-xl border border-border bg-secondary py-1 text-center"><p className="text-[7px] font-black uppercase tracking-wider text-muted-foreground">My Rank</p><p className="text-xs font-black text-foreground">{rank ? `#${rank}` : "—"}</p></div><div className="h-11 w-11 rounded-full border border-border bg-secondary p-[2px]"><LevelAvatar src={avatar ?? undefined} name={row?.username ?? fallback?.username ?? undefined} level={level} size="sm" showBadge={false} /></div><div className="min-w-0"><p className="truncate text-xs font-bold text-foreground">{row?.username ?? fallback?.username ?? "You"}</p><p className="mt-0.5 text-[9px] font-medium text-muted-foreground">Lvl {level} · {country ? (COUNTRY_FLAG[country] ?? country) : "🌐"}</p></div><div className="rounded-full bg-primary px-3 py-1.5 text-[10px] font-black text-primary-foreground shadow-sm">{formatScore(row?.score ?? 0)}</div></div></motion.div></div>; }

function CountrySelect({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) { const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); const { data: dbCountries } = useQuery({ queryKey: ["rank-countries-v2"], staleTime: 5 * 60_000, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("country").not("country", "is", null).limit(2000); if (error) throw error; const set = new Set<string>(); for (const r of (data ?? []) as { country: string | null }[]) if (r.country?.trim()) set.add(r.country.trim()); return Array.from(set).sort(); } }); const options = useMemo(() => ["Global", ...(dbCountries ?? [])], [dbCountries]); useEffect(() => { const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", off); return () => document.removeEventListener("mousedown", off); }, []); return <div ref={ref} className="relative shrink-0"><motion.button whileTap={{ scale: 0.95 }} onClick={() => setOpen(o => !o)} className={`${compact ? "px-3.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"} inline-flex items-center gap-1.5 rounded-full border border-border bg-card font-extrabold text-foreground shadow-sm`}><span>{value === "Global" ? "🌐 Global" : `${COUNTRY_FLAG[value] ?? "🏳️"} ${value}`}</span><ArrowUpDown className="h-3 w-3 text-primary" /></motion.button><AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 z-50 mt-2 max-h-64 w-48 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur-2xl no-scrollbar">{options.map(c => <button key={c} onClick={() => { onChange(c); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${value === c ? "border border-primary/30 bg-primary/20 font-bold text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><span>{c === "Global" ? "🌐" : (COUNTRY_FLAG[c] ?? "🏳️")}</span><span className="truncate">{c}</span></button>)}</motion.div>}</AnimatePresence></div>; }

function EmptyState() { return <div className="mx-auto mt-6 max-w-[280px] rounded-3xl border border-border bg-card p-8 text-center shadow-lg"><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-secondary text-primary"><Trophy className="h-7 w-7" /></div><p className="text-sm font-extrabold text-foreground">No Rankings Yet</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Be the first trailblazer to claim your elite spot on the leaderboard.</p></div>; }

function HelpModal({ onClose }: { onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md" onClick={onClose}><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-2xl backdrop-blur-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-extrabold text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Ranking Guidelines</h2><button onClick={onClose} className="rounded-xl border border-border bg-secondary px-3.5 py-1 text-xs font-bold text-foreground hover:bg-secondary/80">Close</button></div><ul className="space-y-3 text-xs leading-relaxed text-muted-foreground"><li><b className="text-foreground">Room Gift</b> — Calculated precisely from live stream gift valuations.</li><li><b className="text-foreground">Gift Share & XP</b> — Earned via active engagement and platform events.</li><li><b className="text-foreground">Tribe / PK</b> — Ranked by victorious battle scores and arena wins.</li><li><b className="text-foreground">Royals & VIP</b> — Driven by exclusive tier progressions and status.</li></ul><p className="mt-5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Resets Daily @ 00:00 UTC · Weekly on Monday · Monthly on the 1st</p></motion.div></div>; }

function formatScore(n: number) { if (!Number.isFinite(n)) return "0"; if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`; if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`; return String(Math.round(n)); }
