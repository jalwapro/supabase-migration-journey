import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, createLocalAudioTrack, type LocalAudioTrack, type RemoteAudioTrack as LKRemoteAudioTrack } from "livekit-client";
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
  const body = (await res.json()) as { error?: string; token?: string; url?: string };
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
    for (const el of elements) {
      el.autoplay = true;
      el.muted = speakerMutedRef.current;
      el.setAttribute("playsinline", "true");
      audioElementsRef.current.add(el);
      void el.play().catch((err) => {
        console.warn("[LiveKit] remote audio autoplay blocked; waiting for audio unlock", err);
      });
    }
  }, []);

  const rebuildRemotes = useCallback((room: Room) => {
    const next = new Map<number, RemoteUser>();
    for (const participant of room.remoteParticipants.values()) {
      const numericUid = uidFromIdentity(participant.identity);
      const audioPub = Array.from(participant.audioTrackPublications.values()).find((p) => !!p.track);
      const videoPub = Array.from(participant.videoTrackPublications.values()).find((p) => !!p.track);
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
    const onTrackSubscribed = (track: unknown, _pub: unknown, participant: { identity: string }) => {
      if (cancelled) return;
      if ((track as { kind?: string }).kind !== Track.Kind.Audio) return;
      const mediaTrack = track as LKRemoteAudioTrack;
      console.info("[LiveKit] remote audio subscribed", participant.identity);
      attachRemoteAudio(mediaTrack);
      rebuildRemotes(room);
    };
    const onTrackUnsubscribed = (track: unknown) => {
      try {
        const mediaTrack = track as LKRemoteAudioTrack;
        const elements = mediaTrack.detach();
        for (const el of elements) audioElementsRef.current.delete(el);
      } catch { /* ignore */ }
      rebuildRemotes(room);
    };
    const onActiveSpeakers = (participants: Array<{ identity: string }>) => {
      setSpeakingUids(new Set(participants.map((p) => uidFromIdentity(p.identity))));
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantChanged);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChanged);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed as never);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed as never);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers as never);

    (async () => {
      try {
        const token = await fetchToken(channel, publish);
        if (cancelled) return;
        await room.connect(token.url!, token.token!);
        if (cancelled) return;
        setStatus("connected");
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
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed as never);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed as never);
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
      try { await room.startAudio(); } catch { /* audio may already be unlocked */ }

      if (!localAudioTrack.current) {
        localAudioTrack.current = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
      }
      if (!room.localParticipant.isMicrophoneEnabled) {
        await room.localParticipant.publishTrack(localAudioTrack.current);
      }
      localAudioPublished.current = true;
      setMuted(false);
      setMicBlocked(false);
      setMicError(null);

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
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
      const track = new LocalAudioTrack(capturedAudio);
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
