import { useCallback, useEffect, useRef, useState } from "react";
import { LocalAudioTrack, Room, RoomEvent, Track, type Participant, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export type RemoteVideoTrack = { play: (container: HTMLElement, opts?: { fit?: "cover" | "contain" }) => void; stop: () => void };
export type RemoteAudioTrack = { setVolume: (v: number) => void; play: () => void; stop: () => void };
export type RemoteUser = { uid: number; hasAudio: boolean; hasVideo: boolean; videoTrack?: RemoteVideoTrack; audioTrack?: RemoteAudioTrack };
export type LiveKitStatus = "idle" | "connecting" | "connected" | "error" | "disabled";
export type UseLiveKitRoomArgs = { channel: string | null; uid: number | null; publish: boolean; video: boolean; enabled: boolean; kind?: "voice" | "video" | "pk" };

function uidFromIdentity(identity: string) { const raw = identity.replace(/^jalwa_/, ""); let h = 0; for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0; return (Math.abs(h) % 2_000_000_000) + 1; }

type AnyTrack = { attach: () => HTMLMediaElement; detach: () => HTMLMediaElement[] | HTMLMediaElement };

function attachedElements(track: AnyTrack): HTMLMediaElement[] {
  const el = track.attach();
  return Array.isArray(el) ? el : [el];
}

function videoFacade(track: AnyTrack): RemoteVideoTrack {
  let attached: HTMLElement[] = [];
  return {
    play(container, opts) {
      if (attached.length) return;
      attached = attachedElements(track).map((el) => { const v = el as HTMLVideoElement; v.autoplay = true; v.playsInline = true; v.style.width = "100%"; v.style.height = "100%"; v.style.objectFit = opts?.fit ?? "cover"; container.appendChild(v); return v; });
    },
    stop() { track.detach(); attached.forEach((el) => el.remove()); attached = []; },
  };
}

/** Every attached remote audio element, so master volume / output device changes hit all of them. */
const remoteAudioEls = new Set<HTMLAudioElement>();
let preferredSinkId: string | null = null;

async function applySink(el: HTMLAudioElement) {
  const anyEl = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  if (!preferredSinkId || typeof anyEl.setSinkId !== "function") return;
  try { await anyEl.setSinkId(preferredSinkId); } catch { /* device gone or unsupported */ }
}

function audioFacade(track: AnyTrack): RemoteAudioTrack {
  let elements: HTMLMediaElement[] = [];
  let volume = 1;
  return {
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v / 100));
      elements.forEach((el) => { el.volume = volume; });
    },
    play() {
      if (elements.length) {
        elements.forEach((el) => { el.volume = volume; void (el as HTMLAudioElement).play().catch(() => undefined); });
        return;
      }
      elements = attachedElements(track).map((el) => {
        const a = el as HTMLAudioElement;
        a.autoplay = true;
        a.controls = false;
        a.muted = false;
        a.volume = volume;
        a.style.display = "none";
        document.body.appendChild(a);
        remoteAudioEls.add(a);
        void applySink(a);
        void a.play().catch(() => undefined);
        return a;
      });
    },
    stop() { track.detach(); elements.forEach((el) => { remoteAudioEls.delete(el as HTMLAudioElement); el.remove(); }); elements = []; },
  };
}

