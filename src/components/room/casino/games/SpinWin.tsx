import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";

const SEGMENTS = [
  { label: "0x", mult: 0, color: "#3f3f46" },
  { label: "1.5x", mult: 1.5, color: "#0ea5e9" },
  { label: "0x", mult: 0, color: "#3f3f46" },
  { label: "2x", mult: 2, color: "#a855f7" },
  { label: "0x", mult: 0, color: "#3f3f46" },
  { label: "3x", mult: 3, color: "#f97316" },
  { label: "0.5x", mult: 0.5, color: "#64748b" },
  { label: "10x", mult: 10, color: "var(--gold)" },
];

type Res = CasinoResult & { segment?: number };

/** Spin & Win — 8-segment prize wheel, landing index comes from the server. */
export function SpinWin({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
  const { profile, refresh } = useAuth();
  const play = useCasinoPlay("spin_win", roomId);
  const [bet, setBet] = useState(500);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Res | null>(null);
  const [poor, setPoor] = useState(false);
  const balance = Number(profile?.coins ?? 0);
  const seg = 360 / SEGMENTS.length;

  const spin = async () => {
    if (spinning || play.isPending) return;
    if (balance < bet) return setPoor(true);
    haptic();
    setSpinning(true);
    setResult(null);
    try {
      const r = (await play.mutateAsync({ bet, params: {} })) as Res;
      const idx = typeof r.segment === "number" ? r.segment % SEGMENTS.length : 0;
      const target = 360 * 6 + (360 - idx * seg - seg / 2);
      setAngle((a) => a + target);
      window.setTimeout(() => {
        setSpinning(false);
        setResult(r);
        blip(r.won ? 980 : 150, 0.2, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 45 : 15);
        void refresh?.();
      }, 3400);
    } catch (e) {
      setSpinning(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  const gradient = `conic-gradient(${SEGMENTS.map(
    (s, i) => `${s.color} ${i * seg}deg ${(i + 1) * seg}deg`,
  ).join(",")})`;

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="SPIN & WIN"
      icon="🎡"
      accent="#a855f7"
      balance={balance}
      gameSlug="spin_win"
      help="One spin, eight segments. The server picks the winning segment; the wheel just shows you where it landed."
      footer={
        <div className="space-y-2">
          <BetSelector value={bet} onChange={setBet} disabled={spinning} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={spinning} />
          <GameActionButton
            label={spinning ? "Spinning…" : `SPIN · ${formatCompact(bet)}`}
            onClick={spin}
            disabled={spinning || play.isPending}
            accent="linear-gradient(90deg,#a855f7,#ec4899,#8b5cf6)"
          />
        </div>
      }
    >
      <div className="relative rounded-[22px] border border-fuchsia-400/40 bg-[radial-gradient(circle_at_50%_15%,#33094a_0%,#160823_55%,#04030a_100%)] p-4">
        <WinAnimation show={!!result?.won} amount={result?.payout ?? 0} />

        <div className="relative mx-auto aspect-square w-full max-w-[280px]">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-2xl">🔻</div>
          <div
            className="h-full w-full rounded-full border-4 border-[color:var(--gold)]/70 shadow-[0_0_60px_-12px_#a855f7]"
            style={{
              background: gradient,
              transform: `rotate(${angle}deg)`,
              transition: "transform 3.3s cubic-bezier(.15,.9,.2,1)",
            }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-[color:var(--gold)]/70 bg-black/85 text-center">
              <span className="text-[10px] font-black tracking-widest text-[color:var(--gold)]">JALWA</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {SEGMENTS.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/10 bg-black/40 py-1 text-center text-[10px] font-black"
              style={{ color: s.color }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {result && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs font-black ${
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
