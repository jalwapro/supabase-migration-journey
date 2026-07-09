import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Wallet as WalletIcon, Bell } from "lucide-react";
import { formatCompact } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/useNotifications";


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
  const { profile, isAdmin, user } = useAuth();
  const unread = useUnreadCount();
  const unreadCount = user ? (unread.data ?? 0) : 0;


  return (
    <div className="min-h-[100dvh] pb-24">
      {showHeader && (
        <header
          className="sticky top-0 z-30 border-b border-border bg-background/95"
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
              {user && (
                <Link
                  to="/notifications"
                  aria-label="Notifications"
                  className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card/60"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[color:var(--primary)] px-1 text-[9px] font-bold text-primary-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              )}

              {profile && (
                <Link
                  to="/wallet"
                  className="flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold"
                >
                  <WalletIcon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                  <span title={profile.coins.toLocaleString()}>{formatCompact(profile.coins)}</span>
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
