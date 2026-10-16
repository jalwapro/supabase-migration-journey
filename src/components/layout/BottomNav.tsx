import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Plus, MessageCircle, User, Compass, Radio, Wallet, Gift, Search, Bell, Settings, Users, Sparkles, CircleHelp } from "lucide-react";
import { type ComponentType, type CSSProperties, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_NAVIGATION, loadPublishedNavigation } from "@/lib/app-customization/navigation-runtime";
import type { NavigationItemConfig } from "@/lib/app-customization/navigation-manager";

type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>;

const ICONS: Record<string, IconComponent> = {
  Home, Trophy, Plus, MessageCircle, User, Compass, Radio, Wallet, Gift, Search, Bell, Settings, Users, Sparkles, CircleHelp,
};

function getIcon(name?: string): IconComponent {
  return (name && ICONS[name]) || ICONS.Home;
}

function useUnreadDm() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useQuery({
    queryKey: ["dm", "unread-badge", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return 0;
      const { count, error } = await supabase.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", uid).is("read_at", null);
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
}

/** Production navigation: published App Studio config with the original navigation as a safe fallback. */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: unread = 0 } = useUnreadDm();
  const myRoomQuery = useQuery({
    queryKey: ["my-host-room", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_recoverable_room");
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return (rows[0] ?? null) as { id: string; title: string | null; status: string } | null;
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const myRoom = myRoomQuery.data ?? null;

  const handlePrimaryClick = async (route: string, isRoomAction: boolean) => {
    if (!isRoomAction || !myRoom) {
      navigate({ to: route as never });
      return;
    }
    if (myRoom.status === "host_disconnected") {
      const { error } = await supabase.rpc("reclaim_room", { _room_id: myRoom.id });
      if (error) {
        toast.error("Unable to reopen your room: " + error.message);
        return;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["my-host-room", user?.id] });
    navigate({ to: "/room/$roomId", params: { roomId: myRoom.id } });
  };
  const [tabs, setTabs] = useState<NavigationItemConfig[]>(DEFAULT_NAVIGATION);

  useEffect(() => {
    let cancelled = false;
    void loadPublishedNavigation().then((items) => {
      if (!cancelled) setTabs(items.length ? items : DEFAULT_NAVIGATION);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const reload = () => void loadPublishedNavigation().then((items) => setTabs(items.length ? items : DEFAULT_NAVIGATION));
    window.addEventListener("focus", reload);
    window.addEventListener("jalwa:app-studio-published", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("jalwa:app-studio-published", reload);
    };
  }, []);

  return (
    <nav data-jalwa-global-nav="true" className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95" style={{ paddingBottom: "max(var(--safe-area-inset-bottom, 0px), var(--jalwa-safe-bottom, 0px), env(safe-area-inset-bottom, 0px), 8px)" }} aria-label="Primary">
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
        {tabs.slice(0, 5).map((item) => {
          const to = item.route ?? "/";
          const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
          const primary = item.action?.type === "primary" || item.id === "create-room";
          const isRoomAction = item.id === "create-room" || to === "/create-room";
          const hasOwnedRoom = isRoomAction && !!myRoom;
          const Icon = getIcon(hasOwnedRoom ? "Radio" : active ? (item.activeIcon ?? item.icon) : item.icon);
          const showBadge = to === "/messages" && unread > 0;
          const iconSize = item.iconSize ?? (primary ? 24 : 20);
          const labelSize = item.labelSize ?? 10;

          if (primary) {
            return (
              <li key={item.id} className="flex justify-center">
                <button type="button" onClick={() => void handlePrimaryClick(to, isRoomAction)} aria-label={hasOwnedRoom ? "Open My Voice Room" : item.label || item.id} title={hasOwnedRoom ? "Open My Voice Room" : "Create Voice Room"} className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)] active:scale-95 transition">
                  <Icon style={{ width: iconSize, height: iconSize }} />
                </button>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <Link to={to} className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 font-medium transition-colors" style={{ color: active ? (item.activeColor ?? "var(--primary)") : (item.color ?? "var(--muted-foreground)") }}>
                <span className="relative">
                  <Icon style={{ width: iconSize, height: iconSize }} />
                  {showBadge && <span aria-label={`${unread} unread`} className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-background animate-pulse">{unread > 99 ? "99+" : unread}</span>}
                </span>
                <span style={{ fontSize: labelSize }}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
