import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatCompact } from "@/lib/utils";
import { blip, haptic, useCasinoPlay, type CasinoResult } from "@/lib/casino";
import { CasinoPopupShell } from "../CasinoPopupShell";
import { WinAnimation } from "../WinAnimation";
import { BetControls, BetSelector, GameActionButton } from "../BetControls";
import { InsufficientCoins } from "../GameBalance";

type Res = CasinoResult & { symbol?: string };

/** Canvas scratch-off over the server-decided prize. */
export function ScratchCard({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
  const { profile, refresh } = useAuth();
  const play = useCasinoPlay("scratch_card", roomId);
  const [bet, setBet] = useState(500);
  const [result, setResult] = useState<Res | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [poor, setPoor] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const balance = Number(profile?.coins ?? 0);

  const paintCover = (c: HTMLCanvasElement | null) => {
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#b08d2f");
    g.addColorStop(0.5, "#f3d27a");
    g.addColorStop(1, "#9a7420");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH HERE", c.width / 2, c.height / 2 + 8);
  };

  const buy = async () => {
    if (play.isPending) return;
    if (balance < bet) return setPoor(true);
    haptic();
    setRevealed(false);
    setResult(null);
    try {
      const r = (await play.mutateAsync({ bet, params: {} })) as Res;
      setResult(r);
      window.setTimeout(() => paintCover(canvasRef.current), 20);
      void refresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c || !result || revealed) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    blip(700 + Math.random() * 200, 0.012, "square");

    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < data.length; i += 40) if (data[i] === 0) clear++;
    if (clear / (data.length / 40) > 0.45) {
      setRevealed(true);
      blip(result.won ? 980 : 150, 0.2, result.won ? "sine" : "sawtooth");
      haptic(result.won ? 45 : 15);
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="LUCKY SCRATCH"
      icon="🎫"
      accent="var(--gold)"
      balance={balance}
      gameSlug="scratch_card"
      help="Buy a card, then scratch it with your finger to reveal the prize the server already sealed inside."
      footer={
        <div className="space-y-2">
          <BetSelector value={bet} onChange={setBet} disabled={!!result && !revealed} />
          <BetControls value={bet} onChange={setBet} balance={balance} disabled={!!result && !revealed} />
          <GameActionButton
            label={!result ? `BUY CARD · ${formatCompact(bet)}` : revealed ? "PLAY AGAIN" : "SCRATCH THE CARD"}
            onClick={buy}
            disabled={play.isPending || (!!result && !revealed)}
            accent="linear-gradient(90deg,#f59e0b,#fbbf24,#d97706)"
          />
        </div>
      }
    >
      <div className="relative rounded-[22px] border border-[color:var(--gold)]/45 bg-[radial-gradient(circle_at_50%_15%,#3c2a05_0%,#170b22_55%,#04030a_100%)] p-4">
        <WinAnimation show={!!result?.won && revealed} amount={result?.payout ?? 0} />

        <p className="text-center text-[11px] font-black tracking-[0.4em] text-[color:var(--gold)]">JALWA</p>
        <p className="text-center text-2xl font-black text-white">LUCKY SCRATCH</p>

        <div className="relative mx-auto mt-4 aspect-[4/3] w-full max-w-[320px] overflow-hidden rounded-2xl border-2 border-[color:var(--gold)]/60 bg-black/70">
          <div className="absolute inset-0 grid place-items-center text-center">
            {result ? (
              <div>
                <p className="text-5xl">{result.symbol ?? "🎁"}</p>
                <p className={`mt-1 text-xl font-black ${result.won ? "text-emerald-300" : "text-red-300"}`}>
                  {result.won ? `WIN 🪙 ${formatCompact(result.payout)}` : "NO LUCK"}
                </p>
              </div>
            ) : (
              <p className="text-xs text-white/40">Buy a card to play</p>
            )}
          </div>
          {result && !revealed && (
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              onPointerDown={scratch}
              onPointerMove={(e) => e.buttons === 1 && scratch(e)}
              className="absolute inset-0 h-full w-full touch-none"
            />
          )}
        </div>

        <InsufficientCoins open={poor} needed={bet} onClose={() => setPoor(false)} />
      </div>
    </CasinoPopupShell>
  );
}
