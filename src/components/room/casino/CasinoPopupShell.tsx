import { useState, type ReactNode } from "react";
import { X, HelpCircle, History as HistoryIcon } from "lucide-react";
import { formatCompact } from "@/lib/utils";
import { GameBalance } from "./GameBalance";
import { GameHistory } from "./GameHistory";

/**
 * CasinoPopupShell — the single premium popup used by EVERY Jalwa mini game.
 *
 * Sizing follows the Jalwa spec: 92% of the screen width and 78% of the
 * height on mobile (with a ~76px gap above the room footer so mic / chat /
 * gift controls stay reachable), a sensible max-width on tablet/desktop.
 * The voice room stays mounted and visible behind the dark blurred overlay —
 * nothing here navigates or unmounts the room.
 */
export function CasinoPopupShell({
  open,
  onClose,
  title,
  icon,
  balance,
  accent = "var(--primary)",
  gameSlug,
  help,
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
  /** casino_games slug — powers the History popup */
  gameSlug?: string;
  help?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  if (!open) return null;

  return (
    <>
      <div
        data-jalwa-overlay="true"
        className="fixed inset-0 z-[80] animate-fade-in bg-black/65 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        data-jalwa-overlay-content="true"
        className="pointer-events-none fixed inset-0 z-[81] flex items-center justify-center px-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pointer-events-auto flex w-[92vw] max-w-[560px] flex-col overflow-hidden border shadow-2xl md:max-w-[620px]"
          style={{
            height: "min(78vh, 900px)",
            borderRadius: 24,
            borderColor: `color-mix(in oklab, ${accent} 55%, transparent)`,
            background:
              "linear-gradient(160deg, color-mix(in oklab, #1b0b33 94%, transparent), color-mix(in oklab, #05010b 97%, transparent))",
            backdropFilter: "blur(24px) saturate(150%)",
            boxShadow: `0 30px 90px -25px color-mix(in oklab, ${accent} 70%, transparent), inset 0 1px 0 rgba(255,255,255,.08)`,
            animation: "jalwa-pop-in .18s ease-out",
          }}
        >
          {/* ── header ─────────────────────────────────────────────── */}
          <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/25 px-3 py-2.5">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              aria-label="How to play"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-black/40 text-white/70 transition active:scale-95"
            >
              <HelpCircle className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-black tracking-wide sm:text-base">
                <span aria-hidden>{icon}</span>
                <span className="truncate">{title}</span>
              </p>
              <GameBalance balance={balance} compact />
            </div>

            {headerRight}
            {gameSlug && (
              <button
                onClick={() => setHistoryOpen(true)}
                aria-label="History"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-black/40 text-white/70 transition active:scale-95"
              >
                <HistoryIcon className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close game"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* ── content ────────────────────────────────────────────── */}
          <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {helpOpen && help && (
              <div className="mb-3 rounded-2xl border border-white/15 bg-black/50 p-3 text-[11px] leading-relaxed text-white/75">
                {help}
              </div>
            )}
            {children}
          </div>

          {/* ── betting / action controls ──────────────────────────── */}
          {footer && (
            <div
              className="shrink-0 border-t border-white/10 bg-black/30 px-3 py-3"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>

      {gameSlug && (
        <GameHistory open={historyOpen} onClose={() => setHistoryOpen(false)} game={gameSlug} title={title} />
      )}

      <style>{`@keyframes jalwa-pop-in{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
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

export { WinAnimation as WinBurst } from "./WinAnimation";
