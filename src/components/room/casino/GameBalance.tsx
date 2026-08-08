import { formatCompact } from "@/lib/utils";

/**
 * GameBalance — reads the balance passed down from the app's existing
 * wallet (profiles.coins via useAuth). There is no second wallet system.
 */
export function GameBalance({
  balance,
  label = "Balance",
  compact,
}: {
  balance: number;
  label?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className="text-[11px] font-black text-[color:var(--gold)]">
        🪙 {formatCompact(balance)}
      </span>
    );
  }
  return (
    <div className="rounded-xl border border-[color:var(--gold)]/40 bg-black/45 px-3 py-1.5 text-center">
      <p className="text-[9px] font-black uppercase tracking-widest text-[color:var(--gold)]/80">{label}</p>
      <p className="text-sm font-black text-white">🪙 {formatCompact(balance)}</p>
    </div>
  );
}

/** Premium "not enough coins" prompt shared by all games. */
export function InsufficientCoins({
  open,
  needed,
  onClose,
  onRecharge,
}: {
  open: boolean;
  needed: number;
  onClose: () => void;
  onRecharge?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[300px] animate-scale-in rounded-3xl border border-[color:var(--gold)]/50 bg-[#140725] p-5 text-center shadow-[0_0_60px_-12px_var(--gold)]">
        <p className="text-3xl">🪙</p>
        <p className="mt-2 text-base font-black text-white">Insufficient Coins</p>
        <p className="mt-1 text-[11px] text-white/60">
          You need {formatCompact(needed)} coins for this bet.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-white/15 bg-white/5 text-xs font-black text-white/80 active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onRecharge ?? onClose}
            className="h-11 rounded-xl bg-gradient-to-r from-[color:var(--gold)] to-amber-500 text-xs font-black text-black active:scale-95"
          >
            Recharge
          </button>
        </div>
      </div>
    </div>
  );
}
