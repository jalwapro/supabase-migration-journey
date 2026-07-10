import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/games/daily-spin")({
  component: DailySpin,
});

type Prize = {
  id: string;
  label: string;
  kind: string;
  color: string;
  sort: number;
};
type SpinResult = {
  id: string;
  reward_kind: string;
  reward_amount: number;
  reward_label: string;
  granted_theme_id: string | null;
  next_spin_at: string;
  prize_id: string;
};

function fmtLeft(ms: number) {
  if (ms <= 0) return "Ready!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function DailySpin() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<SpinResult | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const prizes = useQuery({
    queryKey: ["spin_prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spin_prizes")
        .select("id,label,kind,color,sort")
        .eq("is_active", true)
        .order("sort");
      if (error) throw error;
      return (data ?? []) as Prize[];
    },
  });

  const nextAt = useQuery({
    queryKey: ["next_spin_at"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("next_spin_at");
      if (error) throw error;
      return data as string | null;
    },
  });

  const spin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("spin_daily_wheel");
      if (error) throw error;
      return data as SpinResult;
    },
    onSuccess: (r) => {
      const list = prizes.data ?? [];
      const idx = Math.max(0, list.findIndex((p) => p.id === r.prize_id));
      const seg = 360 / list.length;
      const target = 360 * 6 + (360 - (idx * seg + seg / 2));
      setSpinning(true);
      setRotation((prev) => prev + target);
      setTimeout(async () => {
        setSpinning(false);
        setLast(r);
        toast.success(`You won: ${r.reward_label}!`);
        await refresh();
        qc.invalidateQueries({ queryKey: ["next_spin_at"] });
      }, 4200);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readyAt = nextAt.data ? new Date(nextAt.data).getTime() : 0;
  const remaining = readyAt - now;
  const ready = remaining <= 0;
  const list = prizes.data ?? [];

  return (
    <>
      <AppShell
        title="Daily Spin"
        subtitle="Free reward every 24 hours"
        right={
          <Link to="/games" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-card/60">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <div className="px-4 pt-4">
          <div className="relative mx-auto aspect-square w-80 max-w-full">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
              <div className="h-0 w-0 border-x-[12px] border-t-[20px] border-x-transparent border-t-[color:var(--gold)]" />
            </div>
            <div
              className="relative h-full w-full rounded-full border-4 border-[color:var(--gold)] shadow-[0_0_80px_-10px_color-mix(in_oklab,var(--gold)_60%,transparent)] transition-transform"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? "4s" : "0.4s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                background:
                  list.length > 0
                    ? `conic-gradient(${list
                        .map((p, i) => {
                          const seg = 360 / list.length;
                          return `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`;
                        })
                        .join(",")})`
                    : "conic-gradient(#333 0deg 360deg)",
              }}
            >
              {list.map((p, i) => {
                const seg = 360 / list.length;
                const angle = i * seg + seg / 2;
                return (
                  <div
                    key={p.id}
                    className="absolute left-1/2 top-1/2 origin-left text-[10px] font-black text-white drop-shadow"
                    style={{ transform: `rotate(${angle}deg) translate(20%, -50%)` }}
                  >
                    {p.label}
                  </div>
                );
              })}
              <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background text-3xl shadow-inner">
                🎁
              </div>
            </div>
          </div>

          {last && (
            <p className="mt-3 text-center text-sm">
              <span className="font-bold text-[color:var(--gold)]">Won: {last.reward_label}</span>
            </p>
          )}

          <div className="mt-5 glass rounded-2xl p-4 text-center">
            {ready ? (
              <button
                onClick={() => spin.mutate()}
                disabled={spinning || spin.isPending || list.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
              >
                {spinning || spin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Spin now
              </button>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Next spin in
                </p>
                <p className="mt-1 font-mono text-2xl font-black text-[color:var(--gold)]">
                  {fmtLeft(remaining)}
                </p>
              </>
            )}
          </div>

          <div className="mt-4 glass rounded-2xl p-4">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Trophy className="h-3 w-3" /> Possible prizes
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {list.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-card/40 px-2 py-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
