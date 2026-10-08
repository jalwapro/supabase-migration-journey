import "../room-rank-frame-alignment.css";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { LevelAvatar } from "@/components/LevelAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useThemeMode } from "@/hooks/useThemeMode";
import { 
  ArrowLeft, HelpCircle, Trophy, Star, Mic, Gift, Swords, 
  Gem, Sparkles, Flame, Globe2, ShieldCheck, ArrowUpDown, 
  Crown, Medal, TrendingUp 
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
type Row = { 
  user_id: string; 
  username: string | null; 
  avatar: string | null; 
  frame: string | null; 
  ring: string | null; 
  country: string | null; 
  vip_level: number; 
  level: number; 
  score: number; 
  rnk: number 
};

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
  { k: "all", label: "All" }
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
  const { mode } = useThemeMode();
  const [category, setCategory] = useState<Category>("hosts");
  const [period, setPeriod] = useState<Period>("daily");
  const [country, setCountry] = useState("Global");
  const [helpOpen, setHelpOpen] = useState(false);
  
  const scope: Scope = category === "country" || country !== "Global" ? "country" : "global";
  const scopeValue = scope === "country" ? (country === "Global" ? (profile?.country ?? "Pakistan") : country) : null;

  const q = useQuery({
    queryKey: ["rank_users_v3", category, period, scope, scopeValue],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rank_users", { 
        p_category: category, p_period: period, p_scope: scope, p_scope_value: scopeValue, p_limit: 50 
      });
      if (error) throw error;
      const rows = (data ?? []) as Omit<Row, "frame" | "ring">[];
      if (!rows.length) return [] as Row[];
      
      const ids = rows.map((r) => r.user_id);
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,frame,ring").in("id", ids);
      if (profileError) throw profileError;
      
      const media = new Map((profiles ?? []).map((p: { id: string; frame: string | null; ring: string | null }) => [p.id, p]));
      return rows.map((r) => ({ ...r, frame: media.get(r.user_id)?.frame ?? null, ring: media.get(r.user_id)?.ring ?? null }));
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

  const list = q.data ?? [];
  const c1 = list[0];
  const c2 = list[1];
  const c3 = list[2];
  const rest = list.slice(3);

  return (
    <>
      <AppShell title="" subtitle="" showHeader={false}>
        {/* Deep Galaxy/Purple Background from the design reference */}
        <main data-theme-mode={mode} className="relative min-h-[100svh] overflow-x-clip bg-gradient-to-b from-[#1E0B36] via-[#10051C] to-[#0A0210] text-white selection:bg-yellow-500/30 selection:text-yellow-200">
          
          <header className="relative z-20 px-3 pb-2" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
            <div className="mx-auto grid max-w-[430px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 px-1 pt-1">
              <button onClick={() => router.history.back()} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#2A154A]/50 text-white backdrop-blur-xl shadow-sm">
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#2A154A]/80 px-3 py-0.5 border border-white/10">
                  <Sparkles className="h-2.5 w-2.5 text-yellow-400" />
                  <p className="text-[8px] font-extrabold uppercase tracking-[.38em] text-white/70">JALWA GLOBAL</p>
                </div>
                <h1 className="mt-1 font-serif text-[30px] font-extrabold italic leading-none tracking-tight text-white drop-shadow-md">Rankings</h1>
              </div>
              
              <button onClick={() => setHelpOpen(true)} className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#2A154A]/50 text-white backdrop-blur-xl shadow-sm">
                <HelpCircle className="h-[18px] w-[18px]" />
              </button>
            </div>
            
            {/* Category Navigation */}
            <nav className="no-scrollbar mx-auto mt-4 max-w-[430px] overflow-x-auto px-1">
              <ul className="flex min-w-max items-center gap-[22px] border-b border-white/10 pb-0 text-[10px] font-semibold text-white/50">
                {CATS.map(({ k, label, Icon }) => { 
                  const active = category === k; 
                  return (
                    <li key={k}>
                      <button onClick={() => setCategory(k)} className={`relative flex items-center gap-1.5 whitespace-nowrap pb-3 transition-all duration-300 ${active ? "font-bold text-white scale-105" : "hover:text-white/80"}`}>
                        <Icon className={`h-3.5 w-3.5 transition-colors ${active ? "text-yellow-400" : "text-white/50"}`} />
                        {label}
                        {active && <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />}
                      </button>
                    </li>
                  ); 
                })}
              </ul>
            </nav>
            
            {/* Period Toggles & Country Select */}
            <div className="mx-auto mt-3.5 flex max-w-[430px] items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#1D0C33]/80 p-1 shadow-inner backdrop-blur-xl">
                {PERIODS.map(({ k, label }) => { 
                  const active = period === k; 
                  return (
                    <button key={k} onClick={() => setPeriod(k)} className={`relative rounded-full px-3 py-1.5 text-[9px] font-extrabold tracking-wider transition-all ${active ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-md scale-105" : "text-white/60 hover:text-white"}`}>
                      {label}
                    </button>
                  ); 
                })}
              </div>
              <CountrySelect value={country} onChange={setCountry} compact />
            </div>
          </header>

          {/* Podium Section */}
          <section className="relative z-10 mx-auto mt-5 max-w-[430px] px-2">
            <div className="relative overflow-visible rounded-[34px] border border-white/10 bg-[#251142]/60 px-1.5 pb-5 pt-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-gradient-to-b from-yellow-500/10 via-transparent to-transparent" />
              
              <div className="relative mb-8 flex items-center justify-center gap-2">
                <span className="h-px w-10 bg-white/20" />
                <span className="rounded-full border border-white/20 bg-[#140626]/80 px-3 py-1 text-[8px] font-black uppercase tracking-[.28em] text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]">Top Champions</span>
                <span className="h-px w-10 bg-white/20" />
              </div>
              
              <div className="relative grid grid-cols-[1fr_1.12fr_1fr] items-end gap-1 sm:gap-1.5 mt-4">
                <PodiumCard row={c2} place={2} />
                <PodiumCard row={c1} place={1} />
                <PodiumCard row={c3} place={3} />
              </div>
              
              <div className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-yellow-500/10 blur-3xl" />
            </div>
          </section>

          {/* Rankings List */}
          <section className="relative z-10 mx-auto mt-6 max-w-[430px] px-3 pb-36">
            <div className="mb-3 flex items-center justify-between px-1.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-yellow-400" />
                <p className="text-[9px] font-black uppercase tracking-[.25em] text-white/60">Elite Rankings</p>
              </div>
              <p className="rounded-full border border-white/10 bg-[#2A154A] px-2.5 py-0.5 text-[9px] font-bold text-white/80">
                {list.length ? `${list.length} Contenders` : "Live Feed"}
              </p>
            </div>
            
            {q.isLoading ? (
              <div className="space-y-2.5">
                {[1,2,3,4].map(i => <div key={i} className="h-[68px] animate-pulse rounded-2xl border border-white/10 bg-[#251142]/40 backdrop-blur-md" />)}
              </div>
            ) : q.isError ? (
              <div className="rounded-2xl border border-red-500/30 bg-[#1A0B2E] p-6 text-center text-xs text-red-400 backdrop-blur-xl">
                Rankings could not be synced securely. Please retry.
              </div>
            ) : rest.length === 0 && list.length <= 3 ? (
              <EmptyState />
            ) : (
              <ul>
                {rest.map((r, index) => (
                  <li key={r.user_id}>
                    <RankItem row={r} index={index + 4} />
                  </li>
                ))}
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
  const first = place === 1; 
  const second = place === 2; 
  const rankLabel = first ? "CHAMPION" : second ? "RUNNER UP" : "TOP 3"; 
  const cardHeight = first ? "min-h-[225px] -mt-10" : "min-h-[190px]"; 
  const avatarSize = first ? "h-[88px] w-[88px]" : "h-[72px] w-[72px]"; 
  const ring = first ? "border-yellow-400/80 bg-yellow-500/20" : "border-white/20 bg-[#2A154A]"; 
  const medalClass = first ? "h-7 w-7 text-yellow-400 drop-shadow-md" : "h-5 w-5 text-white/70";
  const rankImage = place === 1 ? "/images/top1.jpg" : place === 2 ? "/images/top 2.jpg" : "/images/top 3.jpg";
  const cardWidth = first ? "min-w-0" : "min-w-0";
  const avatarOuter = first ? "h-[82px] w-[82px] sm:h-[92px] sm:w-[92px]" : "h-[68px] w-[68px] sm:h-[76px] sm:w-[76px]";
  
  const content = (
    <div className={`group relative flex w-full flex-col items-center overflow-visible rounded-[26px] border border-white/10 bg-gradient-to-b ${first ? 'from-[#3A1B60]/90 to-[#190930]/90 border-yellow-500/30' : 'from-[#251142]/90 to-[#120624]/90'} px-1.5 pb-3.5 pt-4 shadow-xl backdrop-blur-xl ${cardHeight} ${cardWidth}`}>
      <img src={rankImage} alt={`Top ${place} ranking`} className="pointer-events-none absolute inset-0 h-full w-full rounded-[26px] object-cover opacity-55" />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-gradient-to-b from-[#120624]/45 via-[#120624]/65 to-[#08010F]/90" />
      
      {first && (
        <>
          {/* Intense Royal Glow for Rank 1 */}
          <div className="pointer-events-none absolute left-1/2 top-6 h-32 w-32 -translate-x-1/2 rounded-full bg-yellow-500/30 blur-2xl" />
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        </>
      )}
      
      <div className="relative z-10 mb-1 flex items-center justify-center">
        {first ? (
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-yellow-500/40 blur-md" />
            <Crown className="relative h-8 w-8 fill-yellow-400 text-yellow-300 drop-shadow-[0_2px_8px_rgba(250,204,21,0.8)]" />
          </div>
        ) : (
          <Medal className={medalClass} />
        )}
      </div>
      
      <div className={`relative z-10 shrink-0 rounded-full border-2 p-[3px] shadow-lg ${avatarOuter} ${ring}`}>
        {/* Ideal container for inserting 3D regal lion frames later based on platform assets */}
        {first && <div className="absolute -inset-1 rounded-full border-2 border-dashed border-yellow-400/50" />}
        <div className="relative h-full w-full overflow-visible rounded-full bg-[#1A0B2E]">
          <LevelAvatar src={row?.avatar ?? undefined} name={row?.username ?? undefined} level={row?.level ?? 0} size={first ? "lg" : "md"} showBadge={false} frame={row?.frame} ring={row?.ring} />
        </div>
      </div>
      
      <div className={`relative z-20 -mt-3 flex items-center gap-1 rounded-full border px-2.5 py-0.5 shadow-md ${first ? "border-yellow-500/50 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black" : "border-white/20 bg-[#2A154A] text-white"}`}>
        {first && <Sparkles className="h-2.5 w-2.5" />}
        <span className="text-[9px] font-black tracking-[.18em]">#{place}</span>
      </div>
      
      <span className={`mt-2 rounded-full bg-black/45 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.16em] shadow-sm ${first ? "text-yellow-300" : "text-white/80"}`}>{rankLabel}</span>
      <p className={`mt-1 w-full max-w-[112px] truncate rounded-lg bg-black/35 px-1 text-center font-extrabold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] ${first ? "text-[13px]" : "text-[11px]"}`}>{row?.username ?? "—"}</p>
      
      <div className="mt-0.5 flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[8px] font-semibold text-white/80">
        <span>LVL {row?.level ?? 1}</span>
        {row?.country && <><span>•</span><span>{COUNTRY_FLAG[row.country] ?? "🌐"}</span></>}
      </div>
      
      <div className={`mt-2 max-w-full rounded-full border px-2.5 py-1 ${first ? "border-yellow-500/50 bg-[#120624]/75" : "border-white/20 bg-[#120624]/75"}`}>
        <p className={`text-[13px] font-black tracking-tight ${first ? "text-yellow-400 drop-shadow-md" : "text-white"}`}>{formatScore(row?.score ?? 0)}</p>
      </div>
      
      {!row && <div className="absolute inset-0 rounded-[26px] bg-[#0A0210]/60 backdrop-blur-[2px]" />}
    </div>
  );
  
  if (!row) return <div className="opacity-40 grayscale">{content}</div>;
  return <Link to="/u/$userId" params={{ userId: row.user_id }} className="block min-w-0">{content}</Link>;
}

function RankItem({ row, index }: { row: Row; index?: number }) { 
  const special = row.rnk <= 10; 
  return (
    <Link to="/u/$userId" params={{ userId: row.user_id }} className="group grid grid-cols-[34px_48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[20px] border border-white/10 bg-[#1D0C33]/80 px-3 py-2.5 shadow-sm transition-all duration-300 hover:border-yellow-500/40 hover:bg-[#2A154A]/90 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]">
      <div className={`text-center text-[14px] font-black ${special ? "text-yellow-400" : "text-white/40"}`}>{row.rnk}</div>
      <div className="h-12 w-12 overflow-visible rounded-full border border-white/20 bg-[#10051C] p-[2.5px]">
        <LevelAvatar src={row.avatar ?? undefined} name={row.username ?? undefined} level={row.level ?? 0} size="sm" showBadge={false} frame={row.frame} ring={row.ring} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-white group-hover:text-yellow-200 transition-colors">{row.username ?? "user"}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[9px] font-medium text-white/50">
          <span className="text-white/80 font-semibold">Lvl {row.level}</span>
          <span>•</span>
          <span>{row.country ? (COUNTRY_FLAG[row.country] ?? row.country) : "🌐"}</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[14px] font-black text-yellow-400 tracking-tight">{formatScore(row.score)}</p>
        <p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-widest text-white/40">score</p>
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
    <div className="fixed inset-x-0 bottom-[72px] z-40 px-3">
      <div className="mx-auto max-w-[430px] rounded-[24px] border border-yellow-500/30 bg-[#251142]/95 p-3 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="grid grid-cols-[46px_46px_minmax(0,1fr)_auto] items-center gap-2.5">
          <div className="text-center bg-[#10051C] py-1 rounded-xl border border-white/10">
            <p className="text-[7px] font-black uppercase tracking-wider text-white/50">My Rank</p>
            <p className="text-xs font-black text-yellow-400">{rank ? `#${rank}` : "—"}</p>
          </div>
          <div className="h-11 w-11 overflow-visible rounded-full border border-white/20 p-[2px] bg-[#10051C]">
            <LevelAvatar src={avatar ?? undefined} name={row?.username ?? fallback?.username ?? undefined} level={level} size="sm" showBadge={false} frame={row?.frame} ring={row?.ring} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{row?.username ?? fallback?.username ?? "You"}</p>
            <p className="mt-0.5 text-[9px] font-medium text-white/60">Lvl {level} · {country ? (COUNTRY_FLAG[country] ?? country) : "🌐"}</p>
          </div>
          <div className="rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-3 py-1.5 text-[10px] font-black text-black shadow-sm">
            {formatScore(row?.score ?? 0)}
          </div>
        </div>
      </div>
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
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; 
    document.addEventListener("mousedown", off); 
    return () => document.removeEventListener("mousedown", off) 
  }, []); 
  
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(o => !o)} className={`${compact ? "px-3.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"} inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2A154A]/80 font-extrabold text-white shadow-sm`}>
        <span>{value === "Global" ? "🌐 Global" : `${COUNTRY_FLAG[value] ?? "🏳️"} ${value}`}</span>
        <ArrowUpDown className="h-3 w-3 text-yellow-400" />
      </button>
      {open && (
          <div className="absolute right-0 z-50 mt-2 max-h-64 w-48 overflow-auto rounded-2xl border border-white/10 bg-[#1D0C33] p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl no-scrollbar">
            {options.map(c => (
              <button key={c} onClick={() => { onChange(c); setOpen(false) }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${value === c ? "bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/30" : "text-white/70 hover:bg-[#2A154A] hover:text-white"}`}>
                <span>{c === "Global" ? "🌐" : (COUNTRY_FLAG[c] ?? "🏳️")}</span>
                <span className="truncate">{c}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  ); 
}

function EmptyState() {
  return (
    <div className="mx-auto mt-6 max-w-[280px] rounded-3xl border border-white/10 bg-[#1A0B2E]/80 p-8 text-center shadow-lg">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#2A154A] text-yellow-400 border border-white/10">
        <Trophy className="h-7 w-7" />
      </div>
      <p className="text-sm font-extrabold text-white">No Rankings Yet</p>
      <p className="mt-1 text-xs text-white/50 leading-relaxed">Be the first trailblazer to claim your elite spot on the leaderboard.</p>
    </div>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#1D0C33] p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <ShieldCheck className="h-5 w-5 text-yellow-400" /> Ranking Guidelines
          </h2>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-[#2A154A] px-3.5 py-1 text-xs font-bold text-white hover:bg-white/10">Close</button>
        </div>
        <ul className="space-y-3 text-xs leading-relaxed text-white/70">
          <li><b className="text-white">Room Gift</b> — Calculated precisely from live stream gift valuations.</li>
          <li><b className="text-white">Gift Share & XP</b> — Earned via active engagement and platform events.</li>
          <li><b className="text-white">Tribe / PK</b> — Ranked by victorious battle scores and arena wins.</li>
          <li><b className="text-white">Royals & VIP</b> — Driven by exclusive tier progressions and status.</li>
        </ul>
        <p className="mt-5 text-center text-[10px] font-medium text-yellow-500/70 uppercase tracking-wider">
          Resets Daily @ 00:00 UTC · Weekly on Monday · Monthly on the 1st
        </p>
      </div>
    </div>
  )
}

function formatScore(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}
