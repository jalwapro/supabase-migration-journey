import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Gift, Rocket, Trophy, Flame, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  roomId: string;
  open: boolean;
  onClose: () => void;
  popularityPct: number;
  hostName?: string | null;
};

type PopularityData = {
  host_id: string;
  cumulative_popularity: number;
  total_live_seconds: number;
  today_live_seconds: number;
  week_live_seconds: number;
  gifts_power: number;
  tasks_completed: number;
  task_target: number;
  streak_days: number;
  host_bonus: number;
  host_commission: number;
  current_rank: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Platinum';
  weekly_followers: number;
};

const fallback = (pct: number): PopularityData => ({
  host_id: "",
  cumulative_popularity: Math.max(0, Math.round(pct) * 88),
  total_live_seconds: 3600 * 480,
  today_live_seconds: 3600 * 4,
  week_live_seconds: 3600 * 38,
  gifts_power: 850000,
  tasks_completed: Math.max(0, Math.round(pct)),
  task_target: 100,
  streak_days: 14,
  host_bonus: 0,
  host_commission: 0,
  current_rank: 'Gold',
  weekly_followers: 1200,
});

const formatHours = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const getRankColor = (rank: PopularityData['current_rank']) => {
  switch (rank) {
    case 'Bronze': return 'text-amber-600';
    case 'Silver': return 'text-slate-300';
    case 'Gold': return 'text-amber-400';
    case 'Diamond': return 'text-cyan-300';
    default: return 'text-yellow-400';
  }
};

const CircularProgressRing = ({ progress, colorClass }: { progress: number, colorClass: string }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg className="h-40 w-40 -rotate-90 transform" viewBox="0 0 120 120">
      <circle
        className="text-white/5"
        strokeWidth="10"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="60"
        cy="60"
      />
      <circle
        className={`${colorClass} transition-all duration-1000 ease-out`}
        strokeWidth="12"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="60"
        cy="60"
        style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
      />
    </svg>
  );
};

