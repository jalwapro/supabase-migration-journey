import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Gift, Rocket, Trophy, Flame, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** The current room is only used to resolve the authenticated host profile. */
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
};

const fallback = (pct: number): PopularityData => ({
  host_id: "",
  cumulative_popularity: Math.max(0, Math.round(pct)),
  total_live_seconds: 0,
  today_live_seconds: 0,
  week_live_seconds: 0,
  gifts_power: 0,
  tasks_completed: Math.max(0, Math.round(pct)),
  task_target: 100,
  streak_days: 0,
  host_bonus: 0,
  host_commission: 0,
});

const formatHours = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
        // Resolve the room's host once. All popularity data below is then read
        // from the host-profile keyed table, never from the room's counters.
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

        const { data: stats, error: statsError } = await (supabase as any).rpc("host_popularity_get", {
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
      .channel(`host-popularity-${hostId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "host_popularity_stats",
          filter: `host_id=eq.${hostId}`,
        },
        payload => {
          const row = payload.new as Partial<PopularityData>;
          setData(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(row).filter(([, value]) => value !== null && value !== undefined),
            ),
          }) as PopularityData);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, hostId]);

  const progress = useMemo(
    () => Math.min(100, Math.max(0, (data.tasks_completed / Math.max(1, data.task_target)) * 100)),
    [data.tasks_completed, data.task_target],
  );
  const remaining = Math.max(0, data.task_target - data.tasks_completed);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-t-[32px] border-t border-white/15 bg-[#100719]/95 p-5 text-white shadow-2xl backdrop-blur-xl transition-transform animate-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />

        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[color:var(--primary)]/25">
              <Rocket className="h-5 w-5 text-[color:var(--secondary)]" />
            </div>
            <div>
              <h2 className="text-sm font-black">Host Popularity</h2>
              <p className="text-[10px] text-white/45">
                {hostName ? `${hostName}'s cumulative host profile` : "Cumulative host profile progress"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Close popularity">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/45">Cumulative Popularity</p>
              <p className="mt-1 text-3xl font-black">{data.cumulative_popularity.toLocaleString()}</p>
              <p className="mt-0.5 text-[9px] text-white/40">Profile-linked · survives room restarts</p>
            </div>
            <Trophy className="h-7 w-7 text-amber-300" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/50">
            <span>{data.tasks_completed.toLocaleString()} tasks completed</span>
            <span>{remaining.toLocaleString()} remaining</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Task Progress" value={`${data.tasks_completed}/${data.task_target}`} />
          <Stat icon={<Rocket className="h-4 w-4" />} label="Remaining" value={remaining.toLocaleString()} />
          <Stat icon={<Clock3 className="h-4 w-4" />} label="Today Live" value={formatHours(data.today_live_seconds)} />
          <Stat icon={<Clock3 className="h-4 w-4" />} label="This Week" value={formatHours(data.week_live_seconds)} />
          <Stat icon={<Clock3 className="h-4 w-4" />} label="Total Live" value={formatHours(data.total_live_seconds)} />
          <Stat icon={<Gift className="h-4 w-4" />} label="Gifts Power" value={data.gifts_power.toLocaleString()} />
          <Stat icon={<Flame className="h-4 w-4" />} label="Live Streak" value={`${data.streak_days} day${data.streak_days === 1 ? "" : "s"}`} />
          <Stat icon={<Trophy className="h-4 w-4" />} label="Host Bonus" value={data.host_bonus ? data.host_bonus.toLocaleString() : "—"} />
        </div>

        <div className="mt-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/5 px-3 py-2.5">
          <p className="text-[10px] font-bold text-emerald-200">Commission</p>
          <p className="mt-0.5 text-sm font-black">{data.host_commission ? data.host_commission.toLocaleString() : "—"}</p>
          <p className="mt-0.5 text-[9px] leading-4 text-white/45">Commission is read from the server-side host profile balance; the UI does not invent an earning amount.</p>
        </div>

        <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-[9px] leading-4 text-white/45">
          {loading ? "Syncing host profile…" : "Popularity, completed tasks, gifts power and cumulative live time stay attached to the host ID when a new room is created."}
        </p>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-white/60">{icon}<span className="text-[9px] font-semibold">{label}</span></div>
      <div className="text-sm font-black">{value}</div>
    </div>
  );
}
