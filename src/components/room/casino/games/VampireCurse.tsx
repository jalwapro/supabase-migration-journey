import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";

type Res = CasinoResult & { cursed?: number[]; opened?: number };
const COFFINS = 9;

/** Vampire Curse — open coffins for treasure; three are cursed. */
export function VampireCurse({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
  const { profile, refresh } = useAuth();
  const play = useCasinoPlay("vampire_curse", roomId);
  const [bet, setBet] = useState(500);
  const [opened, setOpened] = useState<number[]>([]);
  const [cursed, setCursed] = useState<number[]>([]);
  const [result, setResult] = useState<Res | null>(null);
  const [poor, setPoor] = useState(false);
  const balance = Number(profile?.coins ?? 0);
  const over = !!result && !result.won;

  const reset = () => {
    setOpened([]);
    setCursed([]);
    setResult(null);
  };

  const openCoffin = async (i: number) => {
    if (play.isPending || over || opened.includes(i)) return;
    if (opened.length === 0 && balance < bet) return setPoor(true);
    haptic();
    try {
      const r = (await play.mutateAsync({ bet, params: { picks: [...opened, i] } })) as Res;
      setOpened((o) => [...o, i]);
      setResult(r);
      if (!r.won) {
        setCursed(r.cursed ?? [i]);
        blip(130, 0.24, "sawtooth");
        haptic(35);
      } else {
        blip(880, 0.12, "sine");
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
      title="VAMPIRE CURSE"
      icon="🧛"
      accent="#dc2626"
      balance={balance}
      gameSlug="vampire_curse"
      help="Open coffins to collect treasure. Three coffins hide the vampire's curse — one is enough to end the round."
      footer={
        <div className="space-y-2">
          <BetSelector value={bet} onChange={setBet} disabled={opened.length > 0 && !over} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={opened.length > 0 && !over} />
          <GameActionButton
            label={over ? "NEW ROUND" : `OPEN A COFFIN · ${formatCompact(bet)}`}
            onClick={reset}
            disabled={!over}
            accent="linear-gradient(90deg,#dc2626,#7f1d1d,#b91c1c)"
          />
        </div>
      }
    >
      <div className="relative rounded-[22px] border border-red-500/40 bg-[radial-gradient(circle_at_50%_12%,#3a0710_0%,#150618_55%,#030206_100%)] p-4">
        <WinAnimation show={!!result?.won} amount={result?.payout ?? 0} />

        <p className="text-center text-[11px] font-black tracking-[0.4em] text-red-300">THE CRYPT</p>

        <div className="mx-auto mt-3 grid max-w-[300px] grid-cols-3 gap-2">
          {Array.from({ length: COFFINS }).map((_, i) => {
            const isOpen = opened.includes(i);
            const isCursed = cursed.includes(i);
            return (
              <button
                key={i}
                disabled={play.isPending || over || isOpen}
                onClick={() => openCoffin(i)}
                className={`grid aspect-[3/4] place-items-center rounded-2xl border-2 text-3xl transition active:scale-95 disabled:opacity-90 ${
                  isCursed
                    ? "border-red-500 bg-red-900/50 shadow-[0_0_26px_-6px_#ef4444]"
                    : isOpen
                      ? "border-emerald-500/60 bg-emerald-900/30"
                      : "border-white/15 bg-black/55 hover:border-red-400/50"
                }`}
              >
                {isCursed ? "🧛" : isOpen ? "💰" : "⚰️"}
              </button>
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
            {result.won ? `TREASURE · +${formatCompact(result.payout)}` : `CURSED! · -${formatCompact(result.bet)}`}
          </p>
        )}

        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}
