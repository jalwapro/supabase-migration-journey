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
// The RTC implementation is entirely LiveKit; this wrapper adds the
// server-side permission transition needed when a listener takes/releases
// an active seat without reconnecting the WebRTC room.
export function useZegoRoom(args: UseLiveKitRoomArgs) {
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

        if (args.publish && !cancelled) {
          const result = await livekit.requestMic();
          if (!result.ok) throw new Error(result.error ?? "Microphone could not be enabled");
        }
      } catch (error) {
        if (!cancelled) console.warn("[LiveKit] dynamic participant permission sync failed", error);
      }
    };

    void sync();
    return () => { cancelled = true; };
  }, [args.channel, args.uid, args.publish, livekit.status, livekit.requestMic]);

  return livekit;
}

export type { RemoteVideoTrack, RemoteAudioTrack, RemoteUser, LiveKitStatus, UseLiveKitRoomArgs };
export type { LiveKitStatus as AgoraStatus, UseLiveKitRoomArgs as UseZegoRoomArgs };
