import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Coins, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/games/lucky-spin")({
  component: LuckySpin,
});

const SEGMENTS = [
  { label: "LOSE", mult: 0, color: "#4b1d3f" },
  { label: "1.5x", mult: 1.5, color: "#7c3aed" },
  { label: "LOSE", mult: 0, color: "#4b1d3f" },
  { label: "2x", mult: 2, color: "#f59e0b" },
  { label: "LOSE", mult: 0, color: "#4b1d3f" },
  { label: "5x", mult: 5, color: "#ef4444" },
  { label: "1.5x", mult: 1.5, color: "#7c3aed" },
  { label: "10x", mult: 10, color: "#fbbf24" },
];

function LuckySpin() {
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [bet, setBet] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ outcome: string; payout: number } | null>(null);

  const history = useQuery({
    queryKey: ["game_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_rounds")
        .select("id,outcome,multiplier,payout_coins,bet_coins,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const play = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("play_lucky_spin", { _bet: bet });
      if (error) throw error;
      return data as { outcome: string; multiplier: number; payout_coins: number };
    },
    onSuccess: async (r) => {
      // Find segment matching outcome
      const targetIdx = SEGMENTS.findIndex((s) => s.label.toLowerCase() === r.outcome.toLowerCase());
      const idx = targetIdx >= 0 ? targetIdx : 0;
      const seg = 360 / SEGMENTS.length;
      const spin = 360 * 6 + (360 - (idx * seg + seg / 2));
      setSpinning(true);
      setRotation((prev) => prev + spin);
      setTimeout(async () => {
        setSpinning(false);
        setLastResult({ outcome: r.outcome, payout: r.payout_coins });
        if (r.payout_coins > 0) {
          toast.success(`You won ${r.payout_coins.toLocaleString()} coins! (${r.outcome})`);
        } else {
          toast(`No luck this time — ${r.outcome}`);
        }
        await refresh();
        qc.invalidateQueries({ queryKey: ["game_history"] });
      }, 4200);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    // reset lastResult when bet changes
    setLastResult(null);
  }, [bet]);

  const canPlay = !spinning && !play.isPending && (profile?.coins ?? 0) >= bet;

  return (
    <>
      <AppShell
        title="Lucky Spin"
        subtitle="Win up to 10x"
        right={
          <Link to="/games" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-card/60">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <div className="px-4 pt-4">
          {/* Wheel */}
          <div className="relative mx-auto aspect-square w-72 max-w-full">
            {/* Pointer */}
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
              <div className="h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-[color:var(--gold)]" />
            </div>
            <div
              className="relative h-full w-full rounded-full border-4 border-[color:var(--gold)] shadow-[0_0_60px_-10px_color-mix(in_oklab,var(--gold)_50%,transparent)] transition-transform"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? "4s" : "0.4s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                background: `conic-gradient(${SEGMENTS.map((s, i) => {
                  const seg = 360 / SEGMENTS.length;
                  return `${s.color} ${i * seg}deg ${(i + 1) * seg}deg`;
                }).join(",")})`,
              }}
            >
              {SEGMENTS.map((s, i) => {
                const seg = 360 / SEGMENTS.length;
                const angle = i * seg + seg / 2;
                return (
                  <div
                    key={i}
                    className="pointer-events-none absolute inset-0"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className="absolute left-1/2 top-[14%] -translate-x-1/2 text-[12px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                    >
                      {s.label}
                    </div>
                  </div>
                );
              })}
              <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background text-2xl">
                🎡
              </div>
            </div>
          </div>

          {lastResult && (
            <p className="mt-3 text-center text-sm font-bold">
              Last: <span className={lastResult.payout > 0 ? "text-[color:var(--gold)]" : "text-muted-foreground"}>
                {lastResult.outcome}{lastResult.payout > 0 && ` · +${lastResult.payout.toLocaleString()} coins`}
              </span>
            </p>
          )}

          {/* Bet controls */}
          <div className="mt-4 glass rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Your bet
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 500, 1000, 5000, 10000].map((v) => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    bet === v
                      ? "border-[color:var(--primary)] bg-[color:var(--primary)]/20"
                      : "border-border bg-card/40 text-muted-foreground"
                  }`}
                >
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
            <button
              onClick={() => play.mutate()}
              disabled={!canPlay}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {spinning || play.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Coins className="h-4 w-4" />
              )}
              Spin for {bet.toLocaleString()}
            </button>
            {(profile?.coins ?? 0) < bet && (
              <p className="mt-2 text-center text-[11px] text-[color:var(--destructive)]">
                Not enough coins. <Link to="/recharge" className="underline">Recharge</Link>
              </p>
            )}
          </div>

          {/* Recent rounds */}
          <div className="mt-4 glass rounded-2xl p-4">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Trophy className="h-3 w-3" /> Recent rounds
            </p>
            {history.data?.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No rounds yet</p>
            )}
            <div className="space-y-1.5">
              {history.data?.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Bet {h.bet_coins.toLocaleString()}
                  </span>
                  <span className={h.payout_coins > 0 ? "font-bold text-[color:var(--gold)]" : "text-muted-foreground"}>
                    {h.outcome} · {h.payout_coins > 0 ? `+${h.payout_coins.toLocaleString()}` : "0"}
                  </span>
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
