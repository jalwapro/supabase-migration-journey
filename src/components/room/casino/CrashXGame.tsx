import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import {
  CASINO_CHIPS,
  blip,
  haptic,
  useCasinoGame,
  useCasinoPlay,
  useCasinoRecent,
  type CasinoResult,
} from "@/lib/casino";
import { CasinoPopupShell, ChipRow, WinBurst } from "./CasinoPopupShell";

const TARGETS = [1.5, 2, 3, 5, 10];

/**
 * Crash X — the rocket climbs, cash out before it explodes.
 * The crash point is rolled server-side at bet time and compared against the
 * cash-out target, so the client animation can never influence the payout.
 */
export function CrashXGame({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { profile, refresh } = useAuth();
  const cfg = useCasinoGame("crash");
  const play = useCasinoPlay("crash", roomId);
  const recent = useCasinoRecent("crash", open);

  const [bet, setBet] = useState(500);
  const [target, setTarget] = useState(2);
  const [running, setRunning] = useState(false);
  const [mult, setMult] = useState(1);
  const [result, setResult] = useState<CasinoResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const raf = useRef<number | null>(null);

  const balance = Number(profile?.coins ?? 0);
  const maxMult = Number((cfg?.config as { max_multiplier?: number } | undefined)?.max_multiplier ?? 100);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const start = async () => {
    if (running || play.isPending) return;
    haptic();
    setResult(null);
    setRunning(true);
    setMult(1);
    let r: CasinoResult;
    try {
      r = await play.mutateAsync({ bet, params: { auto_cashout: target } });
    } catch (e) {
      setRunning(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
      return;
    }
    const stop = Number(r.crash_at ?? 1);
    const t0 = performance.now();
    const tick = () => {
      const secs = (performance.now() - t0) / 1000;
      const m = Math.min(stop, Math.pow(Math.E, 0.36 * secs));
      setMult(m);
      if (m < stop) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setMult(stop);
        setRunning(false);
        setResult(r);
        setHistory((h) => [stop, ...h].slice(0, 12));
        blip(r.won ? 940 : 120, 0.25, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 45 : 60);
        void refresh?.();
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const cashedEarly = running && mult >= target;
  const exploded = !!result && !result.cashed_out;

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="Crash X"
      icon="🚀"
      accent="#8b5cf6"
      balance={balance}
      footer={
        <div className="space-y-2">
          <ChipRow chips={CASINO_CHIPS} value={bet} onChange={setBet} disabled={running} />
          <button
            onClick={start}
            disabled={running || play.isPending}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-black text-white shadow-[0_10px_30px_-10px_#8b5cf6] transition active:scale-[0.98] disabled:opacity-50"
          >
            {running ? "In flight…" : `Place Bet · ${formatCompact(bet)} @ ${target.toFixed(2)}x`}
          </button>
        </div>
      }
    >
      <div className="relative">
        <WinBurst show={!!result?.won} amount={result?.payout ?? 0} />

        <div
          className={`relative overflow-hidden rounded-3xl border p-4 ${
            exploded ? "border-red-500/60" : "border-violet-500/40"
          }`}
          style={{
            background: "radial-gradient(120% 80% at 50% 100%, #2a0a4d 0%, #07020f 70%)",
            animation: exploded ? "jalwa-shake 0.4s" : undefined,
          }}
        >
          <div className="flex h-40 flex-col items-center justify-center">
            <p
              className={`text-5xl font-black tabular-nums ${
                exploded ? "text-red-400" : cashedEarly || result?.won ? "text-emerald-300" : "text-white"
              }`}
              style={{ textShadow: "0 0 26px currentColor" }}
            >
              {mult.toFixed(2)}x
            </p>
            <div
              className="mt-2 text-3xl transition-transform"
              style={{
                transform: `translateY(${-Math.min(60, (mult - 1) * 14)}px) rotate(${exploded ? 90 : 0}deg)`,
              }}
            >
              {exploded ? "💥" : "🚀"}
            </div>
            <p className="mt-2 text-[11px] font-bold text-foreground/55">
              {running ? "Round in progress" : exploded ? `Crashed at ${result?.crash_at}x` : "Set your cash-out and launch"}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-foreground/50">Auto cash-out</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTarget((t) => Math.max(1.1, Math.round((t - 0.1) * 10) / 10))}
              disabled={running}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/40 font-black disabled:opacity-40"
            >
              −
            </button>
            <div className="flex-1 rounded-xl border border-white/12 bg-black/40 py-2 text-center text-lg font-black text-[color:var(--gold)]">
              {target.toFixed(2)}x
            </div>
            <button
              onClick={() => setTarget((t) => Math.min(maxMult, Math.round((t + 0.1) * 10) / 10))}
              disabled={running}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/40 font-black disabled:opacity-40"
            >
              +
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            {TARGETS.map((t) => (
              <button
                key={t}
                disabled={running}
                onClick={() => setTarget(t)}
                className={`flex-1 rounded-lg border py-1 text-[10px] font-black transition disabled:opacity-40 ${
                  target === t ? "border-[color:var(--gold)] text-[color:var(--gold)]" : "border-white/12 text-foreground/60"
                }`}
              >
                {t.toFixed(2)}x
              </button>
            ))}
          </div>
        </div>

        {result && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs font-black ${
              result.won
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {result.won
              ? `Cashed out at ${result.target}x · +${formatCompact(result.payout)}`
              : `Crashed at ${result.crash_at}x · -${formatCompact(result.bet)}`}
          </p>
        )}

        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-foreground/50">Previous rounds</p>
          <div className="flex gap-1 overflow-x-auto">
            {history.length === 0 && <span className="text-[10px] text-foreground/40">No rounds yet</span>}
            {history.map((h, i) => (
              <span
                key={i}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${
                  h >= 2 ? "border-emerald-500/50 text-emerald-300" : "border-red-500/40 text-red-300"
                }`}
              >
                {h.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-foreground/50">Top cash-outs</p>
          {(recent.data ?? []).slice(0, 4).map((w, i) => (
            <div key={i} className="flex items-center justify-between py-0.5 text-[11px]">
              <span className="truncate text-foreground/70">{w.username}</span>
              <span className="font-black text-[color:var(--gold)]">+{formatCompact(w.payout)}</span>
            </div>
          ))}
          {(recent.data ?? []).length === 0 && (
            <p className="text-[10px] text-foreground/40">Be the first winner.</p>
          )}
        </div>

        <style>{`@keyframes jalwa-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`}</style>
      </div>
    </CasinoPopupShell>
  );
}
