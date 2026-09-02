import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Gift, Rocket, Flame, X, Users, Coins } from "lucide-react";
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
  red_diamonds: number;
  red_diamonds_pkr_value: number;
  current_rank: "Bronze" | "Silver" | "Gold" | "Diamond" | "Platinum";
  weekly_followers: number;
};

const emptyData = (hostId = ""): PopularityData => ({
  host_id: hostId,
  cumulative_popularity: 0,
  total_live_seconds: 0,
  today_live_seconds: 0,
  week_live_seconds: 0,
  gifts_power: 0,
  tasks_completed: 0,
  task_target: 100,
  streak_days: 0,
  host_bonus: 0,
  host_commission: 0,
  red_diamonds: 0,
  red_diamonds_pkr_value: 500,
  current_rank: "Bronze",
  weekly_followers: 0,
});

const formatHours = (seconds: number) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const getRank = (score: number): PopularityData["current_rank"] => {
  if (score >= 100000) return "Platinum";
  if (score >= 50000) return "Diamond";
  if (score >= 20000) return "Gold";
  if (score >= 5000) return "Silver";
  return "Bronze";
};

const getRankColor = (rank: PopularityData["current_rank"]) => {
  switch (rank) {
    case "Bronze": return "text-amber-600";
    case "Silver": return "text-slate-300";
    case "Gold": return "text-amber-400";
    case "Diamond": return "text-cyan-300";
    default: return "text-yellow-400";
  }
};

const CircularProgressRing = ({ progress, colorClass }: { progress: number; colorClass: string }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  return (
    <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
      <circle className="text-white/5" strokeWidth="8" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
      <circle className={`${colorClass} transition-all duration-1000 ease-out`} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" style={{ filter: "drop-shadow(0 0 6px currentColor)" }} />
    </svg>
  );
};

