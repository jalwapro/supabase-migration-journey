import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveKitRoom, type RemoteVideoTrack, type RemoteAudioTrack, type RemoteUser, type LiveKitStatus, type UseLiveKitRoomArgs } from "@/hooks/useLiveKitRoom";

export function useZegoRoom(args: UseLiveKitRoomArgs) {
  // Keep the original publish intent for the initial LiveKit token. This is
  // critical for the host: the host is already authorized when the room is
  // created, so the initial token must contain canPublish=true. Seat users
  // still get a safe retry path below when their permission changes after
  // connecting.
  const livekit = useLiveKitRoom(args);
  const previousPublishRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (livekit.status !== "connected" || !args.channel || args.uid == null) return;
    if (previousPublishRef.current === null) {
      previousPublishRef.current = args.publish;
      return;
    }
    if (previousPublishRef.current === args.publish) return;
    previousPublishRef.current = args.publish;
    let cancelled = false;

    const sync = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || cancelled) return;
        const response = await fetch("/api/livekit-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ room: args.channel, canPublish: args.publish }),
        });
        const body = await response.json().catch(() => ({})) as { error?: string; canPublish?: boolean };
        if (!response.ok || body.canPublish !== args.publish) {
          throw new Error(body.error ?? "LiveKit permission update failed");
        }
        if (!args.publish || cancelled) return;
        for (let attempt = 0; attempt < 16 && !cancelled; attempt += 1) {
          const result = await livekit.requestMic();
          if (result.ok) return;
          if (attempt < 15) await new Promise<void>((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        if (!cancelled) console.warn("[LiveKit] participant permission sync failed", error);
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [args.channel, args.uid, args.publish, livekit.status, livekit.requestMic]);

  return livekit;
}
export type { RemoteVideoTrack, RemoteAudioTrack, RemoteUser, LiveKitStatus, UseLiveKitRoomArgs };
export type { LiveKitStatus as AgoraStatus, UseLiveKitRoomArgs as UseZegoRoomArgs };
