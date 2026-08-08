import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";

/**
 * Crash Point — the server decides the crash point up-front from the chosen
 * auto cash-out target; the rocket climb is purely a render of that result.
 */
export function CrashPoint({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
  const { profile, refresh } = useAuth();
  const play = useCasinoPlay("crash_point", roomId);
  const [bet, setBet] = useState(500);
  const [target, setTarget] = useState(2);
  const [mult, setMult] = useState(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<(CasinoResult & { crash_at?: number }) | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [poor, setPoor] = useState(false);
  const raf = useRef(0);
  const balance = Number(profile?.coins ?? 0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const start = async () => {
    if (running || play.isPending) return;
    if (balance < bet) return setPoor(true);
    haptic();
    setRunning(true);
    setResult(null);
    setMult(1);
    try {
      const r = (await play.mutateAsync({ bet, params: { auto_cashout: target } })) as CasinoResult & {
        crash_at?: number;
      };
      const crash = Number(r.crash_at ?? 1);
      const stop = r.won ? Number(r.target ?? target) : crash;
      const t0 = performance.now();
      const tick = (t: number) => {
        const m = 1 + (t - t0) / 900;
        if (m >= stop) {
          setMult(stop);
          setRunning(false);
          setResult(r);
          setHistory((h) => [crash, ...h].slice(0, 8));
          blip(r.won ? 980 : 130, 0.2, r.won ? "sine" : "sawtooth");
          haptic(r.won ? 45 : 25);
          void refresh?.();
          return;
        }
        setMult(m);
        if (Math.random() < 0.08) blip(400 + m * 60, 0.015, "square");
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      setRunning(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  const crashed = !!result && !result.won;

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="CRASH POINT"
      icon="💥"
      accent="#f97316"
      balance={balance}
      gameSlug="crash_point"
      help="Set your target multiplier. If the rocket reaches it before the crash point, you cash out automatically."
      footer={
        <div className="space-y-2">
          <BetSelector value={bet} onChange={setBet} disabled={running} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={running} />
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-white/50">Target</span>
            <input
              type="range"
              min={1.1}
              max={20}
              step={0.1}
              value={target}
              disabled={running}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="h-11 min-w-0 flex-1 accent-[color:var(--gold)]"
            />
            <span className="w-14 shrink-0 text-right text-sm font-black text-[color:var(--gold)]">
              {target.toFixed(2)}x
            </span>
          </div>
          <GameActionButton
            label={running ? "Flying…" : `LAUNCH · ${formatCompact(bet)}`}
            onClick={start}
            disabled={running || play.isPending}
            accent="linear-gradient(90deg,#f97316,#ef4444,#f59e0b)"
          />
        </div>
      }
    >
      <div className="relative overflow-hidden rounded-[22px] border border-orange-400/40 bg-[radial-gradient(circle_at_50%_85%,#3b1206_0%,#150713_55%,#04030a_100%)] p-4">
        <WinAnimation show={!!result?.won} amount={result?.payout ?? 0} />

        <div className="relative grid h-52 place-items-center">
          <div
            className="absolute bottom-2 text-4xl transition-transform"
            style={{ transform: `translateY(${-Math.min(150, (mult - 1) * 55)}px) rotate(${crashed ? 90 : 0}deg)` }}
          >
            {crashed ? "💥" : "🚀"}
          </div>
          <p
            className="text-5xl font-black tabular-nums"
            style={{
              color: crashed ? "#ef4444" : "#fbbf24",
              textShadow: `0 0 32px ${crashed ? "#ef4444" : "#fbbf24"}`,
            }}
          >
            {mult.toFixed(2)}x
          </p>
        </div>

        {result && (
          <p
            className={`mt-2 rounded-xl border px-3 py-2 text-center text-xs font-black ${
              result.won
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {result.won
              ? `CASHED OUT ${Number(result.multiplier).toFixed(2)}x · +${formatCompact(result.payout)}`
              : `CRASHED AT ${Number(result.crash_at ?? 0).toFixed(2)}x`}
          </p>
        )}

        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {history.map((h, i) => (
            <span
              key={i}
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${
                h >= 2 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {h.toFixed(2)}x
            </span>
          ))}
        </div>

        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}
