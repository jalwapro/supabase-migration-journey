import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LAUNCH_FEATURES } from "@/config/launchFeatures";

/**
 * Current-launch safety gate. Video and PK implementations stay in the
 * repository, but normal users cannot enter them while their launch flags
 * are disabled. Voice rooms remain the default live-room experience.
 */
export function LaunchRouteGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const pathname = location.pathname;

    if (pathname.startsWith("/pk") && !LAUNCH_FEATURES.pkBattle) {
      void navigate({ to: "/", replace: true });
      return () => {
        cancelled = true;
      };
    }

    const match = pathname.match(/^\/room\/([^/]+)$/);
    if (!match || LAUNCH_FEATURES.videoRooms) {
      return () => {
        cancelled = true;
      };
    }

    const roomId = match[1];
    void (async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("room_type,pk_battle")
        .eq("id", roomId)
        .maybeSingle();

      if (cancelled || !data) return;
      if (data.room_type === "video" || (data.pk_battle && !LAUNCH_FEATURES.pkBattle)) {
        void navigate({ to: "/", replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  return null;
}
