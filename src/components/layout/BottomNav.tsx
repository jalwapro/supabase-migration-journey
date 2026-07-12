import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Plus, MessageCircle, User } from "lucide-react";
import { useEffect, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Tab = {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  primary?: boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/rank", label: "Rank", Icon: Trophy },
  { to: "/create-room", label: "", Icon: Plus, primary: true },
  { to: "/messages", label: "Chat", Icon: MessageCircle },
  { to: "/me", label: "Me", Icon: User },
];

function useUnreadDm() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["dm", "unread-badge", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return 0;
      // NOTE: no `deleted_at` filter — if the column is missing in some
      // deployments the whole query 400s and the badge silently stays 0.
      const { count, error } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", uid)
        .is("read_at", null);
      if (error) {
        console.warn("[unread-dm] query failed", error);
        return 0;
      }
      return count ?? 0;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  // Realtime: badge should light up the instant a new DM arrives, without
  // waiting for a route change or the 30s poll.
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`dm-badge:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${uid}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["dm", "unread-badge", uid] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [uid, qc]);

  return query;
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: unread = 0 } = useUnreadDm();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95"
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
          const showBadge = to === "/messages" && unread > 0;
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                  active ? "text-[color:var(--primary)]" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span
                      aria-label={`${unread} unread`}
                      className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-background animate-pulse"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
