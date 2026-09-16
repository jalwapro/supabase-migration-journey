import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, HelpCircle, Trophy, Star, Mic, Gift, Swords, Gem, Sparkles, Flame, Globe2, ShieldCheck, ArrowUpDown, Crown, Medal } from "lucide-react";

export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({ meta: [{ title: "Rankings — Jalwa Global Live" }, { name: "description", content: "Top leaderboards and rankings on Jalwa." }] }),
});

type Category = "points" | "hosts" | "gifters" | "pk" | "vip" | "royals" | "popular" | "country";
type Period = "daily" | "weekly" | "monthly" | "all";
type Scope = "global" | "country";
type Row = { user_id: string; username: string | null; avatar: string | null; country: string | null; vip_level: number; level: number; score: number; rnk: number };

const CATS: { k: Category; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "points", label: "Gift Share", Icon: Star }, { k: "hosts", label: "Room Gift", Icon: Gift },
  { k: "gifters", label: "Room Tier", Icon: Mic }, { k: "pk", label: "Tribe", Icon: Swords },
  { k: "vip", label: "Rela", Icon: Gem }, { k: "royals", label: "Royals", Icon: Sparkles },
  { k: "popular", label: "Popular", Icon: Flame }, { k: "country", label: "Country", Icon: Globe2 },
];
const PERIODS: { k: Period; label: string }[] = [
  { k: "daily", label: "Daily" }, { k: "weekly", label: "Weekly" }, { k: "monthly", label: "Monthly" }, { k: "all", label: "All" },
];
const COUNTRY_FLAG: Record<string, string> = { Pakistan: "🇵🇰", India: "🇮🇳", Bangladesh: "🇧🇩", "Saudi Arabia": "🇸🇦", UAE: "🇦🇪", Turkey: "🇹🇷", Egypt: "🇪🇬", Indonesia: "🇮🇩", Malaysia: "🇲🇾", "United States": "🇺🇸", "United Kingdom": "🇬🇧", Philippines: "🇵🇭", Nigeria: "🇳🇬", Morocco: "🇲🇦", Iraq: "🇮🇶", Kuwait: "🇰🇼", Qatar: "🇶🇦" };

function RankPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<Category>("hosts");
  const [period, setPeriod] = useState<Period>("daily");
  const [country, setCountry] = useState("Global");
  const [helpOpen, setHelpOpen] = useState(false);
  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country" ? (country === "Global" ? (profile?.country ?? "Pakistan") : country) : null;

  const q = useQuery({ queryKey: ["rank_users_v2", category, period, scope, scopeValue], staleTime: 30_000, queryFn: async () => {
    const { data, error } = await supabase.rpc("rank_users", { p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue, p_limit: 100 });
    if (error) throw error; return (data ?? []) as Row[];
  }});
  const meQ = useQuery({ queryKey: ["rank_me_v2", category, period, scope, scopeValue, user?.id], enabled: !!user?.id, staleTime: 30_000, queryFn: async () => {
    const { data, error } = await supabase.rpc("rank_me", { p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue });
    if (error) throw error; return (data?.[0] ?? null) as Row | null;
  }});
  const list = q.data ?? [], c1 = list[0], c2 = list[1], c3 = list[2], rest = list.slice(3);

  return <>
    <AppShell title="" subtitle="" showHeader={false}>
      <main className="relative min-h-[100svh] overflow-x-clip bg-[#240307] text-white selection:bg-[#ffd76a] selection:text-[#2b0307]">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#d71935]/25 blur-[130px]" />
          <div className="absolute top-[270px] -left-40 h-[420px] w-[420px] rounded-full bg-[#8d0716]/30 blur-[120px]" />
          <div className="absolute top-[520px] -right-44 h-[440px] w-[440px] rounded-full bg-[#ff3b52]/10 blur-[130px]" />
          <div className="absolute left-1/2 top-[205px] h-px w-[150%] -translate-x-1/2 rotate-[7deg] bg-white/10" />
          <div className="absolute inset-x-0 top-0 h-[260px] bg-gradient-to-b from-[#650714]/40 to-transparent" />
        </div>
        <header className="relative z-20 px-3 pb-1" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <div className="mx-auto grid max-w-[430px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 px-1 pt-1">
            <button aria-label="Go back" onClick={() => router.history.back()} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/90 backdrop-blur-md transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
            <div className="text-center"><p className="text-[8px] font-bold uppercase tracking-[.38em] text-[#e8a9b0]">JALWA GLOBAL</p><h1 className="mt-0.5 font-serif text-[29px] font-bold italic leading-none tracking-tight text-[#ffe5e8] drop-shadow-[0_3px_8px_rgba(0,0,0,.4)]">Rankings</h1></div>
            <button aria-label="Ranking information" onClick={() => setHelpOpen(true)} className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition active:scale-95"><HelpCircle className="h-[18px] w-[18px]" /></button>
          </div>
          <nav className="no-scrollbar mx-auto mt-4 max-w-[430px] overflow-x-auto px-0.5"><ul className="flex min-w-max items-center gap-[24px] border-b border-white/10 pb-0 text-[10px] font-medium text-white/55">
            {CATS.map(({ k, label, Icon }) => { const active = category === k; return <li key={k}><button onClick={() => setCategory(k)} className={`relative flex items-center gap-1.5 whitespace-nowrap pb-2.5 transition ${active ? "font-bold text-white" : "hover:text-white/80"}`}><Icon className={`h-3 w-3 ${active ? "text-[#ffd45d]" : "text-white/45"}`} />{label}{active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#ffd45d] shadow-[0_0_8px_rgba(255,212,93,.7)]" />}</button></li>; })}
          </ul></nav>
          <div className="mx-auto mt-3 flex max-w-[430px] items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/20 p-1 shadow-inner backdrop-blur-md">{PERIODS.map(({ k, label }) => { const active = period === k; return <button key={k} onClick={() => setPeriod(k)} className={`rounded-full px-3 py-1.5 text-[9px] font-bold transition ${active ? "bg-[#ffe9a8] text-[#6e0712] shadow-[0_2px_10px_rgba(255,215,106,.2)]" : "text-white/60"}`}>{label}</button>; })}</div>
            <CountrySelect value={country} onChange={setCountry} compact />
          </div>
        </header>
        <section className="relative z-10 mx-auto mt-4 max-w-[430px] px-3"><div className="relative overflow-hidden rounded-[28px] border border-[#f7cf79]/15 bg-gradient-to-b from-[#5d0913]/90 via-[#41060d]/90 to-[#2b0308]/95 px-2 pb-3 pt-8 shadow-[0_24px_70px_rgba(0,0,0,.42)]"><div aria-hidden className="absolute left-1/2 top-0 h-24 w-[86%] -translate-x-1/2 rounded-b-[50%] bg-[#d51b35]/15 blur-2xl" /><div aria-hidden className="absolute left-1/2 top-0 h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#ffd86a]/55 to-transparent" /><div className="relative grid grid-cols-[1fr_1.1fr_1fr] items-end gap-1.5 sm:gap-2"><PodiumCard row={c2} place={2} /><PodiumCard row={c1} place={1} /><PodiumCard row={c3} place={3} /></div></div></section>
        <section className="relative z-10 mx-auto mt-4 max-w-[430px] px-3 pb-32"><div className="mb-2 flex items-center justify-between px-1"><p className="text-[9px] font-bold uppercase tracking-[.22em] text-white/40">Leaderboard</p><p className="text-[9px] text-white/35">{list.length ? `${list.length} players` : "Live ranking"}</p></div>{q.isLoading ? <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-[66px] animate-pulse rounded-2xl border border-white/10 bg-white/5" />)}</div> : q.isError ? <div className="rounded-2xl border border-white/10 bg-black/15 p-5 text-center text-xs text-white/60">Rankings could not be loaded right now.</div> : rest.length === 0 && list.length <= 3 ? <EmptyState /> : <ul className="space-y-2">{rest.map(r => <RankItem key={r.user_id} row={r} />)}</ul>}</section>
      </main>
    </AppShell>
    {user && <MyRankCard row={meQ.data ?? null} fallback={profile} />}{helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}<BottomNav />
  </>;
}

function PodiumCard({ row, place }: { row?: Row; place: 1 | 2 | 3 }) {
  const first = place === 1, second = place === 2;
  const accent = first ? "#ffd45d" : second ? "#d7e8ff" : "#ffc17a";
  const card = first ? "from-[#8f0a1c] via-[#680713] to-[#42040c]" : second ? "from-[#4a6385] via-[#34475f] to-[#202d3e]" : "from-[#8b4b17] via-[#67350f] to-[#3e220a]";
  const content = <div className={`group relative flex min-h-[166px] w-full flex-col items-center overflow-visible rounded-[20px] border px-1.5 pb-3 pt-3 bg-gradient-to-b ${card} ${first ? "min-h-[192px] -mt-4" : ""}`} style={{ borderColor: `${accent}33`, boxShadow: first ? `0 16px 45px ${accent}18` : "0 12px 30px rgba(0,0,0,.25)" }}>
    <div aria-hidden className="absolute inset-x-2 top-1 h-16 rounded-full blur-2xl" style={{ background: `${accent}18` }} />
    <div className="relative z-10 flex h-6 items-center justify-center" style={{ color: accent }}>{first ? <Crown className="h-5 w-5 fill-current drop-shadow-[0_2px_5px_rgba(255,212,93,.45)]" /> : <Medal className="h-4 w-4" />}</div>
    <div className={`relative z-10 mt-1 rounded-full border-2 bg-black/20 p-[3px] ${first ? "h-[72px] w-[72px]" : "h-[61px] w-[61px]"}`} style={{ borderColor: accent, boxShadow: `0 0 0 3px ${accent}12, 0 8px 20px rgba(0,0,0,.35)` }}><LevelAvatar src={row?.avatar ?? undefined} name={row?.username ?? undefined} level={row?.level ?? 0} size={first ? "lg" : "md"} showBadge={false} /></div>
    <div className="relative z-20 -mt-1 rounded-full border px-2 py-0.5 text-[8px] font-black tracking-[.12em]" style={{ background: `${accent}20`, borderColor: `${accent}55`, color: accent }}>#{place}</div>
    <p className="mt-1 max-w-[105px] truncate text-center text-[10px] font-extrabold text-white">{row?.username ?? "—"}</p><div className="mt-1 flex items-center gap-1 text-[8px] text-white/55"><span>LVL {row?.level ?? 1}</span>{row?.country && <><span>•</span><span>{COUNTRY_FLAG[row.country] ?? "🌐"}</span></>}</div><p className="mt-1 text-[12px] font-black" style={{ color: accent }}>{formatScore(row?.score ?? 0)}</p>{first && <div className="absolute inset-x-6 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />}
  </div>;
  if (!row) return <div className="opacity-30">{content}</div>;
  return <Link to="/u/$userId" params={{ userId: row.user_id }} className="block min-w-0">{content}</Link>;
}

function RankItem({ row }: { row: Row }) { const special = row.rnk <= 10; return <li><Link to="/u/$userId" params={{ userId: row.user_id }} className="group grid grid-cols-[30px_46px_minmax(0,1fr)_auto] items-center gap-2 rounded-[17px] border border-white/[.08] bg-gradient-to-r from-white/[.065] to-white/[.025] px-2.5 py-2.5 shadow-[0_8px_25px_rgba(0,0,0,.16)] backdrop-blur-md transition active:scale-[.99]"><div className={`text-center text-[13px] font-black ${special ? "text-[#ffd86a]" : "text-white/55"}`}>{row.rnk}</div><div className="h-11 w-11 rounded-full border border-white/15 bg-black/20 p-[2px]"><LevelAvatar src={row.avatar ?? undefined} name={row.username ?? undefined} level={row.level ?? 0} size="sm" showBadge={false} /></div><div className="min-w-0"><p className="truncate text-[12px] font-bold text-white">{row.username ?? "user"}</p><div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/45"><span>Lvl {row.level}</span><span>•</span><span>{row.country ? (COUNTRY_FLAG[row.country] ?? row.country) : "🌐"}</span></div></div><div className="text-right"><p className="text-[12px] font-black text-[#ffd86a]">{formatScore(row.score)}</p><p className="mt-0.5 text-[8px] uppercase tracking-wider text-white/30">score</p></div></Link></li>; }

function MyRankCard({ row, fallback }: { row: Row | null; fallback: any }) { const avatar = row?.avatar ?? fallback?.avatar ?? null, country = row?.country ?? fallback?.country ?? null, rank = row?.rnk ?? null, level = row?.level ?? fallback?.level ?? 1; return <div className="fixed inset-x-0 bottom-16 z-40 px-3"><div className="mx-auto max-w-[430px] rounded-[20px] border border-[#ffd76a]/20 bg-[#31050b]/95 p-2.5 shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur-2xl"><div className="grid grid-cols-[42px_42px_minmax(0,1fr)_auto] items-center gap-2"><div className="text-center"><p className="text-[7px] font-black uppercase tracking-wider text-[#ffd76a]/65">My Rank</p><p className="text-sm font-black text-white">{rank ? `#${rank}` : "—"}</p></div><div className="h-10 w-10 rounded-full border border-[#ffd76a]/35 p-[2px]"><LevelAvatar src={avatar ?? undefined} name={row?.username ?? fallback?.username ?? undefined} level={level} size="sm" showBadge={false} /></div><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{row?.username ?? fallback?.username ?? "You"}</p><p className="mt-0.5 text-[9px] text-white/45">Lvl {level} · {country ? (COUNTRY_FLAG[country] ?? country) : "🌐"}</p></div><div className="rounded-full bg-[#ffd76a]/10 px-2 py-1 text-[9px] font-bold text-[#ffd76a]">{formatScore(row?.score ?? 0)}</div></div></div></div>; }

function CountrySelect({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) { const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null); const { data: dbCountries } = useQuery({ queryKey: ["rank-countries-v2"], staleTime: 5 * 60_000, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("country").not("country", "is", null).limit(2000); if (error) throw error; const set = new Set<string>(); for (const r of (data ?? []) as { country: string | null }[]) if (r.country?.trim()) set.add(r.country.trim()); return Array.from(set).sort(); } }); const options = useMemo(() => ["Global", ...(dbCountries ?? [])], [dbCountries]); useEffect(() => { const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", off); return () => document.removeEventListener("mousedown", off); }, []); return <div ref={ref} className="relative shrink-0"><button onClick={() => setOpen(o => !o)} className={`${compact ? "px-3 py-1.5 text-[9px]" : "px-3 py-1.5 text-xs"} inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 font-bold text-white/80 backdrop-blur-md transition active:scale-95`}><span>{value === "Global" ? "Global" : value}</span><ArrowUpDown className="h-3 w-3 text-[#ffd76a]" /></button>{open && <div className="absolute right-0 z-50 mt-2 max-h-64 w-44 overflow-auto rounded-2xl border border-white/10 bg-[#31050b]/98 p-1.5 shadow-2xl backdrop-blur-2xl">{options.map(c => <button key={c} onClick={() => { onChange(c); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs ${value === c ? "bg-white/10 font-bold text-white" : "text-white/65"}`}><span>{c === "Global" ? "🌐" : (COUNTRY_FLAG[c] ?? "🏳️")}</span>{c}</button>)}</div>}</div>; }

function EmptyState() { return <div className="mx-auto mt-5 max-w-[280px] rounded-2xl border border-white/10 bg-white/5 p-7 text-center backdrop-blur-md"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#ffd76a]/10 text-[#ffd76a]"><Trophy className="h-6 w-6" /></div><p className="text-sm font-bold text-white">No Rankings Yet</p><p className="mt-1 text-xs text-white/45">Be the first to claim your spot on the leaderboard.</p></div>; }

function HelpModal({ onClose }: { onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}><div className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#30050b]/98 p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-extrabold text-white"><ShieldCheck className="h-5 w-5 text-[#ffd45d]" /> Ranking Rules</h2><button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">Close</button></div><ul className="space-y-2.5 text-xs leading-relaxed text-white/65"><li><b className="text-[#ffd45d]">Room Gift</b> — Calculated from gifts received during live streams.</li><li><b className="text-[#ffd45d]">Points & XP</b> — Earned through general activity across app features.</li><li><b className="text-[#ffd45d]">PK Battles</b> — Ranked by successful PK victories.</li><li><b className="text-[#ffd45d]">VIP & Royals</b> — Based on active tier status and progression.</li></ul><p className="mt-4 text-center text-[10px] text-white/30">Resets daily at 00:00 UTC · Weekly on Monday · Monthly on the 1st</p></div></div>; }

function formatScore(n: number) { if (!Number.isFinite(n)) return "0"; if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`; if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`; return String(Math.round(n)); }
