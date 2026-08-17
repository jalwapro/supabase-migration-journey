import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";

/** 24/7 Support floating button, similar to MiniGamesFloatingButton. */
export function SupportFloatingButton() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[9999] mx-auto flex max-w-md justify-start px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}
    >
      <Link
        to="/support-room"
        aria-label="24/7 Support"
        className="pointer-events-auto relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-[color:var(--primary)] bg-black/60 text-[color:var(--primary)] shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] backdrop-blur-xl transition-transform active:scale-95"
      >
        <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-[color:var(--primary)]/20" />
        <LifeBuoy className="relative h-6 w-6 animate-spin-slow" />
        <span className="relative mt-1 text-[9px] font-black uppercase tracking-tighter">Support</span>
      </Link>
    </div>
  );
}