export function useLiveKitRoom({ channel, uid, publish, video, enabled }: UseLiveKitRoomArgs) {
  const roomRef = useRef<Room | null>(null);
  const publishRef = useRef(publish);
  const videoRef = useRef(video);
  const speakerMutedRef = useRef(false);
  const speakerVolumeRef = useRef(100);
  publishRef.current = publish;
  videoRef.current = video;

  const [status, setStatus] = useState<LiveKitStatus>(enabled ? "idle" : "disabled");
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(!publish);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [speakerVolume, setSpeakerVolumeState] = useState(100);
  const [micLevel, setMicLevel] = useState(0);
  const [audioOutputs, setAudioOutputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioOutputId, setAudioOutputId] = useState<string>("");
  const [musicVolume, setMusicVolumeState] = useState(80);
  const [videoOn, setVideoOn] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<RemoteVideoTrack | null>(null);
  const [speakingUids, setSpeakingUids] = useState<Set<number>>(new Set());
  const localAudioTrack = useRef<unknown>(null);
  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTrackRef = useRef<LocalAudioTrack | null>(null);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const musicStartedAtRef = useRef(0);
  const musicOffsetRef = useRef(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  const disconnect = useCallback(async () => { const room = roomRef.current; roomRef.current = null; if (room && room.state !== "disconnected") await room.disconnect(); setRemotes(new Map()); setLocalVideoTrack(null); setVideoOn(false); setStatus(enabled ? "idle" : "disabled"); }, [enabled]);

  useEffect(() => {
    if (!enabled || !channel || uid == null) { void disconnect(); return; }
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setStatus("connecting");
    setError(null);

    const refresh = (p: RemoteParticipant) => {
      const id = uidFromIdentity(p.identity);
      const a = Array.from(p.trackPublications.values()).find((x) => x.kind === Track.Kind.Audio && x.track);
      const v = Array.from(p.trackPublications.values()).find((x) => x.kind === Track.Kind.Video && x.track);

      setRemotes((cur) => {
        const previous = cur.get(id);
        previous?.audioTrack?.stop();
        const audioTrack = a?.track ? audioFacade(a.track) : undefined;
        const videoTrack = v?.track ? videoFacade(v.track) : undefined;
        if (audioTrack) {
          audioTrack.setVolume(speakerMutedRef.current ? 0 : speakerVolumeRef.current);
          audioTrack.play();
        }
        const next = new Map(cur);
        next.set(id, { uid: id, hasAudio: !!a, hasVideo: !!v, audioTrack, videoTrack });
        return next;
      });
    };

    const onSub = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      // refresh() owns the actual HTMLAudioElement attachment so speaker volume
      // changes always target the same element that is playing the LiveKit track.
      refresh(p);
      if (track.kind === Track.Kind.Audio) {
        // Explicitly resume the media element on a subscription event as a
        // browser/WebView autoplay safeguard.
        const current = uidFromIdentity(p.identity);
        setRemotes((cur) => {
          cur.get(current)?.audioTrack?.play();
          return cur;
        });
      }
    };
    const onUnsub = (_track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => refresh(p);
    const onDisc = (p: RemoteParticipant) => setRemotes((cur) => { const n = new Map(cur); n.get(uidFromIdentity(p.identity))?.audioTrack?.stop(); n.delete(uidFromIdentity(p.identity)); return n; });
    const onSpeakers = (speakers: Participant[]) => setSpeakingUids(new Set(speakers.map((sp) => uidFromIdentity(sp.identity))));

    room.on(RoomEvent.TrackSubscribed, onSub);
    room.on(RoomEvent.TrackUnsubscribed, onUnsub);
    room.on(RoomEvent.ParticipantConnected, refresh);
    room.on(RoomEvent.ParticipantDisconnected, onDisc);
    room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus("idle"); });

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Sign in first");
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ room: channel, name: `Jalwa user ${uid}`, canPublish: publishRef.current }),
        });
        const body = await res.json() as { server_url?: string; participant_token?: string; canPublish?: boolean; error?: string };
        if (!res.ok || !body.server_url || !body.participant_token) throw new Error(body.error ?? "LiveKit token request failed");
        if (publishRef.current && body.canPublish !== true) {
          throw new Error("LiveKit microphone permission is not granted for this user");
        }
        if (cancelled) return;
        await room.connect(body.server_url, body.participant_token, { autoSubscribe: true });
        if (cancelled) return;
        room.remoteParticipants.forEach(refresh);
        setStatus("connected");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "LiveKit connection failed");
        if (room.state !== "disconnected") await room.disconnect();
      }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, onSub);
      room.off(RoomEvent.TrackUnsubscribed, onUnsub);
      room.off(RoomEvent.ParticipantConnected, refresh);
      room.off(RoomEvent.ParticipantDisconnected, onDisc);
      room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      setRemotes((cur) => { cur.forEach((r) => r.audioTrack?.stop()); return new Map(); });
      if (room.state !== "disconnected") void room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [channel, uid, enabled, disconnect]);

  useEffect(() => {
    if (status !== "connected") return;
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    const desiredPublish = publishRef.current;
    const desiredVideo = videoRef.current;
    let active = true;
    const syncMedia = async () => {
      if (desiredPublish) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          if (active) { localAudioTrack.current = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track ?? null; setMuted(false); setMicBlocked(false); setMicError(null); }
        } catch (e) {
          if (active) { setMicBlocked(true); setMicError(e instanceof Error ? e.message : "Microphone permission denied"); }
        }
      } else {
        try { await room.localParticipant.setMicrophoneEnabled(false); } catch { /* room may be disconnecting */ }
        if (active) setMuted(true);
      }
      if (!active || room.state !== "connected") return;
      if (desiredVideo) {
        try {
          await room.localParticipant.setCameraEnabled(true);
          const pub = Array.from(room.localParticipant.trackPublications.values()).find((x) => x.kind === Track.Kind.Video && x.track);
          if (active && pub?.track) { setLocalVideoTrack(videoFacade(pub.track)); setVideoOn(true); }
        } catch { if (active) setVideoOn(false); }
      } else if (room.localParticipant.isCameraEnabled) {
        try { await room.localParticipant.setCameraEnabled(false); } catch { /* room may be disconnecting */ }
        if (active) { setVideoOn(false); setLocalVideoTrack(null); }
      }
    };
    void syncMedia();
    return () => { active = false; };
  }, [status, publish, video]);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
    speakerVolumeRef.current = speakerVolume;
    const level = speakerMuted ? 0 : speakerVolume;
    remotes.forEach((r) => r.audioTrack?.setVolume(level));
  }, [speakerMuted, speakerVolume, remotes]);

  /** Master output volume 0-100 (independent of the deafen toggle). */
  const setSpeakerVolume = useCallback((v: number) => {
    const next = Math.max(0, Math.min(100, Math.round(v)));
    speakerVolumeRef.current = next;
    setSpeakerVolumeState(next);
  }, []);

  /** Enumerate speakers / earphones / bluetooth outputs when supported. */
  const refreshAudioOutputs = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Output ${i + 1}` })));
    } catch { /* permission not granted yet */ }
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    void refreshAudioOutputs();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refreshAudioOutputs();
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [status, refreshAudioOutputs]);

  const setAudioOutput = useCallback(async (deviceId: string) => {
    preferredSinkId = deviceId || null;
    setAudioOutputId(deviceId);
    await Promise.all(Array.from(remoteAudioEls).map((el) => applySink(el)));
  }, []);

  // Live microphone input level for the waveform / meter UI.
  useEffect(() => {
    if (muted || status !== "connected") { setMicLevel(0); return; }
    const room = roomRef.current;
    const mediaTrack = (room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined)?.mediaStreamTrack;
    if (!mediaTrack) return;
    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 3));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch { /* analyser unsupported */ }
    return () => { cancelAnimationFrame(raf); setMicLevel(0); void ctx?.close().catch(() => undefined); };
  }, [muted, status]);

  const toggleMute = useCallback(async () => { const room = roomRef.current; if (!room || room.state !== "connected") return; try { const enable = muted; await room.localParticipant.setMicrophoneEnabled(enable); setMuted(!enable); setMicBlocked(false); setMicError(null); } catch (e) { setMicBlocked(true); setMicError(e instanceof Error ? e.message : "Microphone permission denied"); } }, [muted]);
  const toggleVideo = useCallback(async (_pipeline?: unknown) => { const room = roomRef.current; if (!room || room.state !== "connected") return; try { const enable = !videoOn; await room.localParticipant.setCameraEnabled(enable); setVideoOn(enable); const pub = Array.from(room.localParticipant.trackPublications.values()).find((x) => x.kind === Track.Kind.Video && x.track); setLocalVideoTrack(enable && pub?.track ? videoFacade(pub.track) : null); } catch (e) { setError(e instanceof Error ? e.message : "Camera failed"); } }, [videoOn]);
  const toggleSpeaker = useCallback(() => { const next = !speakerMuted; speakerMutedRef.current = next; setSpeakerMuted(next); remotes.forEach((r) => { r.audioTrack?.setVolume(next ? 0 : 100); r.audioTrack?.play(); }); }, [speakerMuted, remotes]);

  const requestMic = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return { ok: false, error: "Room connect ho raha hai" };
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      localAudioTrack.current = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track ?? null;
      setMuted(false); setMicBlocked(false); setMicError(null);
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Microphone permission denied";
      setMicBlocked(true); setMicError(message);
      return { ok: false, error: message };
    }
  }, []);

  const startMusicSource = useCallback((offset: number) => {
    const ctx = musicCtxRef.current; const buffer = musicBufferRef.current; const gain = musicGainRef.current;
    if (!ctx || !buffer || !gain) return;
    musicSourceRef.current?.stop();
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = false; src.connect(gain);
    src.start(0, Math.max(0, Math.min(offset, buffer.duration)));
    musicSourceRef.current = src;
    musicStartedAtRef.current = ctx.currentTime - offset;
    src.onended = () => { if (musicSourceRef.current === src) setMusicPlaying(false); };
  }, []);

  const playMusicFile = useCallback(async (file: Blob, title: string) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") throw new Error("Room connect nahi hai");
    const ctx = musicCtxRef.current ?? new AudioContext();
    musicCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    musicBufferRef.current = buffer;
    if (!musicGainRef.current) {
      const gain = ctx.createGain(); gain.gain.value = 0.8; musicGainRef.current = gain;
      const dest = ctx.createMediaStreamDestination(); gain.connect(dest); gain.connect(ctx.destination);
      const [mediaTrack] = dest.stream.getAudioTracks();
      const lkTrack = new LocalAudioTrack(mediaTrack, undefined, false);
      musicTrackRef.current = lkTrack;
      await room.localParticipant.publishTrack(lkTrack, { name: "room-music", source: Track.Source.Unknown });
    }
    musicOffsetRef.current = 0;
    startMusicSource(0);
    if (musicGainRef.current) musicGainRef.current.gain.value = musicVolume / 100;
    setMusicTitle(title); setMusicPlaying(true);
  }, [startMusicSource, musicVolume]);

  const pauseMusic = useCallback(() => {
    const ctx = musicCtxRef.current;
    if (!ctx || !musicSourceRef.current) return;
    musicOffsetRef.current = ctx.currentTime - musicStartedAtRef.current;
    musicSourceRef.current.onended = null;
    musicSourceRef.current.stop(); musicSourceRef.current = null;
    setMusicPlaying(false);
  }, []);

  const resumeMusic = useCallback(() => {
    if (!musicBufferRef.current) return;
    void musicCtxRef.current?.resume();
    startMusicSource(musicOffsetRef.current);
    setMusicPlaying(true);
  }, [startMusicSource]);

  const stopMusic = useCallback(async () => {
    if (musicSourceRef.current) { musicSourceRef.current.onended = null; musicSourceRef.current.stop(); musicSourceRef.current = null; }
    musicOffsetRef.current = 0; musicBufferRef.current = null;
    const room = roomRef.current;
    if (musicTrackRef.current) {
      try { if (room) await room.localParticipant.unpublishTrack(musicTrackRef.current); } catch { /* already gone */ }
      musicTrackRef.current.stop(); musicTrackRef.current = null;
    }
    musicGainRef.current = null;
    setMusicPlaying(false); setMusicTitle(null);
  }, []);

  const setMusicVolume = useCallback((v: number) => {
    const next = Math.max(0, Math.min(100, Math.round(v)));
    setMusicVolumeState(next);
    if (musicGainRef.current) musicGainRef.current.gain.value = next / 100;
  }, []);

  // Release music graph + audio elements when the hook unmounts.
  useEffect(() => () => {
    musicSourceRef.current?.stop();
    musicSourceRef.current = null;
    musicTrackRef.current?.stop();
    musicTrackRef.current = null;
    void musicCtxRef.current?.close().catch(() => undefined);
    musicCtxRef.current = null;
    remoteAudioEls.forEach((el) => { el.pause(); el.remove(); });
    remoteAudioEls.clear();
  }, []);

  return { status, error, remotes, speakingUids, localAudioTrack, requestMic, micLevel, speakerVolume, setSpeakerVolume, audioOutputs, audioOutputId, setAudioOutput, refreshAudioOutputs, musicVolume, musicPlaying, musicTitle, playMusicFile, pauseMusic, resumeMusic, stopMusic, setMusicVolume, muted, speakerMuted, videoOn, micBlocked, micError, localVideoTrack, localAudioPublished: { current: !muted }, toggleMute, toggleSpeaker, toggleVideo, disconnect };
}
