import { Link } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";

/** Home-page entry point into the Game Center (replaces the Daily Spin bubble). */
export function MiniGamesFloatingButton() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-md justify-end px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}
    >
      <Link
        to="/games"
        aria-label="Mini Games"
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--gold)_60%,transparent)] transition-transform active:scale-95"
      >
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[color:var(--gold)]/25" />
        <span className="relative flex flex-col items-center leading-none">
          <Gamepad2 className="h-5 w-5" />
          <span className="mt-0.5 text-[8px] font-black uppercase tracking-wider">Games</span>
        </span>
      </Link>
    </div>
  );
}
