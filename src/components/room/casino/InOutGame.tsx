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

/** In & Out — a ball rolls 1..10, predict whether it lands inside the zone. */
export function InOutGame({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { profile, refresh } = useAuth();
  const cfg = useCasinoGame("in_out");
  const play = useCasinoPlay("in_out", roomId);
  const recent = useCasinoRecent("in_out", open);

  const [bet, setBet] = useState(500);
  const [pick, setPick] = useState<"in" | "out">("in");
  const [rolling, setRolling] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const [result, setResult] = useState<CasinoResult | null>(null);
  const [history, setHistory] = useState<("in" | "out")[]>([]);

  const balance = Number(profile?.coins ?? 0);
  const rtp = (cfg?.rtp_bp ?? 9700) / 10000;
  const inLow = Number((cfg?.config as { in_low?: number } | undefined)?.in_low ?? 4);
  const inHigh = Number((cfg?.config as { in_high?: number } | undefined)?.in_high ?? 7);
  const pIn = (inHigh - inLow + 1) / 10;
  const inOdds = rtp / pIn;
  const outOdds = rtp / (1 - pIn);

  const roll = async () => {
    if (rolling || play.isPending) return;
    haptic();
    setRolling(true);
    setResult(null);
    const spinner = window.setInterval(() => {
      setSpot(1 + Math.floor(Math.random() * 10));
      blip(420 + Math.random() * 200, 0.03, "square");
    }, 90);
    try {
      const r = await play.mutateAsync({ bet, params: { pick } });
      window.setTimeout(() => {
        window.clearInterval(spinner);
        setSpot(r.ball ?? null);
        setResult(r);
        setRolling(false);
        setHistory((h) => [r.winner as "in" | "out", ...h].slice(0, 14));
        blip(r.won ? 920 : 200, 0.18, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 40 : 15);
        void refresh?.();
      }, 1100);
    } catch (e) {
      window.clearInterval(spinner);
      setRolling(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="In & Out"
      icon="🔴"
      accent="#39d98a"
      balance={balance}
      footer={
        <div className="space-y-2">
          <ChipRow chips={CASINO_CHIPS} value={bet} onChange={setBet} disabled={rolling} />
          <button
            onClick={roll}
            disabled={rolling || play.isPending}
            className="w-full rounded-2xl bg-gradient-to-r from-[color:var(--gold)] to-amber-500 py-3 text-sm font-black text-black shadow-[0_10px_30px_-10px_var(--gold)] transition active:scale-[0.98] disabled:opacity-50"
          >
            {rolling ? "Rolling…" : `Roll · ${formatCompact(bet)}`}
          </button>
        </div>
      }
    >
      <div className="relative">
        <WinBurst show={!!result?.won} amount={result?.payout ?? 0} />

        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#07130f] to-black p-3">
          <div className="mb-3 grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const inside = n >= inLow && n <= inHigh;
              const hit = spot === n;
              return (
                <div
                  key={n}
                  className={`grid aspect-square place-items-center rounded-lg border text-[11px] font-black transition-all ${
                    hit
                      ? "scale-110 border-[color:var(--gold)] bg-[color:var(--gold)] text-black shadow-[0_0_18px_var(--gold)]"
                      : inside
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/40 bg-red-500/10 text-red-300"
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
          <p className="text-center text-[10px] font-bold text-foreground/50">
            IN zone {inLow}–{inHigh} · everything else is OUT
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPick("in")}
            className={`rounded-2xl border-2 py-3 transition active:scale-95 ${
              pick === "in"
                ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_22px_-6px_#10b981]"
                : "border-white/12 bg-white/5"
            }`}
          >
            <p className="text-sm font-black text-emerald-300">IN ⬆</p>
            <p className="text-[10px] font-bold text-foreground/60">{inOdds.toFixed(2)}x</p>
          </button>
          <button
            onClick={() => setPick("out")}
            className={`rounded-2xl border-2 py-3 transition active:scale-95 ${
              pick === "out"
                ? "border-red-400 bg-red-500/20 shadow-[0_0_22px_-6px_#ef4444]"
                : "border-white/12 bg-white/5"
            }`}
          >
            <p className="text-sm font-black text-red-300">OUT ↗</p>
            <p className="text-[10px] font-bold text-foreground/60">{outOdds.toFixed(2)}x</p>
          </button>
        </div>

        {result && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs font-black ${
              result.won
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            Ball {result.ball} → {String(result.winner).toUpperCase()} ·{" "}
            {result.won ? `+${formatCompact(result.payout)}` : `-${formatCompact(result.bet)}`}
          </p>
        )}

        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-foreground/50">Last results</p>
          <div className="flex gap-1 overflow-x-auto">
            {history.length === 0 && <span className="text-[10px] text-foreground/40">No rounds yet</span>}
            {history.map((h, i) => (
              <span
                key={i}
                className={`grid h-6 w-8 shrink-0 place-items-center rounded-full text-[9px] font-black text-white ${
                  h === "in" ? "bg-emerald-600" : "bg-red-600"
                }`}
              >
                {h.toUpperCase()}
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
