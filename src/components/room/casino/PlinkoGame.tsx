import { useState } from "react";
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

const ROWS = 8;

/** Plinko — server decides the slot, the client animates the ball into it. */
export function PlinkoGame({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { profile, refresh } = useAuth();
  const cfg = useCasinoGame("plinko");
  const play = useCasinoPlay("plinko", roomId);
  const recent = useCasinoRecent("plinko", open);

  const [bet, setBet] = useState(500);
  const [dropping, setDropping] = useState(false);
  const [ball, setBall] = useState<{ row: number; col: number } | null>(null);
  const [result, setResult] = useState<CasinoResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const balance = Number(profile?.coins ?? 0);
  const multipliers: number[] =
    ((cfg?.config as { multipliers?: number[] } | undefined)?.multipliers as number[] | undefined) ??
    [5, 2, 1.2, 0.5, 0.3, 0.5, 1.2, 2, 5];

  const drop = async () => {
    if (dropping || play.isPending) return;
    haptic();
    setDropping(true);
    setResult(null);
    setBall({ row: 0, col: 0 });
    try {
      const r = await play.mutateAsync({ bet, params: {} });
      const slot = Number(r.bucket ?? Math.floor(multipliers.length / 2));
      // Build a peg path that necessarily terminates at the server's slot.
      const steps: number[] = [];
      let right = slot;
      for (let i = 0; i < ROWS; i++) {
        const remaining = ROWS - i;
        const goRight = right > 0 && (right >= remaining || Math.random() < right / remaining);
        if (goRight) right -= 1;
        steps.push(goRight ? 1 : 0);
      }
      let col = 0;
      steps.forEach((s, i) => {
        window.setTimeout(() => {
          col += s;
          setBall({ row: i + 1, col });
          blip(300 + i * 40, 0.025, "triangle");
        }, 110 * (i + 1));
      });
      window.setTimeout(
        () => {
          setDropping(false);
          setResult(r);
          setHistory((h) => [slot, ...h].slice(0, 12));
          blip(r.won ? 900 : 190, 0.18, r.won ? "sine" : "sawtooth");
          haptic(r.won ? 40 : 15);
          void refresh?.();
        },
        110 * (ROWS + 1),
      );
    } catch (e) {
      setDropping(false);
      setBall(null);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="Plinko"
      icon="🔴"
      accent="#ff4d8f"
      balance={balance}
      footer={
        <div className="space-y-2">
          <ChipRow chips={CASINO_CHIPS} value={bet} onChange={setBet} disabled={dropping} />
          <button
            onClick={drop}
            disabled={dropping || play.isPending}
            className="w-full rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] py-3 text-sm font-black text-white shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition active:scale-[0.98] disabled:opacity-50"
          >
            {dropping ? "Dropping…" : `Drop Ball · ${formatCompact(bet)}`}
          </button>
        </div>
      }
    >
      <div className="relative">
        <WinBurst show={!!result?.won} amount={result?.payout ?? 0} />

        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a0630] to-black p-3">
          <div className="flex flex-col items-center gap-2">
            {Array.from({ length: ROWS }).map((_, row) => (
              <div key={row} className="flex items-center gap-2">
                {Array.from({ length: row + 2 }).map((__, col) => {
                  const here = ball && ball.row === row + 1 && ball.col === col;
                  return (
                    <span
                      key={col}
                      className={`grid h-2.5 w-2.5 place-items-center rounded-full transition-all ${
                        here
                          ? "scale-[2.2] bg-[color:var(--gold)] shadow-[0_0_14px_var(--gold)]"
                          : "bg-white/25"
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-1">
            {multipliers.map((m, i) => {
              const hit = !dropping && result?.bucket === i;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-md border py-1 text-center text-[9px] font-black transition-all ${
                    hit
                      ? "scale-110 border-[color:var(--gold)] bg-[color:var(--gold)] text-black"
                      : m >= 2
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : m >= 1
                          ? "border-white/15 bg-white/5 text-foreground/70"
                          : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {m}x
                </div>
              );
            })}
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
            {result.multiplier}x ·{" "}
            {result.won ? `+${formatCompact(result.payout)}` : `-${formatCompact(result.bet - result.payout)}`}
          </p>
        )}

        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-foreground/50">Last drops</p>
          <div className="flex gap-1 overflow-x-auto">
            {history.length === 0 && <span className="text-[10px] text-foreground/40">No drops yet</span>}
            {history.map((s, i) => (
              <span
                key={i}
                className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-black text-foreground/70"
              >
                {multipliers[s] ?? 1}x
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-foreground/50">Recent winners</p>
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
      </div>
    </CasinoPopupShell>
  );
}
