import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/voice-room-redesign")({
  beforeLoad: async ({ location }) => {
    const params = new URLSearchParams(location.search);
    const requestedRoomId = params.get("roomId");
    if (requestedRoomId) {
      const { data } = await supabase.from("live_rooms").select("id,room_type,status").eq("id", requestedRoomId).maybeSingle();
      if (data?.id && data.room_type === "voice" && data.status === "live") {
        throw redirect({ to: "/room/$roomId", params: { roomId: data.id }, replace: true });
      }
    }

    const { data } = await supabase
      .from("live_rooms")
      .select("id")
      .eq("room_type", "voice")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      throw redirect({ to: "/room/$roomId", params: { roomId: data.id }, replace: true });
    }

    throw redirect({ to: "/", replace: true });
  },
});
