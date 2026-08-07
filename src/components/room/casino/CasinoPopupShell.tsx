import { type ReactNode } from "react";
import { X, Trophy, History as HistoryIcon } from "lucide-react";
import { formatCompact } from "@/lib/utils";

/**
 * Shared premium Jalwa casino popup.
 * Wide on desktop, responsive on mobile, with the voice room visible behind it.
 * RTC/audio is untouched by this component.
 */
export function CasinoPopupShell({
  open,
  onClose,
  title,
  icon,
  balance,
  accent = "var(--primary)",
  headerRight,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: ReactNode;
  balance: number;
  accent?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <div
        data-jalwa-overlay="true"
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        data-jalwa-overlay-content="true"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-1/2 top-1/2 z-[81] flex w-[calc(100vw-20px)] max-w-[1180px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border shadow-2xl"
        style={{
          height: "min(90vh, 900px)",
          borderRadius: 28,
          borderColor: `color-mix(in oklab, ${accent} 55%, transparent)`,
          background:
            "linear-gradient(145deg, color-mix(in oklab, #170b2b 94%, transparent), color-mix(in oklab, #030107 97%, transparent))",
          backdropFilter: "blur(24px) saturate(145%)",
          boxShadow: `0 30px 100px -25px color-mix(in oklab, ${accent} 65%, transparent), inset 0 1px 0 rgba(255,255,255,.08)`,
        }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-3 sm:px-5">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl"
            style={{
              background: `color-mix(in oklab, ${accent} 18%, transparent)`,
              border: `1px solid color-mix(in oklab, ${accent} 55%, transparent)`,
              boxShadow: `0 0 24px -8px ${accent}`,
            }}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black sm:text-lg">{title}</p>
            <p className="text-[11px] font-bold text-[color:var(--gold)] sm:text-xs">
              🪙 {formatCompact(balance)}
            </p>
          </div>
          {headerRight}
          <button
            onClick={onClose}
            aria-label="Close game"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-white/10 bg-black/20 px-3 py-3 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

export function ChipRow({
  chips,
  value,
  onChange,
  disabled,
}: {
  chips: number[];
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-[11px] font-black transition active:scale-95 disabled:opacity-40 ${
              active
                ? "border-[color:var(--gold)] bg-[color:var(--gold)]/25 text-[color:var(--gold)] shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--gold)_70%,transparent)]"
                : "border-white/15 bg-white/5 text-foreground/70"
            }`}
          >
            {formatCompact(c)}
          </button>
        );
      })}
    </div>
  );
}

export function TabBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[10px] font-black transition ${
        active
          ? "border-[color:var(--gold)] bg-[color:var(--gold)]/20 text-[color:var(--gold)]"
          : "border-white/15 bg-white/5 text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}

export function WinBurst({ show, amount }: { show: boolean; amount: number }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden">
      <div className="animate-scale-in rounded-2xl border border-[color:var(--gold)]/60 bg-black/80 px-6 py-4 text-center shadow-[0_0_50px_-6px_var(--gold)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)]">You win</p>
        <p className="text-3xl font-black text-[color:var(--gold)]">+{formatCompact(amount)}</p>
      </div>
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-lg"
          style={{
            left: `${5 + (i * 5.4) % 90}%`,
            top: "-8%",
            animation: `jalwa-coin-fall ${1 + (i % 5) * 0.22}s linear ${(i % 7) * 0.08}s 1 forwards`,
          }}
        >
          🪙
        </span>
      ))}
      <style>{`@keyframes jalwa-coin-fall{0%{transform:translateY(-10%) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(620px) rotate(340deg);opacity:0}}`}</style>
    </div>
  );
}

export const CasinoIcons = { Trophy, HistoryIcon };
