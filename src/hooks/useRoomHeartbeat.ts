import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pings live_rooms.heartbeat_at every 25 s while the tab is visible.
 * A server-side cron (close_stale_rooms) ends rooms whose heartbeat
 * hasn't landed in 90 s — so short network drops are tolerated but a
 * crashed / closed tab won't leave the room "live" forever.
 */
export function useRoomHeartbeat(roomId: string | null | undefined, isHost: boolean) {
  useEffect(() => {
    if (!roomId || !isHost) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        await supabase.rpc("room_heartbeat", { _room_id: roomId });
      } catch { /* transient — next tick retries */ }
    };
    ping();
    const iv = window.setInterval(ping, 25_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", ping);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", ping);
    };
  }, [roomId, isHost]);
}
