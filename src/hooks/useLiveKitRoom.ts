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
  return { play(container, opts) { attached = attachedElements(track).map((el) => { const v = el as HTMLVideoElement; v.autoplay = true; v.playsInline = true; v.style.width = "100%"; v.style.height = "100%"; v.style.objectFit = opts?.fit ?? "cover"; container.appendChild(v); return v; }); }, stop() { track.detach(); attached.forEach((el) => el.remove()); attached = []; } };
}
function audioFacade(track: AnyTrack): RemoteAudioTrack {
  let elements: HTMLMediaElement[] = []; let volume = 1;
  return { setVolume(v) { volume = Math.max(0, Math.min(1, v / 100)); elements.forEach((el) => { el.volume = volume; }); }, play() { elements = attachedElements(track).map((el) => { const a = el as HTMLAudioElement; a.autoplay = true; a.volume = volume; document.body.appendChild(a); void a.play().catch(() => undefined); return a; }); }, stop() { track.detach(); elements.forEach((el) => el.remove()); elements = []; } };
}

export function useLiveKitRoom({ channel, uid, publish, video, enabled }: UseLiveKitRoomArgs) {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<LiveKitStatus>(enabled ? "idle" : "disabled");
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(!publish);
  const [speakerMuted, setSpeakerMuted] = useState(false);
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

  const disconnect = useCallback(async () => { const room = roomRef.current; roomRef.current = null; if (room) await room.disconnect(); setRemotes(new Map()); setLocalVideoTrack(null); setVideoOn(false); setStatus(enabled ? "idle" : "disabled"); }, [enabled]);

  useEffect(() => {
    if (!enabled || !channel || uid == null) { void disconnect(); return; }
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room; setStatus("connecting"); setError(null);
    const refresh = (p: RemoteParticipant) => { const id = uidFromIdentity(p.identity); const a = Array.from(p.trackPublications.values()).find((x) => x.kind === Track.Kind.Audio && x.track); const v = Array.from(p.trackPublications.values()).find((x) => x.kind === Track.Kind.Video && x.track); setRemotes((cur) => new Map(cur).set(id, { uid: id, hasAudio: !!a, hasVideo: !!v, audioTrack: a?.track ? audioFacade(a.track) : undefined, videoTrack: v?.track ? videoFacade(v.track) : undefined })); };
    const onSub = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => { refresh(p); if (track.kind === Track.Kind.Audio && !speakerMuted) { attachedElements(track).forEach((el) => { const a = el as HTMLAudioElement; a.autoplay = true; document.body.appendChild(a); void a.play().catch(() => undefined); }); } };
    const onUnsub = (_track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => refresh(p);
    const onDisc = (p: RemoteParticipant) => setRemotes((cur) => { const n = new Map(cur); n.delete(uidFromIdentity(p.identity)); return n; });
    room.on(RoomEvent.TrackSubscribed, onSub); room.on(RoomEvent.TrackUnsubscribed, onUnsub); room.on(RoomEvent.ParticipantConnected, refresh); room.on(RoomEvent.ParticipantDisconnected, onDisc); const onSpeakers = (speakers: Participant[]) => setSpeakingUids(new Set(speakers.map((sp) => uidFromIdentity(sp.identity))));
    room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus("idle"); });
    (async () => { try { const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) throw new Error("Sign in first"); const res = await fetch("/api/livekit-token", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ room: channel, name: `Jalwa user ${uid}`, canPublish: publish }) }); const body = await res.json() as { server_url?: string; participant_token?: string; canPublish?: boolean; error?: string }; if (!res.ok || !body.server_url || !body.participant_token) throw new Error(body.error ?? "LiveKit token request failed"); if (cancelled) return; await room.connect(body.server_url, body.participant_token, { autoSubscribe: true }); if (cancelled) return; room.remoteParticipants.forEach(refresh); setStatus("connected"); if (body.canPublish === true && publish) { try { await room.localParticipant.setMicrophoneEnabled(true); localAudioTrack.current = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track ?? null; setMuted(false); } catch (e) { setMicBlocked(true); setMicError(e instanceof Error ? e.message : "Microphone permission denied"); } } if (body.canPublish === true && video) { try { await room.localParticipant.setCameraEnabled(true); const pub = Array.from(room.localParticipant.trackPublications.values()).find((x) => x.kind === Track.Kind.Video && x.track); if (pub?.track) setLocalVideoTrack(videoFacade(pub.track)); setVideoOn(true); } catch { setVideoOn(false); } } } catch (e) { if (cancelled) return; setStatus("error"); setError(e instanceof Error ? e.message : "LiveKit connection failed"); await room.disconnect(); } })();
    return () => { cancelled = true; room.off(RoomEvent.TrackSubscribed, onSub); room.off(RoomEvent.TrackUnsubscribed, onUnsub); room.off(RoomEvent.ParticipantConnected, refresh); room.off(RoomEvent.ParticipantDisconnected, onDisc); room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers); void room.disconnect(); if (roomRef.current === room) roomRef.current = null; };
  }, [channel, uid, enabled, publish, video, disconnect, speakerMuted]);

  const toggleMute = useCallback(async () => { const room = roomRef.current; if (!room || room.state !== "connected") return; try { const enable = muted; await room.localParticipant.setMicrophoneEnabled(enable); setMuted(!enable); setMicBlocked(false); setMicError(null); } catch (e) { setMicBlocked(true); setMicError(e instanceof Error ? e.message : "Microphone permission denied"); } }, [muted]);
  const toggleVideo = useCallback(async (_pipeline?: unknown) => { const room = roomRef.current; if (!room || room.state !== "connected") return; try { const enable = !videoOn; await room.localParticipant.setCameraEnabled(enable); setVideoOn(enable); const pub = Array.from(room.localParticipant.trackPublications.values()).find((x) => x.kind === Track.Kind.Video && x.track); setLocalVideoTrack(enable && pub?.track ? videoFacade(pub.track) : null); } catch (e) { setError(e instanceof Error ? e.message : "Camera failed"); } }, [videoOn]);
  const toggleSpeaker = useCallback(() => { const next = !speakerMuted; setSpeakerMuted(next); remotes.forEach((r) => r.audioTrack?.setVolume(next ? 0 : 100)); }, [speakerMuted, remotes]);


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
    setMusicTitle(title); setMusicPlaying(true);
  }, [startMusicSource]);

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
    if (musicGainRef.current) musicGainRef.current.gain.value = Math.max(0, Math.min(1, v / 100));
  }, []);

  return { status, error, remotes, speakingUids, localAudioTrack, requestMic, musicPlaying, musicTitle, playMusicFile, pauseMusic, resumeMusic, stopMusic, setMusicVolume, muted, speakerMuted, videoOn, micBlocked, micError, localVideoTrack, localAudioPublished: { current: !muted }, toggleMute, toggleSpeaker, toggleVideo, disconnect };
}
