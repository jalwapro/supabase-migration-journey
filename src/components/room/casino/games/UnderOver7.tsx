import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
type Pick = "under" | "over" | "exact";

export function UnderOver7({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
  const { profile, refresh } = useAuth();
  const play = useCasinoPlay("under_over_7", roomId);
  const [bet, setBet] = useState(500);
  const [pick, setPick] = useState<Pick>("under");
  const [dice, setDice] = useState<[number, number]>([3, 4]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<(CasinoResult & { dice?: number[]; total?: number }) | null>(null);
  const [poor, setPoor] = useState(false);
  const balance = Number(profile?.coins ?? 0);

  const roll = async () => {
    if (rolling || play.isPending) return;
    if (balance < bet) return setPoor(true);
    haptic();
    setRolling(true);
    setResult(null);
    const t = window.setInterval(() => {
      setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      blip(320 + Math.random() * 200, 0.02, "square");
    }, 90);
    try {
      const r = (await play.mutateAsync({ bet, params: { pick } })) as CasinoResult & { dice?: number[] };
      window.setTimeout(() => {
        window.clearInterval(t);
        if (r.dice?.length === 2) setDice([r.dice[0], r.dice[1]]);
        setResult(r);
        setRolling(false);
        blip(r.won ? 960 : 170, 0.18, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 45 : 15);
        void refresh?.();
      }, 700);
    } catch (e) {
      window.clearInterval(t);
      setRolling(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  const OPTIONS: { key: Pick; label: string; mult: string; color: string }[] = [
    { key: "under", label: "UNDER 7", mult: "2.3x", color: "#38bdf8" },
    { key: "exact", label: "EXACT 7", mult: "5.8x", color: "var(--gold)" },
    { key: "over", label: "OVER 7", mult: "2.3x", color: "#f43f5e" },
  ];

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="UNDER & OVER 7"
      icon="🎲"
      accent="#38bdf8"
      balance={balance}
      gameSlug="under_over_7"
      help="Two dice are rolled by the server. Bet on a total under 7, exactly 7, or over 7."
      footer={
        <div className="space-y-2">
          <BetSelector value={bet} onChange={setBet} disabled={rolling} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={rolling} />
          <GameActionButton
            label={rolling ? "Rolling…" : `ROLL · ${formatCompact(bet)}`}
            onClick={roll}
            disabled={rolling || play.isPending}
            accent="linear-gradient(90deg,#0ea5e9,#6366f1,#0ea5e9)"
          />
        </div>
      }
    >
      <div className="relative rounded-[22px] border border-sky-400/40 bg-[radial-gradient(circle_at_50%_15%,#0b3a55_0%,#0a1029_50%,#04030a_100%)] p-4">
        <WinAnimation show={!!result?.won} amount={result?.payout ?? 0} />

        <div className="flex items-center justify-center gap-4">
          {dice.map((d, i) => (
            <div
              key={i}
              className={`grid h-24 w-24 place-items-center rounded-3xl border-2 border-white/25 bg-white/95 text-6xl text-black shadow-[0_0_40px_-10px_#38bdf8] ${
                rolling ? "animate-pulse" : ""
              }`}
            >
              {PIPS[d]}
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-sm font-black text-white">
          TOTAL <span className="text-[color:var(--gold)]">{dice[0] + dice[1]}</span>
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => {
            const active = pick === o.key;
            return (
              <button
                key={o.key}
                disabled={rolling}
                onClick={() => {
                  haptic();
                  setPick(o.key);
                }}
                className="min-h-[64px] rounded-2xl border-2 px-2 py-2 text-center transition active:scale-95 disabled:opacity-60"
                style={{
                  borderColor: active ? o.color : "rgba(255,255,255,.14)",
                  background: active ? `color-mix(in oklab, ${o.color} 22%, transparent)` : "rgba(0,0,0,.35)",
                  boxShadow: active ? `0 0 24px -8px ${o.color}` : undefined,
                }}
              >
                <p className="text-[11px] font-black text-white">{o.label}</p>
                <p className="text-[10px] font-black" style={{ color: o.color }}>
                  {o.mult}
                </p>
              </button>
            );
          })}
        </div>

        {result && (
          <p
            className={`mt-4 rounded-xl border px-3 py-2 text-center text-xs font-black ${
              result.won
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {result.won ? `WIN · +${formatCompact(result.payout)}` : `LOSS · -${formatCompact(result.bet)}`}
          </p>
        )}

        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}
