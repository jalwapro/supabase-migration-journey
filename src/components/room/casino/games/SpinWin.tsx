import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";
import { Sparkles, Trophy, Zap, Flame } from "lucide-react";

const SEGMENTS = [
  { label: "0x", mult: 0, color: "#3f3f46" },
  { label: "1.5x", mult: 1.5, color: "#0ea5e9" },
  { label: "0x", mult: 0, color: "#3f3f46" },
  { label: "2x", mult: 2, color: "#a855f7" },
  { label: "0x", mult: 0, color: "#3f3f46" },
  { label: "3x", mult: 3, color: "#f97316" },
  { label: "0.5x", mult: 0.5, color: "#64748b" },
  { label: "10x", mult: 10, color: "#eab308" },
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
    (s, i) => `${s.color} ${i * seg}deg${(i + 1) * seg}deg`,
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
        <div className="space-y-2.5">
          <BetSelector value={bet} onChange={setBet} disabled={spinning} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={spinning} />
          <GameActionButton
            label={spinning ? "SPINNING WHEEL..." : `SPIN NOW · ${formatCompact(bet)}`}
            onClick={spin}
            disabled={spinning || play.isPending}
            accent="linear-gradient(90deg,#a855f7,#ec4899,#8b5cf6)"
          />
        </div>
      }
    >
      <div className="relative rounded-[24px] border border-fuchsia-500/40 bg-[radial-gradient(circle_at_50%_15%,#3b0764_0%,#130322_55%,#030207_100%)] p-4 font-mono select-none shadow-[0_0_50px_rgba(168,85,247,0.15)]">
        {/* Sci-Fi Grid Overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none rounded-[24px]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.1) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <WinAnimation show={!!result?.won} amount={result?.payout ?? 0} />

        {/* Wheel Arena */}
        <div className="relative mx-auto aspect-square w-full max-w-[270px] my-2">
          {/* Glowing Top Pointer */}
          <div className="absolute left-1/2 -top-2 z-20 -translate-x-1/2 text-3xl filter drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-bounce">
            🔻
          </div>

          {/* Outer Ring Border Glow */}
          <div
            className="h-full w-full rounded-full border-[5px] border-amber-400/80 shadow-[0_0_40px_rgba(168,85,247,0.6),inset_0_0_30px_rgba(234,179,8,0.4)]"
            style={{
              background: gradient,
              transform: `rotate(${angle}deg)`,
              transition: "transform 3.4s cubic-bezier(.15,.9,.2,1)",
            }}
          />

          {/* Center Hub / Logo */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-amber-400/90 bg-black/90 text-center shadow-[0_0_25px_rgba(0,0,0,0.9)] backdrop-blur-md">
              <div>
                <span className="block text-[9px] font-black tracking-widest text-amber-400">JALWA</span>
                <span className="block text-[8px] font-bold text-fuchsia-300">SPIN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Multiplier Segment Badges */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {SEGMENTS.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-black/50 py-1.5 text-center text-[10px] font-black backdrop-blur-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] transition hover:border-fuchsia-400/50"
              style={{ color: s.color }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Result Feedback Banner */}
        {result && (
          <div
            className={`mt-3.5 flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-center text-xs font-black backdrop-blur-xl ${
              result.won
                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                : "border-rose-500/50 bg-rose-950/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
            }`}
          >
            {result.won ? (
              <>
                <Trophy className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>BIG WIN · +{formatCompact(result.payout)} COINS</span>
              </>
            ) : (
              <>
                <Flame className="h-4 w-4 text-rose-400" />
                <span>NO WIN · -{formatCompact(result.bet)} COINS</span>
              </>
            )}
          </div>
        )}

        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}
