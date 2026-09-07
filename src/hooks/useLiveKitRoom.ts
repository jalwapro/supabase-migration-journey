import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLocalAudioTrack,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export type RemoteVideoTrack = { play: (container: HTMLElement, opts?: { fit?: "cover" | "contain" }) => void; stop: () => void };
export type RemoteAudioTrack = { setVolume: (v: number) => void; play: () => void; stop: () => void };
export type RemoteUser = { uid: number; hasAudio: boolean; hasVideo: boolean; videoTrack?: RemoteVideoTrack; audioTrack?: RemoteAudioTrack };
export type LiveKitStatus = "idle" | "connecting" | "connected" | "error" | "disabled";
export type UseLiveKitRoomArgs = { channel: string | null; uid: number | null; publish: boolean; video: boolean; enabled: boolean; kind?: "voice" | "video" | "pk" };

type AnyTrack = { attach: () => HTMLMediaElement; detach: () => HTMLMediaElement[] | HTMLMediaElement };

function uidFromIdentity(identity: string) {
  const raw = identity.replace(/^jalwa_/, "");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 2_000_000_000) + 1;
}

function attachedElements(track: AnyTrack): HTMLMediaElement[] {
  const attached = track.attach();
  return Array.isArray(attached) ? attached : [attached];
}

function videoFacade(track: AnyTrack): RemoteVideoTrack {
  let elements: HTMLMediaElement[] = [];
  return {
    play(container, opts) {
      if (elements.length) return;
      elements = attachedElements(track);
      elements.forEach((el) => {
        const video = el as HTMLVideoElement;
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = opts?.fit ?? "cover";
        container.appendChild(video);
      });
    },
    stop() {
      try { track.detach(); } catch {}
      elements.forEach((el) => el.remove());
      elements = [];
    },
  };
}

const remoteAudioEls = new Set<HTMLAudioElement>();
let preferredSinkId: string | null = null;

async function applySink(el: HTMLAudioElement) {
  const target = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  if (!preferredSinkId || typeof target.setSinkId !== "function") return;
  try { await target.setSinkId(preferredSinkId); } catch {}
}

function multiAudioFacade(tracks: AnyTrack[]): RemoteAudioTrack {
  let elements: HTMLMediaElement[] = [];
  let volume = 1;
  return {
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value / 100));
      elements.forEach((el) => { el.volume = volume; });
    },
    play() {
      const wanted = tracks.flatMap(attachedElements);
      elements.forEach((el) => { remoteAudioEls.delete(el as HTMLAudioElement); el.remove(); });
      elements = wanted;
      elements.forEach((el) => {
        const audio = el as HTMLAudioElement;
        audio.autoplay = true;
        audio.controls = false;
        audio.muted = false;
        audio.playsInline = true;
        audio.volume = volume;
        audio.style.display = "none";
        document.body.appendChild(audio);
        remoteAudioEls.add(audio);
        void applySink(audio);
        void audio.play().catch(() => undefined);
      });
    },
    stop() {
      tracks.forEach((track) => { try { track.detach(); } catch {} });
      elements.forEach((el) => { remoteAudioEls.delete(el as HTMLAudioElement); el.remove(); });
      elements = [];
    },
  };
}

function isMicBusyError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /notreadable|aborterror/i.test(name) || /notreadable|device.*(busy|in use)|hardware.*(busy|in use)|could not start audio source|audio source.*start|track.*failed to start/i.test(message);
}

async function createMicrophoneTrackWithRetry() {
  const options = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    return await createLocalAudioTrack(options);
  } catch (error) {
    if (!isMicBusyError(error)) throw error;
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    return createLocalAudioTrack(options);
  }
}

