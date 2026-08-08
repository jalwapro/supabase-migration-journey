import { formatCompact } from "@/lib/utils";
import { CASINO_CHIPS, haptic } from "@/lib/casino";

const STEPS = [100, 500, 1000, 5000, 10000, 50000];

/** Quick chip picker (100 / 500 / 1k / 5k / 10k / 50k). */
export function BetSelector({
  value,
  onChange,
  disabled,
  chips = STEPS,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  chips?: number[];
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            disabled={disabled}
            onClick={() => {
              haptic();
              onChange(c);
            }}
            className={`h-11 min-w-11 shrink-0 rounded-full border-2 px-3 text-[11px] font-black transition active:scale-95 disabled:opacity-40 ${
              active
                ? "border-[color:var(--gold)] bg-[color:var(--gold)]/25 text-[color:var(--gold)] shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--gold)_70%,transparent)]"
                : "border-white/15 bg-white/5 text-white/70"
            }`}
          >
            {formatCompact(c)}
          </button>
        );
      })}
    </div>
  );
}

/** BET − / amount / BET + / MAX BET, clamped to the player's balance. */
export function BetControls({
  value,
  onChange,
  balance,
  min = 10,
  max = 50000,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  balance: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const cap = Math.max(min, Math.min(max, balance || min));
  const clamp = (v: number) => Math.max(min, Math.min(cap, v));
  const step = (dir: 1 | -1) => {
    haptic();
    const idx = STEPS.findIndex((s) => s >= value);
    const next =
      dir === 1
        ? STEPS.find((s) => s > value) ?? clamp(value * 2)
        : [...STEPS].reverse().find((s) => s < value) ?? min;
    onChange(clamp(idx === -1 && dir === -1 ? value / 2 : next));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={disabled}
        onClick={() => step(-1)}
        aria-label="Decrease bet"
        className="h-11 w-11 shrink-0 rounded-xl border border-white/15 bg-white/5 text-lg font-black text-white active:scale-95 disabled:opacity-40"
      >
        −
      </button>
      <div className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 bg-black/50">
        <span className="truncate text-sm font-black text-[color:var(--gold)]">🪙 {formatCompact(value)}</span>
      </div>
      <button
        disabled={disabled}
        onClick={() => step(1)}
        aria-label="Increase bet"
        className="h-11 w-11 shrink-0 rounded-xl border border-white/15 bg-white/5 text-lg font-black text-white active:scale-95 disabled:opacity-40"
      >
        +
      </button>
      <button
        disabled={disabled}
        onClick={() => {
          haptic();
          onChange(cap);
        }}
        className="h-11 shrink-0 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/15 px-3 text-[10px] font-black uppercase tracking-wider text-[color:var(--gold)] active:scale-95 disabled:opacity-40"
      >
        Max
      </button>
    </div>
  );
}

/** Primary play/spin/deal button shared by every game. */
export function GameActionButton({
  label,
  onClick,
  disabled,
  accent = "linear-gradient(90deg,#22c55e,#84cc16,#16a34a)",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-13 w-full rounded-2xl py-3 text-base font-black text-white shadow-[0_10px_35px_-12px_rgba(255,255,255,.5)] transition active:scale-[.97] disabled:opacity-50"
      style={{ background: accent }}
    >
      {label}
    </button>
  );
}

export { CASINO_CHIPS };
