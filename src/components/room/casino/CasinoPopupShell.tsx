import { type ReactNode } from "react";
import { X, Trophy, History as HistoryIcon } from "lucide-react";
import { formatCompact } from "@/lib/utils";

/**
 * Glass popup shell shared by every casino mini game.
 * Sizing follows the app size guide: 92% width, 78% height, 24px radius,
 * centered, blurred backdrop — the voice room stays visible and audible
 * behind it (nothing here touches the RTC engine).
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
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      <div
        data-jalwa-overlay-content="true"
        role="dialog"
        aria-label={title}
        className="fixed left-1/2 z-50 flex w-[92%] max-w-[480px] -translate-x-1/2 flex-col overflow-hidden border shadow-2xl animate-scale-in"
        style={{
          height: "78%",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
          borderRadius: 24,
          borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
          background:
            "linear-gradient(160deg, color-mix(in oklab, var(--card) 82%, transparent), color-mix(in oklab, #0b0413 88%, transparent))",
          backdropFilter: "blur(22px) saturate(140%)",
          boxShadow: `0 24px 70px -20px color-mix(in oklab, ${accent} 55%, transparent)`,
          willChange: "transform",
        }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-lg"
            style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${accent} 45%, transparent)` }}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black leading-tight">{title}</p>
            <p className="text-[10px] font-bold text-[color:var(--gold)]">
              🪙 {formatCompact(balance)}
            </p>
          </div>
          {headerRight}
          <button
            onClick={onClose}
            aria-label="Close game"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/40 transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>

        {footer && <div className="shrink-0 border-t border-white/10 px-3 py-2.5">{footer}</div>}
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
        active ? "border-[color:var(--gold)] bg-[color:var(--gold)]/20 text-[color:var(--gold)]" : "border-white/15 bg-white/5 text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}

export function WinBurst({ show, amount }: { show: boolean; amount: number }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <div className="animate-scale-in rounded-2xl border border-[color:var(--gold)]/60 bg-black/70 px-5 py-3 text-center shadow-[0_0_40px_-6px_var(--gold)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)]">You win</p>
        <p className="text-2xl font-black text-[color:var(--gold)]">+{formatCompact(amount)}</p>
      </div>
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-lg"
          style={{
            left: `${8 + (i * 6.4) % 84}%`,
            top: "-8%",
            animation: `jalwa-coin-fall ${1 + (i % 5) * 0.22}s linear ${(i % 7) * 0.08}s 1 forwards`,
          }}
        >
          🪙
        </span>
      ))}
      <style>{`@keyframes jalwa-coin-fall{0%{transform:translateY(-10%) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(420px) rotate(340deg);opacity:0}}`}</style>
    </div>
  );
}

export const CasinoIcons = { Trophy, HistoryIcon };