export function useLiveKitRoom({ channel, uid, publish, video, enabled }: UseLiveKitRoomArgs) {
  const roomRef = useRef<Room | null>(null);
  const joinSeqRef = useRef(0);
  const publishRef = useRef(publish);
  const videoRef = useRef(video);
  publishRef.current = publish;
  videoRef.current = video;

  const speakerMutedRef = useRef(false);
  const speakerVolumeRef = useRef(100);
  const prewarmRef = useRef<Promise<MediaStreamTrack | null> | null>(null);
  const localAudioTrack = useRef<unknown>(null);

  const [status, setStatus] = useState<LiveKitStatus>(enabled ? "idle" : "disabled");
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(!publish);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [speakerVolume, setSpeakerVolumeState] = useState(100);
  const [micLevel, setMicLevel] = useState(0);
  const [audioOutputs, setAudioOutputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioOutputId, setAudioOutputId] = useState("");
  const [videoOn, setVideoOn] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<RemoteVideoTrack | null>(null);
  const [speakingUids, setSpeakingUids] = useState<Set<number>>(new Set());
  const [musicVolume, setMusicVolumeState] = useState(80);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTrackRef = useRef<LocalAudioTrack | null>(null);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const musicStartedAtRef = useRef(0);
  const musicOffsetRef = useRef(0);

  const prewarmMic = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(null);
    if (!prewarmRef.current) {
      prewarmRef.current = navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .then((stream) => stream.getAudioTracks()[0] ?? null)
        .catch(() => null);
    }
    return prewarmRef.current;
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    joinSeqRef.current += 1;
    if (room && room.state !== "disconnected") await room.disconnect();
    setRemotes(new Map());
    setLocalVideoTrack(null);
    setVideoOn(false);
    setStatus(enabled ? "idle" : "disabled");
  }, [enabled]);

  useEffect(() => {
    const roomName = typeof channel === "string" ? channel.trim() : "";

    // Room data is loaded asynchronously. Do not create a LiveKit Room or
    // request a token until the actual RTC channel is present and non-empty.
    if (!enabled || !roomName || uid == null) {
      void disconnect();
      return;
    }

    const seq = ++joinSeqRef.current;
    let cancelled = false;
    let room: Room | null = null;

    setStatus("connecting");
    setError(null);

    const refresh = (participant: RemoteParticipant) => {
      const id = uidFromIdentity(participant.identity);
      const audioPubs = Array.from(participant.trackPublications.values()).filter((pub) => pub.kind === Track.Kind.Audio && pub.track);
      const videoPub = Array.from(participant.trackPublications.values()).find((pub) => pub.kind === Track.Kind.Video && pub.track);
      setRemotes((current) => {
        current.get(id)?.audioTrack?.stop();
        const audioTracks = audioPubs.map((pub) => pub.track as unknown as AnyTrack);
        const audioTrack = audioTracks.length ? multiAudioFacade(audioTracks) : undefined;
        const videoTrack = videoPub?.track ? videoFacade(videoPub.track as unknown as AnyTrack) : undefined;
        if (audioTrack) {
          audioTrack.setVolume(speakerMutedRef.current ? 0 : speakerVolumeRef.current);
          audioTrack.play();
        }
        const next = new Map(current);
        next.set(id, { uid: id, hasAudio: audioTracks.length > 0, hasVideo: !!videoPub, audioTrack, videoTrack });
        return next;
      });
    };

    const onSub = (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => refresh(participant);
    const onUnsub = (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => refresh(participant);
    const onDisc = (participant: RemoteParticipant) => {
      setRemotes((current) => {
        const next = new Map(current);
        next.get(uidFromIdentity(participant.identity))?.audioTrack?.stop();
        next.delete(uidFromIdentity(participant.identity));
        return next;
      });
    };
    const onSpeakers = (speakers: Participant[]) => setSpeakingUids(new Set(speakers.map((participant) => uidFromIdentity(participant.identity))));

    const attachListeners = (nextRoom: Room) => {
      nextRoom.on(RoomEvent.TrackSubscribed, onSub);
      nextRoom.on(RoomEvent.TrackUnsubscribed, onUnsub);
      nextRoom.on(RoomEvent.ParticipantConnected, refresh);
      nextRoom.on(RoomEvent.ParticipantDisconnected, onDisc);
      nextRoom.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      nextRoom.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus("idle"); });
    };

    void (async () => {
      try {
        // Explicitly finish any previous LiveKit session before creating a
        // new one. This avoids duplicate-identity connect/disconnect races
        // when roomId/rtc_channel changes while the page is mounting.
        const previousRoom = roomRef.current;
        if (previousRoom && previousRoom.state !== "disconnected") {
          roomRef.current = null;
          try { await previousRoom.disconnect(); } catch {}
        }
        if (cancelled || seq !== joinSeqRef.current) return;

        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const userId = data.session?.user?.id;
        if (!token || !userId) throw new Error("Sign in first");
        if (cancelled || seq !== joinSeqRef.current) return;

        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId, roomName, name: `Jalwa user ${uid}`, canPublish: publishRef.current }),
        });
        const body = await response.json() as { server_url?: string; participant_token?: string; room?: string; error?: string };
        if (!response.ok || !body.server_url || !body.participant_token) throw new Error(body.error ?? "LiveKit token request failed");

        // The token endpoint is authoritative for the room. Refuse to connect
        // if it did not return a valid room name, and never connect using the
        // stale/empty client-side value.
        const tokenRoomName = typeof body.room === "string" ? body.room.trim() : roomName;
        if (!tokenRoomName) throw new Error("LiveKit room name missing");
        if (tokenRoomName !== roomName) throw new Error("LiveKit room mismatch");
        if (cancelled || seq !== joinSeqRef.current) return;

        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        attachListeners(room);

        if (publishRef.current) void prewarmMic();

        if (cancelled || seq !== joinSeqRef.current) {
          if (room.state !== "disconnected") await room.disconnect();
          return;
        }

        await room.connect(body.server_url, body.participant_token, { autoSubscribe: true });
        if (cancelled || seq !== joinSeqRef.current) {
          if (room.state !== "disconnected") await room.disconnect();
          return;
        }
        room.remoteParticipants.forEach(refresh);
        setStatus("connected");
      } catch (joinError) {
        if (cancelled) return;
        setStatus("error");
        setError(joinError instanceof Error ? joinError.message : "LiveKit connection failed");
        if (room && room.state !== "disconnected") await room.disconnect();
        if (roomRef.current === room) roomRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      if (room) {
        room.off(RoomEvent.TrackSubscribed, onSub);
        room.off(RoomEvent.TrackUnsubscribed, onUnsub);
        room.off(RoomEvent.ParticipantConnected, refresh);
        room.off(RoomEvent.ParticipantDisconnected, onDisc);
        room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
        if (room.state !== "disconnected") void room.disconnect();
        if (roomRef.current === room) roomRef.current = null;
      }
      setRemotes((current) => {
        current.forEach((remote) => remote.audioTrack?.stop());
        return new Map();
      });
    };
  }, [channel, uid, enabled, disconnect, prewarmMic]);

  const ensurePublishGrant = useCallback(async () => {
    const room = roomRef.current;
    const roomName = typeof channel === "string" ? channel.trim() : "";
    if (!room || room.state !== "connected" || !roomName) return false;
    if (room.localParticipant.permissions?.canPublish) return true;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return false;
      const response = await fetch("/api/livekit-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ room: roomName, canPublish: true }),
      });
      const body = await response.json().catch(() => ({})) as { canPublish?: boolean };
      if (!response.ok || body.canPublish !== true) return false;
    } catch {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      if (room.localParticipant.permissions?.canPublish) return resolve(true);
      const timer = setTimeout(() => {
        room.off(RoomEvent.ParticipantPermissionsChanged, onChange);
        resolve(room.localParticipant.permissions?.canPublish === true);
      }, 4000);
      const onChange = () => {
        if (room.localParticipant.permissions?.canPublish) {
          clearTimeout(timer);
          room.off(RoomEvent.ParticipantPermissionsChanged, onChange);
          resolve(true);
        }
      };
      room.on(RoomEvent.ParticipantPermissionsChanged, onChange);
    });
  }, [channel]);

  const waitForConnected = useCallback(async (timeoutMs = 9000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (roomRef.current?.state === "connected") return true;
      await new Promise<void>((resolve) => setTimeout(resolve, 120));
    }
    return roomRef.current?.state === "connected";
  }, []);

  const releaseMicCapture = useCallback(async () => {
    const room = roomRef.current;
    try { (await prewarmRef.current)?.stop(); } catch {}
    prewarmRef.current = null;
    const publication = room?.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (room && publication?.track) {
      try { await room.localParticipant.unpublishTrack(publication.track as LocalAudioTrack, true); } catch {}
    }
  }, []);

  const attemptMicrophone = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return { ok: false, error: "Room connect ho raha hai" };
    if (!room.localParticipant.permissions?.canPublish) {
      const granted = await ensurePublishGrant();
      if (!granted) return { ok: false, error: "Microphone publish permission available nahi hai" };
    }

    try {
      const existing = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (existing?.track) {
        await room.localParticipant.setMicrophoneEnabled(true);
      } else {
        const audioTrack = await createMicrophoneTrackWithRetry();
        await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone, name: "microphone" });
      }
      localAudioTrack.current = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track ?? null;
      if (!localAudioTrack.current) return { ok: false, error: "Microphone track publish nahi hua" };
      setMuted(false);
      setMicBlocked(false);
      setMicError(null);
      return { ok: true };
    } catch (micErrorValue) {
      const busy = isMicBusyError(micErrorValue);
      return { ok: false, error: busy ? "Mic access check karein ya page refresh karein" : micErrorValue instanceof Error ? micErrorValue.message : "Microphone permission denied" };
    }
  }, [ensurePublishGrant]);

  const enableMicrophone = useCallback(async () => {
    if (!await waitForConnected()) {
      const message = "Room connect nahi ho saka";
      setMicError(message);
      return { ok: false, error: message };
    }
    let last: { ok: boolean; error?: string } = { ok: false };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      last = await attemptMicrophone();
      if (last.ok) return last;
      if (/notallowed|permission denied|denied by system|dismissed/i.test(last.error ?? "")) break;
      await releaseMicCapture();
      await new Promise<void>((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    setMicBlocked(true);
    setMicError(last.error ?? "Mic access check karein ya page refresh karein");
    return last;
  }, [attemptMicrophone, releaseMicCapture, waitForConnected]);

  useEffect(() => {
    if (status !== "connected") return;
    const room = roomRef.current;
    if (!room) return;
    const syncMedia = async () => {
      if (publishRef.current) await enableMicrophone();
      else {
        try { await room.localParticipant.setMicrophoneEnabled(false); } catch {}
        setMuted(true);
      }
      if (videoRef.current) {
        try {
          await room.localParticipant.setCameraEnabled(true);
          const publication = Array.from(room.localParticipant.trackPublications.values()).find((pub) => pub.kind === Track.Kind.Video && pub.track);
          if (publication?.track) {
            setLocalVideoTrack(videoFacade(publication.track as unknown as AnyTrack));
            setVideoOn(true);
          }
        } catch { setVideoOn(false); }
      }
    };
    void syncMedia();
  }, [status, publish, video, enableMicrophone]);

  useEffect(() => {
    if (status !== "connected") return;
    const room = roomRef.current;
    if (!room) return;
    const sync = () => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      setMuted(!publication?.track || publication.isMuted);
    };
    room.on(RoomEvent.LocalTrackPublished, sync);
    room.on(RoomEvent.LocalTrackUnpublished, sync);
    room.on(RoomEvent.TrackMuted, sync);
    room.on(RoomEvent.TrackUnmuted, sync);
    room.on(RoomEvent.ParticipantPermissionsChanged, sync);
    sync();
    return () => {
      room.off(RoomEvent.LocalTrackPublished, sync);
      room.off(RoomEvent.LocalTrackUnpublished, sync);
      room.off(RoomEvent.TrackMuted, sync);
      room.off(RoomEvent.TrackUnmuted, sync);
      room.off(RoomEvent.ParticipantPermissionsChanged, sync);
    };
  }, [status]);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
    speakerVolumeRef.current = speakerVolume;
    const level = speakerMuted ? 0 : speakerVolume;
    remotes.forEach((remote) => remote.audioTrack?.setVolume(level));
  }, [speakerMuted, speakerVolume, remotes]);

  const setSpeakerVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    speakerVolumeRef.current = next;
    setSpeakerVolumeState(next);
  }, []);

  const refreshAudioOutputs = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioOutputs(devices.filter((device) => device.kind === "audiooutput").map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Output ${index + 1}` })));
    } catch {}
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    void refreshAudioOutputs();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const onChange = () => void refreshAudioOutputs();
    mediaDevices.addEventListener("devicechange", onChange);
    return () => mediaDevices.removeEventListener("devicechange", onChange);
  }, [status, refreshAudioOutputs]);

  const setAudioOutput = useCallback(async (deviceId: string) => {
    preferredSinkId = deviceId || null;
    setAudioOutputId(deviceId);
    await Promise.all(Array.from(remoteAudioEls).map((element) => applySink(element)));
  }, []);

  useEffect(() => {
    if (muted || status !== "connected") { setMicLevel(0); return; }
    const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
    const mediaTrack = track?.mediaStreamTrack;
    if (!mediaTrack) return;
    let animation = 0;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const source = context.createMediaStreamSource(new MediaStream([mediaTrack]));
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) { const value = (data[i] - 128) / 128; sum += value * value; }
        setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 3));
        animation = requestAnimationFrame(tick);
      };
      animation = requestAnimationFrame(tick);
    } catch {}
    return () => { cancelAnimationFrame(animation); setMicLevel(0); void context?.close().catch(() => undefined); };
  }, [muted, status]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    if (muted) { await enableMicrophone(); return; }
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      setMuted(true);
      setMicBlocked(false);
      setMicError(null);
    } catch (toggleError) {
      setMicBlocked(true);
      setMicError(toggleError instanceof Error ? toggleError.message : "Microphone toggle failed");
    }
  }, [muted, enableMicrophone]);

  const activateAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    try { await room.startAudio(); } catch {}
    remotes.forEach((remote) => remote.audioTrack?.play());
  }, [remotes]);

  const toggleSpeaker = useCallback(() => {
    void activateAudio();
    const next = !speakerMuted;
    speakerMutedRef.current = next;
    setSpeakerMuted(next);
    remotes.forEach((remote) => {
      remote.audioTrack?.setVolume(next ? 0 : speakerVolumeRef.current);
      remote.audioTrack?.play();
    });
  }, [speakerMuted, remotes, activateAudio]);

  const toggleVideo = useCallback(async (_processor?: unknown) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    try {
      const enable = !videoOn;
      await room.localParticipant.setCameraEnabled(enable);
      setVideoOn(enable);
      const publication = Array.from(room.localParticipant.trackPublications.values()).find((pub) => pub.kind === Track.Kind.Video && pub.track);
      setLocalVideoTrack(enable && publication?.track ? videoFacade(publication.track as unknown as AnyTrack) : null);
    } catch (videoError) {
      setError(videoError instanceof Error ? videoError.message : "Camera failed");
    }
  }, [videoOn]);

  const requestMic = useCallback(async () => enableMicrophone(), [enableMicrophone]);

  const startMusicSource = useCallback((offset: number) => {
    const context = musicCtxRef.current;
    const buffer = musicBufferRef.current;
    const gain = musicGainRef.current;
    if (!context || !buffer || !gain) return;
    musicSourceRef.current?.stop();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(0, Math.max(0, Math.min(offset, buffer.duration)));
    musicSourceRef.current = source;
    musicStartedAtRef.current = context.currentTime - offset;
    source.onended = () => { if (musicSourceRef.current === source) setMusicPlaying(false); };
  }, []);

  const playMusicFile = useCallback(async (file: Blob, title: string) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") throw new Error("Room connect nahi hai");
    if (!room.localParticipant.permissions?.canPublish) throw new Error("Host ko LiveKit publish permission nahi mili");
    const context = musicCtxRef.current ?? new AudioContext();
    musicCtxRef.current = context;
    if (context.state === "suspended") await context.resume();
    musicBufferRef.current = await context.decodeAudioData(await file.arrayBuffer());
    if (!musicGainRef.current) {
      const gain = context.createGain();
      gain.gain.value = musicVolume / 100;
      musicGainRef.current = gain;
      const destination = context.createMediaStreamDestination();
      gain.connect(destination);
      gain.connect(context.destination);
      const mediaTrack = destination.stream.getAudioTracks()[0];
      if (!mediaTrack) throw new Error("Music audio track create nahi hua");
      const liveKitTrack = new LocalAudioTrack(mediaTrack, undefined, false);
      musicTrackRef.current = liveKitTrack;
      await room.localParticipant.publishTrack(liveKitTrack, { name: "room-music", source: Track.Source.Unknown });
    } else {
      musicGainRef.current.gain.value = musicVolume / 100;
    }
    musicOffsetRef.current = 0;
    startMusicSource(0);
    setMusicTitle(title);
    setMusicPlaying(true);
  }, [startMusicSource, musicVolume]);

  const pauseMusic = useCallback(() => {
    const context = musicCtxRef.current;
    const source = musicSourceRef.current;
    if (!context || !source) return;
    musicOffsetRef.current = context.currentTime - musicStartedAtRef.current;
    source.onended = null;
    source.stop();
    musicSourceRef.current = null;
    setMusicPlaying(false);
  }, []);

  const resumeMusic = useCallback(() => {
    if (!musicBufferRef.current) return;
    void musicCtxRef.current?.resume();
    startMusicSource(musicOffsetRef.current);
    setMusicPlaying(true);
  }, [startMusicSource]);

  const stopMusic = useCallback(async () => {
    const source = musicSourceRef.current;
    if (source) { source.onended = null; source.stop(); musicSourceRef.current = null; }
    musicOffsetRef.current = 0;
    musicBufferRef.current = null;
    const room = roomRef.current;
    if (musicTrackRef.current) {
      try { if (room) await room.localParticipant.unpublishTrack(musicTrackRef.current); } catch {}
      musicTrackRef.current.stop();
      musicTrackRef.current = null;
    }
    musicGainRef.current?.disconnect();
    musicGainRef.current = null;
    setMusicPlaying(false);
    setMusicTitle(null);
  }, []);

  const setMusicVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setMusicVolumeState(next);
    if (musicGainRef.current) musicGainRef.current.gain.value = next / 100;
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    const room = roomRef.current;
    if (!room) return;
    const onFirstInteraction = () => { void room.startAudio().catch(() => undefined); };
    window.addEventListener("pointerdown", onFirstInteraction, { once: true, passive: true });
    return () => window.removeEventListener("pointerdown", onFirstInteraction);
  }, [status]);

  useEffect(() => () => {
    musicSourceRef.current?.stop();
    musicTrackRef.current?.stop();
    void musicCtxRef.current?.close().catch(() => undefined);
    remoteAudioEls.forEach((element) => { element.pause(); element.remove(); });
    remoteAudioEls.clear();
  }, []);

  return {
    status, error, remotes, speakingUids, localAudioTrack, requestMic, micLevel,
    speakerVolume, setSpeakerVolume, audioOutputs, audioOutputId, setAudioOutput,
    refreshAudioOutputs, musicVolume, musicPlaying, musicTitle, playMusicFile,
    pauseMusic, resumeMusic, stopMusic, setMusicVolume, muted, speakerMuted,
    videoOn, micBlocked, micError, localVideoTrack,
    localAudioPublished: { current: !muted }, toggleMute, toggleSpeaker, toggleVideo, disconnect,
  };
}
