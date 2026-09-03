import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type RemoteAudioTrack as LKRemoteAudioTrack,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export type RemoteAudioTrack = {
  setVolume: (v: number) => void;
  play: () => void;
  stop: () => void;
};

export type RemoteVideoTrack = {
  play: (container: HTMLElement, opts?: { fit?: "cover" | "contain" }) => void;
  stop: () => void;
};

export type RemoteUser = {
  uid: number;
  hasAudio: boolean;
  hasVideo: boolean;
  audioTrack?: RemoteAudioTrack;
  videoTrack?: RemoteVideoTrack;
};

export type LiveKitStatus = "idle" | "connecting" | "connected" | "error" | "disabled";

export type UseLiveKitRoomArgs = {
  channel: string | null;
  uid: number | null;
  publish: boolean;
  video: boolean;
  enabled: boolean;
  kind?: "voice" | "video" | "pk";
};

function uidFromIdentity(identity: string) {
  let h = 0;
  for (let i = 0; i < identity.length; i++) h = ((h << 5) - h + identity.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 1;
}

async function fetchToken(channel: string, publish: boolean, name?: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in first");

  const res = await fetch("/api/livekit-token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ channel, publish, name }),
  });
  const body = (await res.json()) as { error?: string; token?: string; url?: string; canPublish?: boolean };
  if (!res.ok || !body.token || !body.url) throw new Error(body.error ?? "LiveKit token failed");
  return body;
}

function remoteAudioFacade(track: LKRemoteAudioTrack): RemoteAudioTrack {
  let volume = 1;
  return {
    setVolume(v) {
      volume = Math.max(0, Math.min(100, v)) / 100;
      track.setVolume(volume);
    },
    play() {
      track.setVolume(volume);
      const elements = track.attach();
      for (const el of elements) {
        el.autoplay = true;
        el.muted = false;
        void el.play().catch(() => { /* playback can require a user gesture */ });
      }
    },
    stop() {
      track.detach();
    },
  };
}

