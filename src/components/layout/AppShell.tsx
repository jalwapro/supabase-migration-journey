import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Wallet as WalletIcon } from "lucide-react";

export function AppShell({
  title,
  subtitle,
  right,
  children,
  showHeader = true,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  showHeader?: boolean;
}) {
  const { profile, isAdmin } = useAuth();

  return (
    <div className="min-h-[100dvh] pb-24">
      {showHeader && (
        <header
          className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-gradient">
                {title ?? "Jalwa"}
              </h1>
              {subtitle && (
                <p className="truncate text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {right}
              {profile && (
                <Link
                  to="/wallet"
                  className="flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold"
                >
                  <WalletIcon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                  <span>{profile.coins.toLocaleString()}</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  aria-label="Admin"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </header>
      )}
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
