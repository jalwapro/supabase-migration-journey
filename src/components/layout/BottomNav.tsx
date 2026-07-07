import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Plus, Gamepad2, User } from "lucide-react";
import type { ComponentType } from "react";

type Tab = {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  primary?: boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/rank", label: "Rank", Icon: Trophy },
  { to: "/create-room", label: "Go Live", Icon: Plus, primary: true },
  { to: "/games", label: "Games", Icon: Gamepad2 },
  { to: "/me", label: "Me", Icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
        {TABS.map(({ to, label, Icon, primary }) => {
          const active =
            to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
          if (primary) {
            return (
              <li key={to} className="flex justify-center">
                <Link
                  to={to}
                  aria-label={label}
                  className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)] active:scale-95 transition"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              </li>
            );
          }
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                  active ? "text-[color:var(--primary)]" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
