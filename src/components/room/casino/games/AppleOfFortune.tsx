import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";

type Res = CasinoResult & { worm_index?: number; level?: number };
const MULTS = [1.4, 2, 2.9, 4.2, 6.1, 9];

/** Apple of Fortune — pick a clean apple on each of 6 rows; one hides a worm. */
export function AppleOfFortune({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
  const { profile, refresh } = useAuth();
  const play = useCasinoPlay("apple_fortune", roomId);
  const [bet, setBet] = useState(500);
  const [level, setLevel] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [worm, setWorm] = useState<number | null>(null);
  const [result, setResult] = useState<Res | null>(null);
  const [poor, setPoor] = useState(false);
  const balance = Number(profile?.coins ?? 0);
  const busy = play.isPending;
  const dead = !!result && !result.won;

  const reset = () => {
    setLevel(0);
    setPicks([]);
    setWorm(null);
    setResult(null);
  };

  const pick = async (col: number) => {
    if (busy || dead) return;
    if (level === 0 && balance < bet) return setPoor(true);
    haptic();
    try {
      const r = (await play.mutateAsync({ bet, params: { level, choice: col } })) as Res;
      setPicks((p) => [...p, col]);
      if (r.won) {
        blip(880, 0.12, "sine");
        setLevel((l) => Math.min(MULTS.length - 1, l + 1));
        setResult(r);
      } else {
        setWorm(typeof r.worm_index === "number" ? r.worm_index : col);
        setResult(r);
        blip(140, 0.2, "sawtooth");
        haptic(30);
      }
      void refresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="APPLE OF FORTUNE"
      icon="🍎"
      accent="#ef4444"
      balance={balance}
      gameSlug="apple_fortune"
      help="Each row has one wormy apple. Pick a clean apple to climb the multiplier ladder; hit the worm and the round ends."
      footer={
        <div className="space-y-2">
          <BetSelector value={bet} onChange={setBet} disabled={level > 0 && !dead} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={level > 0 && !dead} />
          <GameActionButton
            label={dead ? "NEW ROUND" : `PICK AN APPLE · ${formatCompact(bet)}`}
            onClick={reset}
            disabled={!dead}
            accent="linear-gradient(90deg,#ef4444,#f97316,#dc2626)"
          />
        </div>
      }
    >
      <div className="relative rounded-[22px] border border-red-400/40 bg-[radial-gradient(circle_at_50%_15%,#3d0d15_0%,#170a20_55%,#04030a_100%)] p-3">
        <WinAnimation show={!!result?.won && level >= MULTS.length - 1} amount={result?.payout ?? 0} />

        <div className="space-y-1.5">
          {MULTS.map((m, row) => {
            const rowIdx = MULTS.length - 1 - row;
            const active = rowIdx === level && !dead;
            const done = rowIdx < level;
            return (
              <div key={rowIdx} className="flex items-center gap-2">
                <span
                  className={`w-12 shrink-0 text-right text-[11px] font-black ${
                    active ? "text-[color:var(--gold)]" : "text-white/35"
                  }`}
                >
                  {MULTS[rowIdx].toFixed(2)}x
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((c) => {
                    const chosen = picks[rowIdx] === c;
                    const isWorm = dead && rowIdx === level && worm === c;
                    return (
                      <button
                        key={c}
                        disabled={!active || busy}
                        onClick={() => pick(c)}
                        className={`grid h-10 place-items-center rounded-xl border text-lg transition active:scale-95 ${
                          active ? "border-white/25 bg-white/10" : "border-white/10 bg-black/40 opacity-60"
                        }`}
                      >
                        {isWorm ? "🐛" : done && chosen ? "🍏" : active ? "🍎" : "•"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {result && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs font-black ${
              result.won
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {result.won ? `SAFE · +${formatCompact(result.payout)}` : `WORM! · -${formatCompact(result.bet)}`}
          </p>
        )}

        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}