export function HostPopularitySheet({ roomId, open, onClose, hostName }: Props) {
  const [hostId, setHostId] = useState("");
  const [hostLevel, setHostLevel] = useState<number | null>(null);
  const [profileName, setProfileName] = useState<string | null>(hostName ?? null);
  const [hostAvatar, setHostAvatar] = useState<string | null>(null);
  const [data, setData] = useState<PopularityData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !roomId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let resolvedHostId = roomId;
        
        const { data: room, error: roomError } = await supabase
          .from("live_rooms")
          .select("host_id, user_id")
          .eq("id", roomId)
          .maybeSingle();

        if (!roomError && room) {
          resolvedHostId = String(room.host_id || (room as any).user_id || roomId);
        }

        if (!resolvedHostId) throw new Error("Host profile could not be resolved");
        if (!active) return;
        setHostId(resolvedHostId);

        const profilePromise = supabase
          .from("profiles")
          .select("level, username, full_name, avatar")
          .eq("id", resolvedHostId)
          .maybeSingle();

        let statsResult: any = { data: null, error: null };
        try {
          statsResult = await (supabase as any).rpc("host_popularity_get_v2", { _host_id: resolvedHostId });
        } catch (e) {
          console.warn("RPC host_popularity_get_v2 failed", e);
        }

        const followersPromise = supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", resolvedHostId)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const [profileResult, followersResult] = await Promise.all([
          profilePromise,
          followersPromise,
        ]);

        if (!active) return;

        const profile = profileResult.data as { level?: number | null; username?: string | null; full_name?: string | null; avatar?: string | null } | null;
        const row = statsResult.error || !statsResult.data ? null : (Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data);

        const cumulativePop = Number(row?.cumulative_popularity) || 0;

        const next = {
          ...emptyData(resolvedHostId),
          host_id: resolvedHostId,
          cumulative_popularity: cumulativePop,
          total_live_seconds: Number(row?.total_live_seconds) || 0,
          today_live_seconds: Number(row?.today_live_seconds) || 0,
          week_live_seconds: Number(row?.week_live_seconds) || 0,
          gifts_power: Number(row?.gifts_power) || 0,
          tasks_completed: Number(row?.tasks_completed) || 0,
          task_target: Math.max(1, Number(row?.task_target) || 100),
          streak_days: Number(row?.streak_days) || 0,
          host_bonus: Number(row?.host_bonus) || 0,
          host_commission: Number(row?.host_commission) || 0,
          red_diamonds: Number(row?.red_diamonds) || 0,
          red_diamonds_pkr_value: Number(row?.red_diamonds_pkr_value) || 500,
          current_rank: getRank(cumulativePop),
          weekly_followers: followersResult.count ?? 0,
        } satisfies PopularityData;

        setHostLevel(Number(profile?.level) || 1);
        setProfileName(profile?.full_name || profile?.username || hostName || "Host");
        setHostAvatar(profile?.avatar || null);
        setData(next);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load host popularity");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [open, roomId, hostName]);

  const vibeScore = data.cumulative_popularity;
  const vibeTarget = Math.max(10000, (Math.floor(vibeScore / 10000) + 1) * 10000);
  const vibePercentage = Math.min(100, Math.max(0, (vibeScore / vibeTarget) * 100));
  const rankColorClass = getRankColor(data.current_rank);
  const taskProgress = useMemo(() => Math.min(100, Math.max(0, (data.tasks_completed / Math.max(1, data.task_target)) * 100)), [data.tasks_completed, data.task_target]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in" onClick={onClose}>
      <section className="w-full max-w-sm rounded-t-[28px] border-t border-white/10 bg-gradient-to-b from-[#140b20] to-[#0a0410] p-4 text-white shadow-2xl backdrop-blur-2xl transition-transform animate-slide-up pb-6 max-h-[85vh] overflow-y-auto scrollbar-none" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-purple-500/20 border border-purple-500/30">
              {hostAvatar ? <img src={hostAvatar} alt="" className="h-full w-full object-cover" /> : <Rocket className="h-4 w-4 text-purple-400" />}
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-wide">Host Popularity & Tasks</h2>
              <p className="text-[10px] text-white/50">{profileName ? `${profileName}'s Stats` : "Profile progress"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition-colors" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
        </header>

        <div className="relative mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 shadow-inner">
          <div className="flex items-center justify-around">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center"><CircularProgressRing progress={vibePercentage} colorClass={rankColorClass} /></div>
              <div className="grid h-20 w-20 overflow-hidden place-items-center rounded-full border border-white/15 bg-black/30 shadow-md">
                {hostAvatar ? <img src={hostAvatar} alt={profileName || "Host"} className="h-full w-full object-cover" /> : <Rocket className="h-6 w-6 text-white/40" />}
              </div>
            </div>
            <div className="text-left flex flex-col justify-center">
              <span className="text-[9px] font-bold tracking-wider text-white/40 uppercase">Vibes Score</span>
              <span className={`text-2xl font-black ${rankColorClass}`}>{vibeScore.toLocaleString()}</span>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/80 border border-white/10">
                ⭐ Lvl {hostLevel ?? 1} · <span className={rankColorClass}>{data.current_rank}</span>
              </span>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] text-white/60 mb-1"><span className="font-medium tracking-wide">Vibes Meter</span><span className="font-bold">{vibePercentage.toFixed(1)}%</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 p-0.5"><div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${vibePercentage}%`, background: "linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)" }} /></div>
            <p className="mt-1.5 text-center text-[9px] text-white/35">{vibeScore.toLocaleString()} / {vibeTarget.toLocaleString()} popularity points</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <StatItem icon={<Clock3 className="h-3 w-3 text-blue-400" />} label="Total Live" value={formatHours(data.total_live_seconds)} />
          <StatItem icon={<Flame className="h-3 w-3 text-amber-400" />} label="Streak" value={`${data.streak_days}d`} />
          <StatItem icon={<Users className="h-3 w-3 text-indigo-400" />} label="7d Followers" value={data.weekly_followers.toLocaleString()} />
          <StatItem icon={<Gift className="h-3 w-3 text-pink-400" />} label="Gifts Power" value={data.gifts_power.toLocaleString()} />
          <StatItem icon={<Clock3 className="h-3 w-3 text-cyan-400" />} label="Today Live" value={formatHours(data.today_live_seconds)} />
          <StatItem icon={<Clock3 className="h-3 w-3 text-teal-400" />} label="This Week" value={formatHours(data.week_live_seconds)} />
        </div>

        <div className="mb-2 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-purple-500/10 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[10px] font-bold tracking-wide text-white/90">Daily Target (6h Live + 1M Gifts)</span>
            </div>
            <span className="text-[10px] font-bold text-red-400">{data.tasks_completed}/100</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 mb-2">
            <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${taskProgress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-white/70 bg-black/30 p-1.5 rounded-lg border border-white/5">
            <span className="flex items-center gap-1 text-red-300 font-semibold">
              <Coins className="h-3 w-3" /> Reward: 100K Red Diamonds
            </span>
            <span className="text-emerald-400 font-bold">Value: PKR {data.red_diamonds_pkr_value}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <StatItem icon={<Gift className="h-3 w-3 text-pink-400" />} label="Host Bonus" value={data.host_bonus.toLocaleString()} />
          <StatItem icon={<Rocket className="h-3 w-3 text-amber-400" />} label="Commission" value={data.host_commission.toLocaleString()} />
        </div>

        <p className="mt-3 text-center text-[9px] text-white/40">{loading ? "Syncing real host data…" : error ? error : "Real live data synchronized"}</p>
      </section>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center flex flex-col justify-center">
      <div className="mb-0.5 flex items-center justify-center gap-1 text-white/50">{icon}<span className="text-[9px] font-medium">{label}</span></div>
      <div className="text-xs font-bold tracking-tight text-white truncate">{value}</div>
    </div>
  );
}
