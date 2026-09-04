import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export type LiveKitVoiceStatus = "idle" | "connecting" | "connected" | "error" | "disabled";

export type LiveKitVoiceRoomOptions = {
  roomId: string | null;
  enabled?: boolean;
  publish?: boolean;
  displayName?: string;
};

export function useLiveKitVoiceRoom({ roomId, enabled = true, publish = false, displayName }: LiveKitVoiceRoomOptions) {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<LiveKitVoiceStatus>(enabled ? "idle" : "disabled");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(!publish);
  const [remoteAudio, setRemoteAudio] = useState<Map<string, HTMLAudioElement>>(new Map());

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    setRemoteAudio((current) => {
      current.forEach((el) => { el.pause(); el.srcObject = null; el.remove(); });
      return new Map();
    });
    setStatus(enabled ? "idle" : "disabled");
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !roomId) {
      void disconnect();
      return;
    }

    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setStatus("connecting");
    setError(null);

    const onSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      document.body.appendChild(el);
      setRemoteAudio((current) => new Map(current).set(`${participant.identity}:${publication.trackSid}`, el));
      void el.play().catch(() => undefined);
    };

    const onUnsubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio) return;
      track.detach().forEach((el) => el.remove());
      const key = `${participant.identity}:${publication.trackSid}`;
      setRemoteAudio((current) => {
        const next = new Map(current);
        const el = next.get(key);
        if (el) { el.pause(); el.srcObject = null; el.remove(); }
        next.delete(key);
        return next;
      });
    };

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus("idle"); });

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Sign in first");
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ room: roomId, name: displayName ?? "Jalwa user", canPublish: publish }),
        });
        const body = await response.json() as { server_url?: string; participant_token?: string; canPublish?: boolean; error?: string };
        if (!response.ok || !body.server_url || !body.participant_token) throw new Error(body.error ?? "LiveKit token request failed");
        if (cancelled) return;
        await room.connect(body.server_url, body.participant_token, { autoSubscribe: true });
        if (cancelled) return;
        setStatus("connected");
        const mayPublish = body.canPublish === true;
        if (mayPublish && publish) {
          await room.localParticipant.setMicrophoneEnabled(true);
          setMuted(false);
        } else {
          setMuted(true);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "LiveKit connection failed");
        await room.disconnect();
      }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      void room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [roomId, enabled, publish, displayName, disconnect]);

  const setMicrophoneEnabled = useCallback(async (enabledMic: boolean) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    await room.localParticipant.setMicrophoneEnabled(enabledMic);
    setMuted(!enabledMic);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    await setMicrophoneEnabled(muted);
  }, [muted, setMicrophoneEnabled]);

  return { room: roomRef.current, status, error, muted, remoteAudio, setMicrophoneEnabled, toggleMicrophone, disconnect };
}
