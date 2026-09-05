import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useLiveKitRoom,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
  type RemoteUser,
  type LiveKitStatus,
  type UseLiveKitRoomArgs,
} from "@/hooks/useLiveKitRoom";

// Backward-compatible module name for existing room UI imports.
// The RTC implementation is entirely LiveKit. This wrapper owns the
// server-side permission transition when a listener takes/releases a seat.
export function useZegoRoom(args: UseLiveKitRoomArgs) {
  // IMPORTANT: do not let useLiveKitRoom publish immediately when a seat is
  // acquired. The database seat update and LiveKit participant permission
  // update are asynchronous. Passing publish=false keeps the local media
  // layer quiet until /api/livekit-permissions has actually granted publish.
  // This removes the "first mic tap fails, second tap works" race.
  const livekit = useLiveKitRoom({ ...args, publish: false });
  const previousPublishRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (livekit.status !== "connected" || !args.channel || args.uid == null) return;
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ room: args.channel, canPublish: args.publish }),
        });
        const body = await response.json().catch(() => ({})) as { error?: string; canPublish?: boolean };
        if (!response.ok || body.canPublish !== args.publish) {
          throw new Error(body.error ?? "LiveKit permission update failed");
        }

        if (!args.publish || cancelled) return;

        // LiveKit applies updateParticipant asynchronously. Keep trying the
        // local publication for a few seconds so a seat never requires a
        // second manual mic tap. Browser permission is requested by the first
        // successful attempt and is not repeatedly requested by LiveKit.
        let lastError = "Microphone could not be enabled";
        for (let attempt = 0; attempt < 16 && !cancelled; attempt += 1) {
          const result = await livekit.requestMic();
          if (result.ok) return;
          lastError = result.error ?? lastError;
          if (attempt < 15) {
            await new Promise<void>((resolve) => setTimeout(resolve, 200));
          }
        }
        if (!cancelled) throw new Error(lastError);
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
