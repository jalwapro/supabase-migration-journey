import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pings live_rooms.heartbeat_at every 25s while the tab is visible.
 *
 * Server-side (see 0166_room_grace_period.sql):
 *   - live rooms with no ping >90s → status='host_disconnected', grace 20min.
 *   - host_room_heartbeat resurrects a host_disconnected room to 'live' when
 *     the host returns within the grace window.
 *   - After grace_period_until expires the cron finalizes gifts and ends the room.
 */
export function useRoomHeartbeat(roomId: string | null | undefined, isHost: boolean) {
  useEffect(() => {
    if (!roomId || !isHost) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        await supabase.rpc("host_room_heartbeat", { _room_id: roomId });
      } catch { /* transient — next tick retries */ }
    };
    ping();
    const iv = window.setInterval(ping, 25_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", ping);
    window.addEventListener("focus", ping);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", ping);
      window.removeEventListener("focus", ping);
    };
  }, [roomId, isHost]);
}