export function useLiveKitRoom({ channel, uid, publish, video: _video, enabled, kind: _kind }: UseLiveKitRoomArgs) {
  const roomRef = useRef<Room | null>(null);
  const localAudioTrack = useRef<LocalAudioTrack | null>(null);
  const localAudioPublished = useRef(false);
  const speakerMutedRef = useRef(false);
  const audioElementsRef = useRef<Set<HTMLMediaElement>>(new Set());

  const [status, setStatus] = useState<LiveKitStatus>("idle");
  const statusRef = useRef(status);
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(true);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [videoOn] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speakingUids, setSpeakingUids] = useState<Set<number>>(new Set());
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicTrackRef = useRef<LocalAudioTrack | null>(null);

  useEffect(() => { statusRef.current = status; }, [status]);

  const attachRemoteAudio = useCallback((track: LKRemoteAudioTrack) => {
    track.setVolume(1);
    const elements = track.attach();
    console.info("[LiveKit] attaching remote audio", { trackSid: track.sid, elements: elements.length });
    for (const el of elements) {
      el.autoplay = true;
      el.muted = speakerMutedRef.current;
      el.setAttribute("playsinline", "true");
      audioElementsRef.current.add(el);
      void el.play().then(() => {
        console.info("[LiveKit] remote audio playback started", track.sid);
      }).catch((err) => {
        console.warn("[LiveKit] remote audio playback blocked", err);
      });
    }
  }, []);

  const rebuildRemotes = useCallback((room: Room) => {
    const next = new Map<number, RemoteUser>();
    for (const participant of room.remoteParticipants.values()) {
      const numericUid = uidFromIdentity(participant.identity);
      const audioPub = Array.from(participant.audioTrackPublications.values()).find((p) => p.kind === Track.Kind.Audio);
      const videoPub = Array.from(participant.videoTrackPublications.values()).find((p) => p.kind === Track.Kind.Video);
      const audio = audioPub?.track?.kind === Track.Kind.Audio
        ? remoteAudioFacade(audioPub.track as LKRemoteAudioTrack)
        : undefined;
      next.set(numericUid, {
        uid: numericUid,
        hasAudio: !!audioPub,
        hasVideo: !!videoPub,
        audioTrack: audio,
        videoTrack: undefined,
      });
    }
    setRemotes(next);
  }, []);

  const cleanup = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    localAudioPublished.current = false;
    try { await room?.disconnect(); } catch { /* ignore */ }
    try { localAudioTrack.current?.stop(); } catch { /* ignore */ }
    localAudioTrack.current = null;
    try { musicTrackRef.current?.stop(); } catch { /* ignore */ }
    musicTrackRef.current = null;
    if (musicAudioRef.current) {
      try { musicAudioRef.current.pause(); musicAudioRef.current.src = ""; musicAudioRef.current.remove(); } catch { /* ignore */ }
      musicAudioRef.current = null;
    }
    for (const el of audioElementsRef.current) {
      try { el.remove(); } catch { /* ignore */ }
    }
    audioElementsRef.current.clear();
    setMusicPlaying(false);
    setMusicTitle(null);
    setRemotes(new Map());
    setSpeakingUids(new Set());
    setMuted(true);
  }, []);

  useEffect(() => {
    if (!enabled || !channel || uid == null) {
      void cleanup();
      setStatus("idle");
      setError(null);
      return;
    }

    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: false, autoSubscribe: true });
    roomRef.current = room;
    setStatus("connecting");
    setError(null);
    setMicBlocked(false);
    setMicError(null);

    const onParticipantChanged = () => rebuildRemotes(room);

    const onTrackPublished = (publication: any, participant: any) => {
      if (publication?.kind !== Track.Kind.Audio) return;
      console.info("[LiveKit] remote audio published", {
        participant: participant?.identity,
        sid: publication?.trackSid,
        subscribed: publication?.isSubscribed,
        hasTrack: !!publication?.track,
      });
      if (!publication.isSubscribed) publication.setSubscribed(true);
      rebuildRemotes(room);
    };

    const onTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (cancelled) return;
      if (track?.kind !== Track.Kind.Audio) return;
      console.info("[LiveKit] remote audio subscribed", {
        participant: participant?.identity,
        sid: publication?.trackSid,
        subscribed: publication?.isSubscribed,
      });
      attachRemoteAudio(track as LKRemoteAudioTrack);
      rebuildRemotes(room);
    };

    const onTrackSubscriptionFailed = (trackSid: string, participant: any) => {
      console.error("[LiveKit] remote audio subscription failed", {
        trackSid,
        participant: participant?.identity,
      });
      rebuildRemotes(room);
    };

    const onTrackSubscriptionStatusChanged = (publication: any, subscriptionStatus: any, participant: any) => {
      if (publication?.kind !== Track.Kind.Audio) return;
      console.info("[LiveKit] audio subscription status", {
        participant: participant?.identity,
        sid: publication?.trackSid,
        status: subscriptionStatus,
        subscribed: publication?.isSubscribed,
      });
      if (!publication.isSubscribed) publication.setSubscribed(true);
    };

    const onTrackUnsubscribed = (track: any) => {
      try {
        const mediaTrack = track as LKRemoteAudioTrack;
        const elements = mediaTrack.detach();
        for (const el of elements) audioElementsRef.current.delete(el);
      } catch { /* ignore */ }
      rebuildRemotes(room);
    };

    const onLocalTrackPublished = (publication: any) => {
      if (publication?.kind !== Track.Kind.Audio) return;
      console.info("[LiveKit] local audio published", {
        sid: publication?.trackSid,
        source: publication?.source,
        muted: publication?.isMuted,
      });
    };

    const onLocalTrackSubscribed = (track: any, publication: any) => {
      if (publication?.kind === Track.Kind.Audio) {
        console.info("[LiveKit] another participant subscribed to my audio", publication?.trackSid, track?.sid);
      }
    };

    const onActiveSpeakers = (participants: Array<{ identity: string }>) => {
      setSpeakingUids(new Set(participants.map((p) => uidFromIdentity(p.identity))));
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantChanged);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChanged);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed as never);
    room.on(RoomEvent.TrackSubscriptionStatusChanged, onTrackSubscriptionStatusChanged as never);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed as never);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished as never);
    room.on(RoomEvent.LocalTrackSubscribed, onLocalTrackSubscribed as never);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers as never);

    (async () => {
      try {
        const token = await fetchToken(channel, publish);
        if (cancelled) return;
        console.info("[LiveKit] token received", { channel, canPublish: token.canPublish });
        await room.connect(token.url!, token.token!);
        if (cancelled) return;
        setStatus("connected");

        // Verify and force-subscribe any audio publication that already exists.
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.audioTrackPublications.values()) {
            console.info("[LiveKit] existing remote audio publication", {
              participant: participant.identity,
              sid: publication.trackSid,
              subscribed: publication.isSubscribed,
              hasTrack: !!publication.track,
            });
            if (!publication.isSubscribed) publication.setSubscribed(true);
            if (publication.track?.kind === Track.Kind.Audio) {
              attachRemoteAudio(publication.track as LKRemoteAudioTrack);
            }
          }
        }
        rebuildRemotes(room);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setStatus(message.toLowerCase().includes("not configured") ? "disabled" : "error");
      }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.ParticipantConnected, onParticipantChanged);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantChanged);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed as never);
      room.off(RoomEvent.TrackSubscriptionStatusChanged, onTrackSubscriptionStatusChanged as never);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed as never);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished as never);
      room.off(RoomEvent.LocalTrackSubscribed, onLocalTrackSubscribed as never);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers as never);
      void cleanup();
    };
  }, [enabled, channel, uid, publish, cleanup, rebuildRemotes, attachRemoteAudio]);

  const requestMic = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const room = roomRef.current;
    if (!room || statusRef.current !== "connected") {
      const message = "Room connection not ready yet. Please try again in a moment.";
      setMicError(message);
      return { ok: false, error: message };
    }
    try {
      await room.startAudio();

      // Use LiveKit's microphone API so the publication is a real microphone
      // track and LocalParticipant.isMicrophoneEnabled stays in sync with UI.
      const publication = await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      if (publication?.track) localAudioTrack.current = publication.track as LocalAudioTrack;
      localAudioPublished.current = !!publication;
      setMuted(false);
      setMicBlocked(false);
      setMicError(null);

      console.info("[LiveKit] microphone enabled", {
        published: !!publication,
        sid: publication?.trackSid,
        canPublish: room.localParticipant.permissions?.canPublish,
      });

      // If remote publications existed before the mic button was pressed,
      // make sure they are subscribed and attached now that audio is unlocked.
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (!publication.isSubscribed) publication.setSubscribed(true);
          if (publication.track?.kind === Track.Kind.Audio) {
            attachRemoteAudio(publication.track as LKRemoteAudioTrack);
          }
        }
      }
      return { ok: true };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      const blocked = err.name === "NotAllowedError" || err.name === "SecurityError";
      const message = blocked ? "Microphone permission denied. Allow microphone access and try again." : (err.message || "Could not publish microphone.");
      setMicBlocked(blocked);
      setMicError(message);
      return { ok: false, error: message };
    }
  }, [attachRemoteAudio]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (room.localParticipant.isMicrophoneEnabled) {
      await room.localParticipant.setMicrophoneEnabled(false);
      setMuted(true);
      return;
    }
    await requestMic();
  }, [requestMic]);

  const toggleSpeaker = useCallback(() => {
    const next = !speakerMutedRef.current;
    speakerMutedRef.current = next;
    setSpeakerMuted(next);
    for (const el of audioElementsRef.current) el.muted = next;
  }, []);

  const toggleVideo = useCallback(async () => {
    return { ok: false, error: "Camera is disabled in the LiveKit voice migration." };
  }, []);

  const playMusicFile = useCallback(async (file: File | Blob, title?: string) => {
    const room = roomRef.current;
    if (!room) return;
    const el = document.createElement("audio");
    el.src = URL.createObjectURL(file);
    el.loop = true;
    el.volume = 0.35;
    try { await el.play(); } catch { /* user gesture may be required */ }
    musicAudioRef.current = el;
    setMusicTitle(title ?? (file instanceof File ? file.name : "Music"));
    setMusicPlaying(true);
    const capture = (el as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream?.();
    const capturedAudio = capture?.getAudioTracks()[0];
    if (capturedAudio) {
      const track = new (await import("livekit-client")).LocalAudioTrack(capturedAudio);
      musicTrackRef.current = track;
      try { await room.localParticipant.publishTrack(track); } catch { /* local playback still works */ }
    }
  }, []);

  const pauseMusic = useCallback(() => { musicAudioRef.current?.pause(); setMusicPlaying(false); }, []);
  const resumeMusic = useCallback(() => { void musicAudioRef.current?.play().then(() => setMusicPlaying(true)).catch(() => {}); }, []);
  const stopMusic = useCallback(() => {
    try { musicTrackRef.current?.stop(); } catch { /* ignore */ }
    musicTrackRef.current = null;
    try { musicAudioRef.current?.pause(); musicAudioRef.current?.remove(); } catch { /* ignore */ }
    musicAudioRef.current = null;
    setMusicPlaying(false);
    setMusicTitle(null);
  }, []);
  const setMusicVolume = useCallback((volume: number) => {
    if (musicAudioRef.current) musicAudioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
  }, []);

  return {
    status,
    error,
    remotes,
    muted,
    speakerMuted,
    videoOn,
    speakingUids,
    micBlocked,
    micError,
    localAudioTrack,
    localAudioPublished,
    requestMic,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    musicPlaying,
    musicTitle,
    playMusicFile,
    pauseMusic,
    resumeMusic,
    stopMusic,
    setMusicVolume,
  };
}