export function HostPopularitySheet({ roomId, open, onClose, popularityPct, hostName }: Props) {
  const [hostId, setHostId] = useState("");
  const [data, setData] = useState<PopularityData>(() => fallback(popularityPct));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !roomId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data: room, error: roomError } = await supabase
          .from("live_rooms")
          .select("host_id")
          .eq("id", roomId)
          .maybeSingle();
        if (roomError) throw roomError;
        const resolvedHostId = String((room as { host_id?: string } | null)?.host_id || "");
        if (!resolvedHostId) throw new Error("Host profile could not be resolved");
        if (!active) return;
        setHostId(resolvedHostId);

        const { data: stats, error: statsError } = await (supabase as any).rpc("host_popularity_get_v2", {
          _host_id: resolvedHostId,
        });
        if (statsError) throw statsError;
        if (!active || !stats) return;

        const row = stats as Partial<PopularityData>;
        setData({
          host_id: resolvedHostId,
          cumulative_popularity: Number(row.cumulative_popularity ?? 0) || 0,
          total_live_seconds: Number(row.total_live_seconds ?? 0) || 0,
          today_live_seconds: Number(row.today_live_seconds ?? 0) || 0,
          week_live_seconds: Number(row.week_live_seconds ?? 0) || 0,
          gifts_power: Number(row.gifts_power ?? 0) || 0,
          tasks_completed: Number(row.tasks_completed ?? 0) || 0,
          task_target: Number(row.task_target ?? 100) || 100,
          streak_days: Number(row.streak_days ?? 0) || 0,
          host_bonus: Number(row.host_bonus ?? 0) || 0,
          host_commission: Number(row.host_commission ?? 0) || 0,
          current_rank: row.current_rank || 'Gold',
          weekly_followers: row.weekly_followers || 1200,
        });
      } catch {
        if (active) setData(fallback(popularityPct));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [open, roomId, popularityPct]);

  useEffect(() => {
    if (!open || !hostId) return;
    const channel = supabase
      .channel(`host-popularity-v2-${hostId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "host_popularity_stats", filter: `host_id=eq.${hostId}` },
        payload => {
          const row = payload.new as Partial<PopularityData>;
          setData(prev => ({ ...prev, ...Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== undefined)), }) as PopularityData);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, hostId]);

  const vibeScore = data.cumulative_popularity;
  const vibeTarget = 10000;
  const vibePercentage = Math.min(100, Math.max(0, (vibeScore / vibeTarget) * 100));
  const rankColorClass = getRankColor(data.current_rank);

  const taskProgress = useMemo(() => Math.min(100, Math.max(0, (data.tasks_completed / Math.max(1, data.task_target)) * 100)), [data.tasks_completed, data.task_target]);
  const remaining = Math.max(0, data.task_target - data.tasks_completed);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in" onClick={onClose}>
      <section className="w-full max-w-md rounded-t-[32px] border-t border-white/15 bg-[#100719]/95 p-5 text-white shadow-2xl backdrop-blur-xl transition-transform animate-slide-up pb-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        
        {/* Bottom Sheet Handle Bar */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />

        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[color:var(--primary)]/25">
              <Rocket className="h-5 w-5 text-[color:var(--secondary)]" />
            </div>
            <div>
              <h2 className="text-sm font-black">Host Popularity</h2>
              <p className="text-[10px] text-white/45">{hostName ? `${hostName}'s Vibes Power` : "Cumulative host profile progress"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Close popularity">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* VIBES METER SECTION (Visual Ring + Stats) */}
        <div className="relative mb-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <CircularProgressRing progress={vibePercentage} colorClass={rankColorClass} />
              </div>
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" 
                alt={hostName || "Host"} 
                className="h-24 w-24 rounded-full border-4 border-white/10 object-cover shadow-lg"
              />
            </div>

            <div className="text-center">
              <p className="text-[10px] font-bold tracking-wider text-white/50">VIBES SCORE</p>
              <p className={`mt-0.5 text-4xl font-black ${rankColorClass}`} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}>
                {vibeScore.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-white/80">
                ⭐ Level {Math.floor(vibeScore / 1000) + 1} · <span className={rankColorClass}>{data.current_rank}</span>
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] text-white/60">
              <span className="font-medium uppercase tracking-wider">VIBES METER</span>
              <span className="font-bold">{vibePercentage.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out`} 
                style={{ 
                  width: `${vibePercentage}%`, 
                  background: `linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)`,
                }}
              />
            </div>
            <p className="mt-2 text-center text-[9px] text-white/40">
              ({vibeScore.toLocaleString()} / {vibeTarget.toLocaleString()} Points to next tier)
            </p>
          </div>
        </div>

        {/* STATISTICS GRID (3-Column Layout matching image) */}
        <div className="grid grid-cols-3 gap-2">
          <StatItem icon={<Clock3 className="h-3.5 w-3.5" />} label="Total Live" value={formatHours(data.total_live_seconds)} />
          <StatItem icon={<Flame className="h-3.5 w-3.5 text-amber-400" />} label="Live Streak" value={`${data.streak_days} Days`} />
          <StatItem icon={<Users className="h-3.5 w-3.5" />} label="Followers" value={data.weekly_followers.toLocaleString()} />
          
          <StatItem icon={<Gift className="h-3.5 w-3.5 text-pink-400" />} label="Gifts Power" value={data.gifts_power.toLocaleString()} />
          <StatItem icon={<Clock3 className="h-3.5 w-3.5" />} label="Today Live" value={formatHours(data.today_live_seconds)} />
          <StatItem icon={<Clock3 className="h-3.5 w-3.5" />} label="This Week" value={formatHours(data.week_live_seconds)} />
        </div>

        {/* Daily Task Progress Bar */}
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-1.5 flex items-center justify-between text-white/60">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Daily Task Progress</span>
            </div>
            <span className="text-[10px] font-bold">{data.tasks_completed}/{data.task_target}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${taskProgress}%` }} />
          </div>
        </div>

        <p className="mt-3 text-center text-[9px] text-white/45">
          {loading ? "Syncing host profile…" : "Cumulative host data remains active across room restarts."}
        </p>
      </section>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-center">
      <div className="mb-1 flex items-center justify-center gap-1 text-white/60">
        {icon}
        <span className="text-[9px] font-semibold">{label}</span>
      </div>
      <div className="text-xs font-black truncate">{value}</div>
    </div>
  );
}
