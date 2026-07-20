import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marks the signed-in user as "online" every 30 s while the tab is visible.
 * Consumers query user_presence.last_seen_at > now() - 2 min.
 */
export function usePresenceHeartbeat(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try { await supabase.rpc("touch_presence"); } catch { /* ignore */ }
    };
    ping();
    const iv = window.setInterval(ping, 30_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", ping);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", ping);
    };
  }, [userId]);
}
