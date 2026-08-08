import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { CASINO_CHIPS, blip, haptic, useSlotsSpin, type SlotsResult } from "@/lib/casino";
import { CasinoPopupShell, ChipRow, WinBurst } from "./CasinoPopupShell";

const SYMBOLS = ["🔔", "🍒", "💎", "👑", "🐯", "💰", "7️⃣"];
const PAYOUTS: Record<string, number> = { "7️⃣": 50, "💎": 20, "👑": 15, "💰": 10, "🔔": 5, "🐯": 3, "🍒": 2 };

type Props = { open: boolean; onClose: () => void; roomId?: string };

/**
 * Jalwa 777 Slots UI. The result is still server-authoritative through useCasinoPlay.
 * If the backend uses another game key, pass gameKey from the caller.
 */
export function Slots777Game({ open, onClose, roomId }: Props) {
  const { profile, refresh } = useAuth();
  const play = useSlotsSpin(roomId);
  const [bet, setBet] = useState(500);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(["7️⃣", "7️⃣", "7️⃣"]);
  const [result, setResult] = useState<SlotsResult | null>(null);
  const balance = Number(profile?.coins ?? 0);

  const spin = async () => {
    if (spinning || play.isPending) return;
    haptic();
    setSpinning(true);
    setResult(null);
    const timer = window.setInterval(() => {
      setReels([0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
      blip(260 + Math.random() * 180, 0.025, "square");
    }, 90);
    try {
      const r = await play.mutateAsync({ bet, params: {} });
      window.setTimeout(() => {
        window.clearInterval(timer);
        const serverReels = r.reels;
        if (Array.isArray(serverReels) && serverReels.length >= 3) setReels(serverReels.slice(0, 3));
        setResult(r);
        setSpinning(false);
        blip(r.won ? 980 : 160, 0.18, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 45 : 15);
        void refresh?.();
      }, 700);
    } catch (e) {
      window.clearInterval(timer);
      setSpinning(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  return (
    <CasinoPopupShell open={open} onClose={onClose} title="Jalwa 777 Slots" icon="🎰" accent="#ff4d9d" balance={balance}
      footer={<div className="space-y-2"><ChipRow chips={CASINO_CHIPS} value={bet} onChange={setBet} disabled={spinning} /><button onClick={spin} disabled={spinning || play.isPending} className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-emerald-600 py-3 text-base font-black text-white shadow-[0_10px_35px_-10px_#22c55e] disabled:opacity-50">{spinning ? "Spinning…" : `SPIN · ${formatCompact(bet)}`}</button></div>}
    >
      <div className="relative mx-auto w-full max-w-5xl rounded-[28px] border border-fuchsia-400/50 bg-[radial-gradient(circle_at_50%_20%,#5b123b_0%,#18061b_45%,#050208_100%)] p-4 shadow-[0_0_70px_-20px_#ff2ca8] sm:p-6">
        <WinBurst show={!!result?.won} amount={result?.payout ?? 0} />
        <div className="flex flex-col items-center">
          <div className="text-center"><p className="text-sm font-black tracking-[0.35em] text-yellow-300">JALWA</p><h2 className="text-4xl font-black text-yellow-100 sm:text-6xl">777 SLOTS</h2></div>
          <div className="mt-4 grid w-full grid-cols-3 gap-2 sm:gap-4">
            {reels.map((s, i) => <div key={i} className="grid aspect-[0.82] place-items-center rounded-2xl border-4 border-yellow-500/60 bg-black/70 text-6xl shadow-[inset_0_0_35px_rgba(255,170,0,.18),0_0_25px_-8px_#ffd000] sm:text-8xl">{s}</div>)}
          </div>
          <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
            <Stat label="BALANCE" value={formatCompact(balance)} />
            <Stat label="WIN" value={formatCompact(result?.payout ?? 0)} />
            <Stat label="JACKPOT" value="1,234,567" />
          </div>
          <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(PAYOUTS).map(([symbol, mult]) => <div key={symbol} className="rounded-xl border border-white/10 bg-black/35 p-2 text-center"><span className="text-2xl">{symbol}</span><p className="text-xs font-black text-yellow-200">{mult}x BET</p></div>)}
          </div>
          {result && <p className={`mt-4 w-full rounded-xl border px-3 py-2 text-center text-sm font-black ${result.won ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>{result.won ? `WIN · +${formatCompact(result.payout)}` : `LOSS · -${formatCompact(result.bet)}`}</p>}
        </div>
      </div>
    </CasinoPopupShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-yellow-500/40 bg-black/45 p-2"><p className="text-[10px] font-black text-yellow-300">{label}</p><p className="text-lg font-black text-white sm:text-2xl">🪙 {value}</p></div>;
}
