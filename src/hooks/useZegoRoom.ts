import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveKitRoom, type RemoteVideoTrack, type RemoteAudioTrack, type RemoteUser, type LiveKitStatus, type UseLiveKitRoomArgs } from "@/hooks/useLiveKitRoom";

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function useZegoRoom(args: UseLiveKitRoomArgs) {
  const [canonicalRoomName, setCanonicalRoomName] = useState<string | null>(null);

  // Resolve the database room UUID to the exact rtc_channel before LiveKit
  // creates its Room. The same canonical value is then used by the token API
  // and Room.connect(), so the client cannot join one room while the token
  // grants access to another.
  useEffect(() => {
    const requestedRoom = typeof args.channel === "string" ? args.channel.trim() : "";
    let cancelled = false;

    setCanonicalRoomName(null);
    if (!requestedRoom) return () => { cancelled = true; };

    const loadCanonicalRoom = async () => {
      try {
        const query = isUuid(requestedRoom)
          ? supabase.from("live_rooms").select("rtc_channel,status").eq("id", requestedRoom).maybeSingle()
          : supabase.from("live_rooms").select("rtc_channel,status").eq("rtc_channel", requestedRoom).maybeSingle();
        const { data, error } = await query;
        if (cancelled) return;
        if (error) {
          console.warn("[LiveKit] canonical room lookup failed", error);
          return;
        }
        if (data?.status !== "live") return;
        const rtcChannel = typeof data.rtc_channel === "string" ? data.rtc_channel.trim() : "";
        if (!rtcChannel) return;
        setCanonicalRoomName(rtcChannel);
      } catch (error) {
        if (!cancelled) console.warn("[LiveKit] canonical room lookup failed", error);
      }
    };

    void loadCanonicalRoom();
    return () => { cancelled = true; };
  }, [args.channel]);

  const livekit = useLiveKitRoom({ ...args, channel: canonicalRoomName });
  const previousPublishRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (livekit.status !== "connected" || !canonicalRoomName || args.uid == null) return;
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
          body: JSON.stringify({ room: canonicalRoomName, canPublish: args.publish }),
        });
        const body = await response.json().catch(() => ({})) as { error?: string; canPublish?: boolean };
        if (!response.ok || body.canPublish !== args.publish) {
          throw new Error(body.error ?? "LiveKit permission update failed");
        }
        if (!args.publish || cancelled) return;

        // One clean microphone request only. The LiveKit room hook performs
        // the actual operation with room.localParticipant.setMicrophoneEnabled
        // and no retry/prewarming loop is used here.
        const result = await livekit.requestMic();
        if (!result.ok && !cancelled) {
          console.warn("[LiveKit] microphone enable failed", result.error);
        }
      } catch (error) {
        if (!cancelled) console.warn("[LiveKit] participant permission sync failed", error);
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [canonicalRoomName, args.uid, args.publish, livekit.status, livekit.requestMic]);

  return livekit;
}
export type { RemoteVideoTrack, RemoteAudioTrack, RemoteUser, LiveKitStatus, UseLiveKitRoomArgs };
export type { LiveKitStatus as AgoraStatus, UseLiveKitRoomArgs as UseZegoRoomArgs };
