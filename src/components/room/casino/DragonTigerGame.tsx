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

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Dragon vs Tiger — one card each, higher card wins. Server draws both. */
export function DragonTigerGame({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { profile, refresh } = useAuth();
  const cfg = useCasinoGame("dragon_tiger");
  const play = useCasinoPlay("dragon_tiger", roomId);
  const recent = useCasinoRecent("dragon_tiger", open);

  const [bet, setBet] = useState(500);
  const [pick, setPick] = useState<"dragon" | "tiger" | "tie">("dragon");
  const [result, setResult] = useState<CasinoResult | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const balance = Number(profile?.coins ?? 0);
  const rtp = (cfg?.rtp_bp ?? 9700) / 10000;
  const sideOdds = (rtp * 13) / 6;
  const tieOdds = rtp * 13;

  const deal = async () => {
    if (flipping || play.isPending) return;
    haptic();
    setFlipping(true);
    setResult(null);
    try {
      const r = await play.mutateAsync({ bet, params: { pick } });
      blip(520, 0.08);
      window.setTimeout(() => {
        setResult(r);
        setFlipping(false);
        setHistory((h) => [String(r.winner), ...h].slice(0, 14));
        blip(r.won ? 880 : 220, 0.16, r.won ? "sine" : "sawtooth");
        haptic(r.won ? 40 : 15);
        void refresh?.();
      }, 900);
    } catch (e) {
      setFlipping(false);
      toast.error(e instanceof Error ? e.message : "Round failed");
    }
  };

  return (
    <CasinoPopupShell
      open={open}
      onClose={onClose}
      title="Dragon vs Tiger"
      icon="🐉"
      accent="#ff7a3d"
      balance={balance}
      footer={
        <div className="space-y-2">
          <ChipRow chips={CASINO_CHIPS} value={bet} onChange={setBet} disabled={flipping} />
          <button
            onClick={deal}
            disabled={flipping || play.isPending}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-black text-white shadow-[0_10px_30px_-10px_#10b981] transition active:scale-[0.98] disabled:opacity-50"
          >
            {flipping ? "Dealing…" : `Confirm Bet · ${formatCompact(bet)}`}
          </button>
        </div>
      }
    >
      <div className="relative">
        <WinBurst show={!!result?.won} amount={result?.payout ?? 0} />

        {/* Table */}
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b0a2e] to-black p-3">
          <Card side="dragon" rank={result?.dragon_card} flipping={flipping} />
          <div className="grid place-items-center">
            <span className="rounded-full border border-[color:var(--gold)]/60 bg-black px-2 py-1 text-[11px] font-black text-[color:var(--gold)]">
              VS
            </span>
          </div>
          <Card side="tiger" rank={result?.tiger_card} flipping={flipping} />
        </div>

        {/* Picks */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <PickBtn
            label="DRAGON"
            odds={sideOdds}
            color="#4aa3ff"
            active={pick === "dragon"}
            onClick={() => setPick("dragon")}
          />
          <PickBtn
            label="TIE"
            odds={tieOdds}
            color="#39d98a"
            active={pick === "tie"}
            onClick={() => setPick("tie")}
          />
          <PickBtn
            label="TIGER"
            odds={sideOdds}
            color="#ff7a3d"
            active={pick === "tiger"}
            onClick={() => setPick("tiger")}
          />
        </div>

        {result && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs font-black ${
              result.won
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {String(result.winner).toUpperCase()} wins ·{" "}
            {result.won ? `+${formatCompact(result.payout)}` : `-${formatCompact(result.bet)}`}
          </p>
        )}

        {/* History */}
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-foreground/50">History</p>
          <div className="flex gap-1 overflow-x-auto">
            {history.length === 0 && <span className="text-[10px] text-foreground/40">No rounds yet</span>}
            {history.map((h, i) => (
              <span
                key={i}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white ${
                  h === "dragon" ? "bg-[#2563eb]" : h === "tiger" ? "bg-[#ea580c]" : "bg-emerald-600"
                }`}
              >
                {h === "dragon" ? "D" : h === "tiger" ? "T" : "="}
              </span>
            ))}
          </div>
        </div>

        {/* Winners */}
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

function Card({ side, rank, flipping }: { side: "dragon" | "tiger"; rank?: number; flipping: boolean }) {
  const color = side === "dragon" ? "#4aa3ff" : "#ff7a3d";
  return (
    <div className="text-center">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest" style={{ color }}>
        {side}
      </p>
      <div
        className="mx-auto grid h-28 w-20 place-items-center rounded-xl border-2 bg-black/60 text-3xl font-black transition-transform duration-500"
        style={{
          borderColor: color,
          boxShadow: `0 0 26px -8px ${color}`,
          transform: flipping ? "rotateY(180deg)" : "rotateY(0deg)",
          color,
        }}
      >
        {flipping || !rank ? (
          <span className="text-2xl">{side === "dragon" ? "🐉" : "🐅"}</span>
        ) : (
          RANKS[rank - 1]
        )}
      </div>
    </div>
  );
}

function PickBtn({
  label,
  odds,
  color,
  active,
  onClick,
}: {
  label: string;
  odds: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border-2 py-2.5 text-center transition active:scale-95"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.12)",
        background: active ? `color-mix(in oklab, ${color} 20%, transparent)` : "rgba(255,255,255,0.04)",
        boxShadow: active ? `0 0 22px -6px ${color}` : undefined,
      }}
    >
      <p className="text-[11px] font-black" style={{ color: active ? color : undefined }}>
        {label}
      </p>
      <p className="text-[10px] font-bold text-foreground/60">{odds.toFixed(2)}x</p>
    </button>
  );
}
