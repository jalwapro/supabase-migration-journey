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
          // LiveKit's server-side participant permission update is applied
          // asynchronously. A single immediate publish attempt can therefore
          // race the permission propagation and leave the seat mic disabled.
          // Retry the local publication briefly until the updated permission
          // is visible to the LiveKit participant. This is automatic: the user
          // never needs to tap the mic a second time.
          let lastError = "Microphone could not be enabled";
          for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
            const result = await livekit.requestMic();
            if (result.ok) return;
            lastError = result.error ?? lastError;
            if (attempt < 5) {
              await new Promise<void>((resolve) => setTimeout(resolve, 200));
            }
          }
          if (!cancelled) throw new Error(lastError);
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
