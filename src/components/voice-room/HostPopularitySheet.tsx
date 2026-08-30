import { useEffect, useState } from "react";
import { CheckCircle2, Gift, Rocket, Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  roomId: string;
  open: boolean;
  onClose: () => void;
  popularityPct: number;
  hostName?: string | null;
};

type PopularityData = {
  completed: number;
  target: number;
  bonus: number;
  commission: number;
};

const fallback = (pct: number): PopularityData => ({
  completed: Math.max(0, Math.round(pct)),
  target: 100,
  bonus: 0,
  commission: 0,
});

export function HostPopularitySheet({ roomId, open, onClose, popularityPct, hostName }: Props) {
  const [data, setData] = useState<PopularityData>(() => fallback(popularityPct));

  useEffect(() => {
    if (!open) return;
    // Keep the existing popularity percentage as the authoritative UI value.
    // Commission/bonus are read only when matching columns exist; no fake earnings are created.
    let active = true;
    const load = async () => {
      const base = fallback(popularityPct);
      try {
        const { data: room } = await supabase
          .from("live_rooms")
          .select("popularity, popularity_completed, popularity_target, host_bonus, host_commission")
          .eq("id", roomId)
          .maybeSingle();
        if (!active || !room) return;
        const row = room as Record<string, unknown>;
        setData({
          completed: Number(row.popularity_completed ?? row.popularity ?? base.completed) || 0,
          target: Number(row.popularity_target ?? 100) || 100,
          bonus: Number(row.host_bonus ?? 0) || 0,
          commission: Number(row.host_commission ?? 0) || 0,
        });
      } catch {
        if (active) setData(base);
      }
    };
    void load();
    return () => { active = false; };
  }, [open, roomId, popularityPct]);

  if (!open) return null;

  const progress = Math.min(100, Math.max(0, (data.completed / Math.max(1, data.target)) * 100));
  const remaining = Math.max(0, data.target - data.completed);

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <section className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#100719]/95 p-4 text-white shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()}>
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[color:var(--primary)]/25">
              <Rocket className="h-5 w-5 text-[color:var(--secondary)]" />
            </div>
            <div>
              <h2 className="text-sm font-black">Host Popularity</h2>
              <p className="text-[10px] text-white/45">{hostName ? `${hostName}'s room` : "Room popularity task"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Close popularity">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/45">Popularity</p>
              <p className="mt-1 text-3xl font-black">{Math.round(popularityPct)}%</p>
            </div>
            <Trophy className="h-7 w-7 text-amber-300" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/50">
            <span>{data.completed} completed</span>
            <span>{remaining} remaining</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat icon={<CheckCircle2 />} label="Task Completed" value={`${data.completed}/${data.target}`} />
          <Stat icon={<Rocket />} label="Remaining" value={String(remaining)} />
          <Stat icon={<Gift />} label="Host Bonus" value={data.bonus ? `${data.bonus}` : "—"} />
          <Stat icon={<Trophy />} label="Commission" value={data.commission ? `${data.commission}` : "—"} />
        </div>

        <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-[9px] leading-4 text-white/45">
          Bonus and commission are shown only when the room backend provides those values. No earning amount is invented by the UI.
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
