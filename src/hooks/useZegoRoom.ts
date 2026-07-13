import { useEffect, useRef, useState, useCallback } from "react";
import type {
  ZegoLocalStreamConfig,
  ZegoStreamList,
} from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web";
// The default export is the ZegoExpressEngine class; type it structurally
// to avoid pulling the whole class type surface (which varies between
// SDK versions).
type ZegoEngine = {
  loginRoom: (roomID: string, token: string, user: { userID: string; userName: string }, config?: Record<string, unknown>) => Promise<unknown>;
  logoutRoom: (roomID: string) => Promise<unknown>;
  renewToken: (roomID: string, token: string) => Promise<unknown>;
  createZegoStream: (cfg: ZegoLocalStreamConfig) => Promise<MediaStream>;
  destroyStream: (stream: MediaStream) => void;
  startPublishingStream: (streamID: string, stream: MediaStream, config?: Record<string, unknown>) => void;
  stopPublishingStream: (streamID: string) => void;
  mutePublishStreamAudio: (stream: MediaStream, mute: boolean) => void;
  startPlayingStream: (streamID: string, options?: Record<string, unknown>) => Promise<MediaStream> | MediaStream;
  stopPlayingStream: (streamID: string) => void;
  mutePlayStreamAudio: (streamID: string, mute: boolean) => void;
  setPlayVolume: (streamID: string, volume: number) => void;
  destroyEngine: () => void;
  setLogConfig: (cfg: Record<string, unknown>) => void;
  startSoundLevelMonitor?: (cfgOrMs?: number | { millisecond?: number }) => void;
  stopSoundLevelMonitor?: () => void;
  on: (event: string, cb: (...args: never[]) => void) => void;
  off: (event: string, cb?: (...args: never[]) => void) => void;
};
import { supabase } from "@/integrations/supabase/client";

// -------------------------------------------------------------------------
// Module-scope SDK loader — mirrors the old useAgoraRoom pattern so mic
// requests initiated by a click handler don't lose the user-gesture chain.
// -------------------------------------------------------------------------
type ZegoCtor = new (appId: number, server: string) => ZegoEngine;
type ZegoExpressModule = { ZegoExpressEngine: ZegoCtor };

let cachedZegoModule: ZegoExpressModule | null = null;
let zegoLoader: Promise<ZegoExpressModule> | null = null;

function loadZego(): Promise<ZegoExpressModule> {
  if (cachedZegoModule) return Promise.resolve(cachedZegoModule);
  if (!zegoLoader) {
    zegoLoader = import("zego-express-engine-webrtc").then((m) => {
      const mod = m as unknown as ZegoExpressModule;
      cachedZegoModule = mod;
      return mod;
    });
  }
  return zegoLoader;
}

// -------------------------------------------------------------------------
// Facades that keep the public shape of the old Agora hook so the room
// component doesn't have to change. Remote users expose `audioTrack` +
// `videoTrack` objects with `.play(container|null)`, `.stop()`,
// `.setVolume(v)` matching Agora Web SDK ergonomics.
// -------------------------------------------------------------------------
export type RemoteVideoTrack = {
  play: (container: HTMLElement, opts?: { fit?: "cover" | "contain" }) => void;
  stop: () => void;
};
export type RemoteAudioTrack = {
  setVolume: (v: number) => void; // 0..100 (Agora convention)
  play: () => void;
  stop: () => void;
};
export type RemoteUser = {
  uid: number;
  hasAudio: boolean;
  hasVideo: boolean;
  videoTrack?: RemoteVideoTrack;
  audioTrack?: RemoteAudioTrack;
};

export type AgoraStatus = "idle" | "connecting" | "connected" | "error" | "disabled";

export type UseZegoRoomArgs = {
  channel: string | null;
  uid: number | null;
  publish: boolean;
  video: boolean;
  enabled: boolean;
  kind?: "voice" | "video" | "pk";
};

// -------------------------------------------------------------------------
// Local music track type — we drive ZEGO's MediaPlayer + auxiliary stream
// to reproduce Agora's createBufferSourceAudioTrack behavior.
// -------------------------------------------------------------------------
type ZegoMediaPlayerLike = {
  loadResource: (url: string) => Promise<unknown>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  enableAux?: (enable: boolean) => void;
  destroy?: () => void;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};

async function fetchToken(
  channel: string,
  uid: number,
  role: "publisher" | "audience",
) {
  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) throw new Error("Sign in first");
  const res = await fetch("/api/zego-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ channel, uid, role }),
  });
  const data = (await res.json()) as {
    error?: string;
    appId?: number;
    token?: string;
    uid?: string | number;
    channel?: string;
    server?: string;
    expiresAt?: number;
  };
  if (!res.ok || !data.token || !data.appId || !data.server) {
    throw new Error(data.error ?? "token failed");
  }
  return {
    appId: data.appId,
    token: data.token,
    uid: String(data.uid ?? uid),
    channel: data.channel ?? channel,
    server: data.server,
  };
}

// One shared engine per app id. ZEGO recommends a single ZegoExpressEngine
// instance for the whole page lifetime.
let sharedEngine: ZegoEngine | null = null;
let sharedEngineAppId: number | null = null;

async function getEngine(appId: number, server: string): Promise<ZegoEngine> {
  if (sharedEngine && sharedEngineAppId === appId) return sharedEngine;
  const { ZegoExpressEngine } = await loadZego();
  if (sharedEngine) {
    try { sharedEngine.destroyEngine(); } catch { /* ignore */ }
    sharedEngine = null;
  }
  const engine = new ZegoExpressEngine(appId, server);
  try { engine.setLogConfig({ logLevel: "disable" as never }); } catch { /* older SDK: ignore */ }
  sharedEngine = engine;
  sharedEngineAppId = appId;
  return engine;
}

function streamIdFor(channel: string, uid: number | string) {
  return `${channel}_${uid}_main`;
}

export function useZegoRoom({
  channel,
  uid,
  publish,
  video,
  enabled,
}: UseZegoRoomArgs) {
  const engineRef = useRef<ZegoEngine | null>(null);
  const joinSeqRef = useRef(0);
  const currentRoomRef = useRef<string | null>(null);
  const currentUserRef = useRef<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioPublishedRef = useRef(false);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  // Raw camera stream (pre-processing) — kept so we can stop the physical
  // camera when toggling video off, even if the published stream is a
  // canvas-processed derivative.
  const localRawCameraRef = useRef<MediaStream | null>(null);
  // Callback to tear down the CamPipeline processor set by the room UI.
  const localPipelineReleaseRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<AgoraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(true);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const speakerMutedRef = useRef(false);
  const [videoOn, setVideoOn] = useState(false);
  const [localVideoTrackFacade, setLocalVideoTrackFacade] = useState<RemoteVideoTrack | null>(null);

  // Wrap a ZegoLocalStream (returned by createZegoStream) in a RemoteVideoTrack-shaped
  // facade so the UI can attach the local preview to any container div via `.play(el)`.
  function makeLocalFacade(cam: MediaStream, opts?: { mirror?: boolean; useZegoPlayer?: boolean }): RemoteVideoTrack {
    const mirror = opts?.mirror ?? true;
    const useZegoPlayer = opts?.useZegoPlayer ?? true;
    const zls = cam as unknown as {
      playVideo?: (view: HTMLElement, cfg?: unknown) => void;
      stop?: () => void;
    };
    let mounted: HTMLElement | null = null;
    return {
      play(container: HTMLElement, playOpts?: { fit?: "cover" | "contain" }) {
        mounted = container;
        try {
          if (useZegoPlayer && typeof zls.playVideo === "function") {
            zls.playVideo(container, { objectFit: playOpts?.fit ?? "cover", mirror: mirror ? 1 : 0 });
            return;
          }
        } catch { /* fall through */ }
        // Fallback: raw MediaStream
        let v = container.querySelector("video") as HTMLVideoElement | null;
        if (!v) {
          v = document.createElement("video");
          v.autoplay = true;
          v.muted = true;
          v.playsInline = true;
          v.style.width = "100%";
          v.style.height = "100%";
          v.style.objectFit = playOpts?.fit ?? "cover";
          v.style.transform = mirror ? "scaleX(-1)" : "none";
          container.appendChild(v);
        }
        v.srcObject = cam as MediaStream;
        v.play().catch(() => { /* gesture may be needed */ });
      },
      stop() {
        const el = mounted;
        mounted = null;
        if (el) {
          const v = el.querySelector("video");
          if (v) v.remove();
        }
      },
    };
  }
  const [micBlocked, setMicBlocked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const micErrorRef = useRef<string | null>(null);

  const musicPlayerRef = useRef<ZegoMediaPlayerLike | null>(null);
  const musicUrlRef = useRef<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  // Serialize room leaves so a new join always waits for the previous
  // logoutRoom to complete — same "no self-echo on seat change" invariant
  // the Agora hook enforced.
  const leaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Track which remote streams belong to which uid so we can build the
  // RemoteUser facade.
  const streamToUidRef = useRef<Map<string, number>>(new Map());
  const uidStreamRef = useRef<Map<number, string>>(new Map()); // audio (main) streamID per uid
  const uidVideoStreamRef = useRef<Map<number, string>>(new Map()); // video (_cam_main) streamID per uid
  const videoContainersRef = useRef<Map<number, HTMLElement>>(new Map());
  const remoteMediaStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remotePlayPromisesRef = useRef<Map<string, Promise<MediaStream | null>>>(new Map());
  // Hidden <audio> elements per remote stream so viewers actually hear voices.
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [speakingUids, setSpeakingUids] = useState<Set<number>>(new Set());


  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------
  const setMicIssue = useCallback((message: string | null, blocked: boolean) => {
    micErrorRef.current = message;
    setMicError(message);
    setMicBlocked(blocked);
  }, []);

  const getRemoteMediaStream = useCallback((engine: ZegoEngine, streamID: string) => {
    const cached = remoteMediaStreamsRef.current.get(streamID);
    if (cached) return Promise.resolve(cached);
    const pending = remotePlayPromisesRef.current.get(streamID);
    if (pending) return pending;

    const next = Promise.resolve(
      engine.startPlayingStream(streamID) as unknown as MediaStream | Promise<MediaStream>,
    )
      .then((ms) => {
        if (ms) remoteMediaStreamsRef.current.set(streamID, ms);
        remotePlayPromisesRef.current.delete(streamID);
        return ms ?? null;
      })
      .catch(() => {
        remotePlayPromisesRef.current.delete(streamID);
        return null;
      });
    remotePlayPromisesRef.current.set(streamID, next);
    return next;
  }, []);

  const closeLocalTracks = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      localStreamRef.current = null;
      localAudioPublishedRef.current = false;
    }
    const vstream = localVideoStreamRef.current;
    if (vstream) {
      try { vstream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      localVideoStreamRef.current = null;
      setLocalVideoTrackFacade(null);
    }
    const mp = musicPlayerRef.current;
    if (mp) {
      try { mp.stop(); } catch { /* ignore */ }
      try { mp.destroy?.(); } catch { /* ignore */ }
      musicPlayerRef.current = null;
    }
    if (musicUrlRef.current) {
      try { URL.revokeObjectURL(musicUrlRef.current); } catch { /* ignore */ }
      musicUrlRef.current = null;
    }
    setMusicPlaying(false);
    setMusicTitle(null);
  }, []);

  const stopMicTrack = useCallback(async (engine?: ZegoEngine | null) => {
    const room = currentRoomRef.current;
    const localUid = currentUserRef.current;
    if (engine && room && localUid && localAudioPublishedRef.current) {
      try { engine.stopPublishingStream(streamIdFor(room, localUid)); } catch { /* ignore */ }
    }
    const stream = localStreamRef.current;
    if (stream) {
      try {
        engine?.destroyStream(stream);
      } catch { /* ignore */ }
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    }
    localStreamRef.current = null;
    localAudioPublishedRef.current = false;
    setMuted(true);
  }, []);

  // -----------------------------------------------------------------------
  // Build a RemoteUser facade around a ZEGO stream. `remoteStream` may not
  // be available yet — video attaches via `startPlayingStream` on demand
  // when the room UI mounts a container.
  // -----------------------------------------------------------------------
  const makeRemoteFacade = useCallback((
    engine: ZegoEngine,
    remoteUid: number,
    streamID: string,
    kind: "audio" | "video",
  ): RemoteUser => {
    const audio: RemoteAudioTrack = {
      setVolume: (v: number) => {
        try { engine.setPlayVolume(streamID, Math.max(0, Math.min(100, v))); } catch { /* ignore */ }
      },
      play: () => {
        try { engine.mutePlayStreamAudio(streamID, false); } catch { /* ignore */ }
      },
      stop: () => {
        try { engine.mutePlayStreamAudio(streamID, true); } catch { /* ignore */ }
      },
    };
    const video: RemoteVideoTrack = {
      play: (container: HTMLElement) => {
        videoContainersRef.current.set(remoteUid, container);
        // Ensure a <video> element is inside the container.
        let v = container.querySelector("video") as HTMLVideoElement | null;
        if (!v) {
          v = document.createElement("video");
          v.autoplay = true;
          v.playsInline = true;
          v.muted = true; // audio is delivered via startPlayingStream separately
          v.style.width = "100%";
          v.style.height = "100%";
          v.style.objectFit = "cover";
          container.appendChild(v);
        }
        void getRemoteMediaStream(engine, streamID).then((ms) => {
          if (!ms || !v || videoContainersRef.current.get(remoteUid) !== container) return;
          v.srcObject = ms;
          v.play().catch(() => { /* gesture may be needed */ });
        });
      },
      stop: () => {
        const container = videoContainersRef.current.get(remoteUid);
        const v = container?.querySelector("video") as HTMLVideoElement | null;
        if (v) v.srcObject = null;
        videoContainersRef.current.delete(remoteUid);
      },
    };
    return {
      uid: remoteUid,
      hasAudio: kind === "audio",
      hasVideo: kind === "video",
      audioTrack: audio,
      videoTrack: kind === "video" ? video : undefined,
    };
  }, [getRemoteMediaStream]);

  // -----------------------------------------------------------------------
  // Main join / leave effect. Preserves the Agora hook's semantics:
  //   • sequence counter cancels stale joins
  //   • serialized leaveQueue so back-to-back joins never overlap
  //   • silence outgoing subscribers immediately during cleanup
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !channel || uid == null) {
      joinSeqRef.current += 1;
      const stale = engineRef.current;
      const staleRoom = currentRoomRef.current;
      const staleUser = currentUserRef.current;
      engineRef.current = null;
      currentRoomRef.current = null;
      currentUserRef.current = null;
      if (stale && staleRoom) {
        // Silence any playing remotes on the way out.
        for (const [, sid] of uidStreamRef.current)
          try { stale.mutePlayStreamAudio(sid, true); } catch { /* ignore */ }
        try { stale.off("roomStreamUpdate"); } catch { /* ignore */ }
        try { stale.off("roomUserUpdate"); } catch { /* ignore */ }
        try { stale.off("roomStateUpdate"); } catch { /* ignore */ }
        try { stale.off("publisherStateUpdate"); } catch { /* ignore */ }
        try { stale.off("tokenWillExpire"); } catch { /* ignore */ }
        try { stale.off("remoteSoundLevelUpdate"); } catch { /* ignore */ }
        try { stale.off("capturedSoundLevelUpdate"); } catch { /* ignore */ }
        try { stale.stopSoundLevelMonitor?.(); } catch { /* ignore */ }
        if (staleUser && localAudioPublishedRef.current) {
          try { stale.stopPublishingStream(streamIdFor(staleRoom, staleUser)); } catch { /* ignore */ }
        }
        if (staleUser && localVideoStreamRef.current) {
          try { stale.stopPublishingStream(streamIdFor(staleRoom, `${staleUser}_cam`)); } catch { /* ignore */ }
        }
        leaveQueueRef.current = leaveQueueRef.current
          .then(async () => { try { await stale.logoutRoom(staleRoom); } catch { /* ignore */ } });
      }
      closeLocalTracks();
      streamToUidRef.current.clear();
      uidStreamRef.current.clear();
      uidVideoStreamRef.current.clear();
      videoContainersRef.current.clear();
      remoteMediaStreamsRef.current.clear();
      remotePlayPromisesRef.current.clear();
      for (const [, el] of audioElsRef.current) {
        try { el.srcObject = null; el.remove(); } catch { /* ignore */ }
      }
      audioElsRef.current.clear();
      setSpeakingUids(new Set());
      setRemotes(new Map());
      setMuted(true);
      setVideoOn(false);
      setMicIssue(null, false);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const joinSeq = ++joinSeqRef.current;
    const isCurrentJoin = () => !cancelled && joinSeqRef.current === joinSeq;
    let boundEngine: ZegoEngine | null = null;
    const localUidStr = String(uid);
    const channelName = channel;

    (async () => {
      try { await leaveQueueRef.current; } catch { /* ignore */ }
      if (!isCurrentJoin()) return;

      setStatus("connecting");
      setError(null);

      let tokenData: Awaited<ReturnType<typeof fetchToken>>;
      try {
        tokenData = await fetchToken(channelName, uid, publish ? "publisher" : "audience");
      } catch (e) {
        if (!isCurrentJoin()) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus(msg.toLowerCase().includes("not configured") ? "disabled" : "error");
        return;
      }
      if (!isCurrentJoin()) return;

      const engine = await getEngine(tokenData.appId, tokenData.server);
      if (!isCurrentJoin()) return;
      boundEngine = engine;
      engineRef.current = engine;
      currentRoomRef.current = channelName;
      currentUserRef.current = localUidStr;

      // Clear any prior listeners (single engine handles one room at a time).
      try { engine.off("roomStreamUpdate"); } catch { /* ignore */ }
      try { engine.off("roomUserUpdate"); } catch { /* ignore */ }
      try { engine.off("roomStateUpdate"); } catch { /* ignore */ }
      try { engine.off("publisherStateUpdate"); } catch { /* ignore */ }
      try { engine.off("tokenWillExpire"); } catch { /* ignore */ }

      engine.on(
        "roomStreamUpdate",
        (roomID: string, updateType: "ADD" | "DELETE", streamList: ZegoStreamList[]) => {
          if (!isCurrentJoin() || roomID !== channelName) return;
          if (updateType === "ADD") {
            for (const s of streamList) {
              const remoteUidRaw = s.user?.userID ?? "";
              const remoteUid = Number(remoteUidRaw);
              if (!Number.isFinite(remoteUid) || remoteUid === uid) continue;
              const isVideo = /_cam_main$/.test(s.streamID);
              streamToUidRef.current.set(s.streamID, remoteUid);
              if (isVideo) uidVideoStreamRef.current.set(remoteUid, s.streamID);
              else uidStreamRef.current.set(remoteUid, s.streamID);
              // Start playing (audio) immediately — video will be attached
              // to a container by the UI via videoTrack.play(...).
              try {
                void getRemoteMediaStream(engine, s.streamID)
                  .then((ms) => {
                    if (!ms) return;
                    if (isVideo) {
                      const container = videoContainersRef.current.get(remoteUid);
                      const v = container?.querySelector("video") as HTMLVideoElement | null;
                      if (v) {
                        v.srcObject = ms;
                        v.play().catch(() => { /* gesture may be needed */ });
                      }
                      return;
                    }
                    // Attach to a hidden <audio> element so viewers hear it.
                    let el = audioElsRef.current.get(s.streamID);
                    if (!el) {
                      el = document.createElement("audio");
                      el.autoplay = true;
                      (el as unknown as { playsInline?: boolean }).playsInline = true;
                      el.style.display = "none";
                      document.body.appendChild(el);
                      audioElsRef.current.set(s.streamID, el);
                    }
                    el.srcObject = ms;
                    el.muted = speakerMutedRef.current;
                    el.play().catch(() => { /* gesture may be needed */ });
                  })
                  .catch(() => { /* ignore */ });
              } catch { /* ignore */ }
              if (speakerMutedRef.current) {
                try { engine.mutePlayStreamAudio(s.streamID, true); } catch { /* ignore */ }
              }

              setRemotes((prev) => {
                const next = new Map(prev);
                const existing = next.get(remoteUid);
                const audioSid = uidStreamRef.current.get(remoteUid);
                const videoSid = uidVideoStreamRef.current.get(remoteUid);
                const audioFacade = audioSid
                  ? makeRemoteFacade(engine, remoteUid, audioSid, "audio")
                  : existing?.audioTrack
                    ? { audioTrack: existing.audioTrack } as unknown as RemoteUser
                    : undefined;
                const videoFacade = videoSid
                  ? makeRemoteFacade(engine, remoteUid, videoSid, "video")
                  : undefined;
                next.set(remoteUid, {
                  uid: remoteUid,
                  hasAudio: !!audioSid,
                  hasVideo: !!videoSid,
                  audioTrack: audioFacade?.audioTrack ?? existing?.audioTrack,
                  videoTrack: videoFacade?.videoTrack ?? existing?.videoTrack,
                });
                return next;
              });
            }
          } else {
            for (const s of streamList) {
              try { engine.stopPlayingStream(s.streamID); } catch { /* ignore */ }
              remoteMediaStreamsRef.current.delete(s.streamID);
              remotePlayPromisesRef.current.delete(s.streamID);
              const el = audioElsRef.current.get(s.streamID);
              if (el) {
                try { el.srcObject = null; el.remove(); } catch { /* ignore */ }
                audioElsRef.current.delete(s.streamID);
              }
              const remoteUid = streamToUidRef.current.get(s.streamID);
              const wasVideo = /_cam_main$/.test(s.streamID);
              streamToUidRef.current.delete(s.streamID);
              if (remoteUid != null) {
                if (wasVideo) {
                  const container = videoContainersRef.current.get(remoteUid);
                  const v = container?.querySelector("video") as HTMLVideoElement | null;
                  if (v) v.srcObject = null;
                  uidVideoStreamRef.current.delete(remoteUid);
                  videoContainersRef.current.delete(remoteUid);
                } else {
                  uidStreamRef.current.delete(remoteUid);
                }
                const stillAudio = uidStreamRef.current.get(remoteUid);
                const stillVideo = uidVideoStreamRef.current.get(remoteUid);
                setRemotes((prev) => {
                  const next = new Map(prev);
                  if (!stillAudio && !stillVideo) {
                    next.delete(remoteUid);
                  } else {
                    const existing = next.get(remoteUid);
                    if (existing) {
                      next.set(remoteUid, {
                        ...existing,
                        hasAudio: !!stillAudio,
                        hasVideo: !!stillVideo,
                        videoTrack: stillVideo ? existing.videoTrack : undefined,
                        audioTrack: stillAudio ? existing.audioTrack : undefined,
                      });
                    }
                  }
                  return next;
                });
              }
            }
          }
        },
      );

      engine.on(
        "roomUserUpdate",
        (roomID: string, updateType: "ADD" | "DELETE", userList: { userID: string }[]) => {
          if (roomID !== channelName || updateType !== "DELETE") return;
          for (const u of userList) {
            const remoteUid = Number(u.userID);
            if (!Number.isFinite(remoteUid)) continue;
            const sid = uidStreamRef.current.get(remoteUid);
            if (sid) {
              try { engine.stopPlayingStream(sid); } catch { /* ignore */ }
              remoteMediaStreamsRef.current.delete(sid);
              remotePlayPromisesRef.current.delete(sid);
              streamToUidRef.current.delete(sid);
            }
            const videoSid = uidVideoStreamRef.current.get(remoteUid);
            if (videoSid) {
              try { engine.stopPlayingStream(videoSid); } catch { /* ignore */ }
              remoteMediaStreamsRef.current.delete(videoSid);
              remotePlayPromisesRef.current.delete(videoSid);
              streamToUidRef.current.delete(videoSid);
            }
            uidStreamRef.current.delete(remoteUid);
            uidVideoStreamRef.current.delete(remoteUid);
            videoContainersRef.current.delete(remoteUid);
            setRemotes((prev) => {
              const next = new Map(prev);
              next.delete(remoteUid);
              return next;
            });
          }
        },
      );

      engine.on(
        "tokenWillExpire",
        async (roomID: string) => {
          if (roomID !== channelName) return;
          try {
            const fresh = await fetchToken(
              channelName,
              uid,
              publish ? "publisher" : "audience",
            );
            await engine.renewToken(channelName, fresh.token);
          } catch (e) {
            console.warn("[zego] token renew failed", e);
          }
        },
      );

      engine.on(
        "roomStateUpdate",
        (roomID: string, state: string, _errorCode: number, _extendedData: string) => {
          if (roomID !== channelName || !isCurrentJoin()) return;
          if (state === "CONNECTED") setStatus("connected");
          else if (state === "DISCONNECTED") setStatus("error");
        },
      );

      // Sound-level events → drive the DP speaking ring.
      const SPEAK_THRESHOLD = 5; // 0..100
      engine.on(
        "remoteSoundLevelUpdate",
        (levels: Record<string, number>) => {
          if (!isCurrentJoin()) return;
          setSpeakingUids((prev) => {
            const next = new Set(prev);
            for (const [sid, lvl] of Object.entries(levels ?? {})) {
              const u = streamToUidRef.current.get(sid);
              if (u == null) continue;
              if (lvl >= SPEAK_THRESHOLD) next.add(u);
              else next.delete(u);
            }
            return next;
          });
        },
      );
      engine.on(
        "capturedSoundLevelUpdate",
        (level: number) => {
          if (!isCurrentJoin() || uid == null) return;
          setSpeakingUids((prev) => {
            const has = prev.has(uid);
            const speaking = level >= SPEAK_THRESHOLD;
            if (speaking === has) return prev;
            const next = new Set(prev);
            if (speaking) next.add(uid);
            else next.delete(uid);
            return next;
          });
        },
      );

      try {

        // ZEGO recommends userUpdate:true so roomUserUpdate fires for existing users.
        await engine.loginRoom(
          channelName,
          tokenData.token,
          { userID: localUidStr, userName: localUidStr },
          { userUpdate: true },
        );
        try { engine.startSoundLevelMonitor?.({ millisecond: 300 }); } catch { /* ignore */ }
        if (isCurrentJoin()) setStatus("connected");
      } catch (e) {
        if (!isCurrentJoin()) return;
        console.error("[zego] loginRoom failed", e);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      const e = boundEngine;
      const room = channelName;
      const userIdStr = localUidStr;
      if (e) {
        for (const [, sid] of uidStreamRef.current)
          try { e.mutePlayStreamAudio(sid, true); } catch { /* ignore */ }
        try { e.off("roomStreamUpdate"); } catch { /* ignore */ }
        try { e.off("roomUserUpdate"); } catch { /* ignore */ }
        try { e.off("roomStateUpdate"); } catch { /* ignore */ }
        try { e.off("publisherStateUpdate"); } catch { /* ignore */ }
        try { e.off("tokenWillExpire"); } catch { /* ignore */ }
        try { e.off("remoteSoundLevelUpdate"); } catch { /* ignore */ }
        try { e.off("capturedSoundLevelUpdate"); } catch { /* ignore */ }
        try { e.stopSoundLevelMonitor?.(); } catch { /* ignore */ }
        if (localAudioPublishedRef.current) {
          try { e.stopPublishingStream(streamIdFor(room, userIdStr)); } catch { /* ignore */ }
        }
        if (localVideoStreamRef.current) {
          try { e.stopPublishingStream(streamIdFor(room, `${userIdStr}_cam`)); } catch { /* ignore */ }
        }
      }
      if (engineRef.current === e) engineRef.current = null;
      currentRoomRef.current = null;
      currentUserRef.current = null;
      closeLocalTracks();
      streamToUidRef.current.clear();
      uidStreamRef.current.clear();
      uidVideoStreamRef.current.clear();
      videoContainersRef.current.clear();
      remoteMediaStreamsRef.current.clear();
      remotePlayPromisesRef.current.clear();
      for (const [, el] of audioElsRef.current) {
        try { el.srcObject = null; el.remove(); } catch { /* ignore */ }
      }
      audioElsRef.current.clear();
      setSpeakingUids(new Set());
      setRemotes(new Map());
      setMuted(true);
      setVideoOn(false);
      setMicIssue(null, false);
      if (e) {
        leaveQueueRef.current = leaveQueueRef.current
          .then(async () => { try { await e.logoutRoom(room); } catch { /* ignore */ } });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channel, uid, publish, video]);

  // -----------------------------------------------------------------------
  // Publish mic — same contract as Agora hook.
  // -----------------------------------------------------------------------
  const requestMic = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    let engine = engineRef.current;
    for (let i = 0; i < 20 && !engineRef.current; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    engine = engineRef.current;
    const room = currentRoomRef.current;
    const localUid = currentUserRef.current;
    if (!engine || !room || !localUid) {
      const message = "Room connection not ready yet. Please try again in a moment.";
      setMicIssue(message, false);
      return { ok: false, error: message };
    }
    // Wait for the room to reach CONNECTED before publishing.
    for (let i = 0; i < 80 && (status as string) !== "connected"; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const mapMediaError = (e: unknown): string => {
      const err = e as { name?: string; code?: string | number; message?: string };
      const name = String(err?.name ?? err?.code ?? "");
      if (name === "NotAllowedError" || name === "PERMISSION_DENIED" || name.includes("1103064"))
        return "Microphone permission denied. Tap the 🔒 icon in the address bar → Site settings → Microphone → Allow.";
      if (name === "NotFoundError" || name === "DEVICE_NOT_FOUND")
        return "No microphone found on this device.";
      if (name === "NotReadableError")
        return "Microphone is in use by another app. Close it and try again.";
      if (name === "SecurityError")
        return "Microphone blocked — the page must be served over HTTPS.";
      return err?.message ?? "Could not access microphone.";
    };
    const isPermDenied = (e: unknown) => {
      const n = String((e as { name?: string; code?: string })?.name ??
        (e as { code?: string })?.code ?? "");
      return n === "NotAllowedError" || n === "PERMISSION_DENIED" || n.includes("1103064");
    };

    if (!localStreamRef.current) {
      try {
        const cfg: ZegoLocalStreamConfig = { camera: { audio: true, video: false } };
        localStreamRef.current = await engine.createZegoStream(cfg);
      } catch (e) {
        console.warn("[zego] createZegoStream failed", e);
        const message = mapMediaError(e);
        setMicIssue(message, isPermDenied(e));
        return { ok: false, error: message };
      }
    }

    try {
      // Refresh token as publisher — mirror useAgoraRoom pre-publish upgrade.
      const fresh = await fetchToken(room, Number(localUid), "publisher");
      try { await engine.renewToken(room, fresh.token); } catch { /* ignore */ }
    } catch (e) {
      console.warn("[zego] publisher token upgrade failed", e);
    }

    if (!localAudioPublishedRef.current) {
      try {
        engine.startPublishingStream(streamIdFor(room, localUid), localStreamRef.current);
        localAudioPublishedRef.current = true;
      } catch (e) {
        console.error("[zego] startPublishingStream failed", e);
        const raw = e instanceof Error ? e.message : String(e);
        const message = `Could not publish mic: ${raw}`;
        setMicIssue(message, false);
        return { ok: false, error: message };
      }
    }
    try { engine.mutePublishStreamAudio(localStreamRef.current, false); } catch { /* ignore */ }

    setMuted(false);
    setMicIssue(null, false);
    return { ok: true };
  }, [setMicIssue, status]);

  const toggleMute = useCallback(async () => {
    if (!localStreamRef.current || !localAudioPublishedRef.current) {
      await requestMic();
      return;
    }
    const next = !muted;
    if (next) {
      // Fully stop the mic — matches Agora hook's mobile-safety cleanup so
      // users don't keep hearing themselves after a mute tap.
      await stopMicTrack(engineRef.current);
      setMicIssue(null, false);
      return;
    }
    try {
      engineRef.current?.mutePublishStreamAudio(localStreamRef.current, false);
      setMuted(false);
      setMicIssue(null, false);
    } catch (e) {
      console.error("[zego] unmute failed", e);
    }
  }, [muted, requestMic, setMicIssue, stopMicTrack]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerMuted((prev) => {
      const next = !prev;
      speakerMutedRef.current = next;
      const engine = engineRef.current;
      if (engine) {
        for (const [, sid] of uidStreamRef.current) {
          try {
            engine.mutePlayStreamAudio(sid, next);
            if (!next) engine.setPlayVolume(sid, 100);
          } catch { /* ignore */ }
        }
      }
      for (const [, el] of audioElsRef.current) {
        try { el.muted = next; } catch { /* ignore */ }
      }
      return next;
    });
  }, []);

  const toggleVideo = useCallback(async (options?: {
    processStream?: (raw: MediaStream) => Promise<MediaStream>;
    releaseProcessor?: () => void;
  }) => {
    const engine = engineRef.current;
    const room = currentRoomRef.current;
    const localUid = currentUserRef.current;
    if (!engine || !room || !localUid) {
      setMicIssue("Not connected to room yet — try again in a moment", false);
      return false;
    }

    if (localVideoStreamRef.current) {
      // Stop the video-only companion stream.
      try {
        engine.stopPublishingStream(streamIdFor(room, `${localUid}_cam`));
      } catch { /* ignore */ }
      try { engine.destroyStream(localVideoStreamRef.current); } catch { /* ignore */ }
      try {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
      localVideoStreamRef.current = null;
      // Stop the raw camera tracks + tear down the CamPipeline processor.
      try { localRawCameraRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      localRawCameraRef.current = null;
      try { localPipelineReleaseRef.current?.(); } catch { /* ignore */ }
      localPipelineReleaseRef.current = null;
      setLocalVideoTrackFacade(null);
      setVideoOn(false);
      return true;
    }
    if (status !== "connected") {
      setMicIssue("Still connecting to room — try again in a moment", false);
      return false;
    }
    try {
      let publishStream: MediaStream;
      let usedProcessing = false;
      if (options?.processStream) {
        // Grab raw camera ourselves so we can hand it to the processor.
        const raw = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        localRawCameraRef.current = raw;
        const processed = await options.processStream(raw);
        usedProcessing = processed !== raw;
        if (usedProcessing) {
          publishStream = await engine.createZegoStream({ custom: { source: processed } });
        } else {
          // Bypass — publish the raw camera directly via custom source
          publishStream = await engine.createZegoStream({ custom: { source: raw } });
        }
        localPipelineReleaseRef.current = options.releaseProcessor ?? null;
      } else {
        publishStream = await engine.createZegoStream({ camera: { audio: false, video: true } });
      }
      engine.startPublishingStream(streamIdFor(room, `${localUid}_cam`), publishStream);
      localVideoStreamRef.current = publishStream;
      setLocalVideoTrackFacade(makeLocalFacade(publishStream, {
        // Processed frames are already mirrored by the canvas, so don't
        // double-mirror in the preview element.
        mirror: !usedProcessing,
        useZegoPlayer: !usedProcessing,
      }));
      setVideoOn(true);
      setMicIssue(null, false);
      return true;
    } catch (e) {
      const failed = localVideoStreamRef.current;
      if (failed) {
        try { engine.destroyStream(failed); } catch { /* ignore */ }
        try { failed.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      }
      localVideoStreamRef.current = null;
      try { localRawCameraRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      localRawCameraRef.current = null;
      try { localPipelineReleaseRef.current?.(); } catch { /* ignore */ }
      localPipelineReleaseRef.current = null;
      setLocalVideoTrackFacade(null);
      setVideoOn(false);
      console.warn("[zego] camera failed", e);
      const err = e as { name?: string; message?: string };
      const blocked = err?.name === "NotAllowedError" || /permission|denied/i.test(err?.message ?? "");
      const notFound = err?.name === "NotFoundError" || /not\s*found|no.*device/i.test(err?.message ?? "");
      setMicIssue(
        blocked
          ? "Camera permission denied — allow camera in browser settings"
          : notFound
            ? "No camera found on this device"
            : `Camera failed: ${err?.message ?? "unknown error"}`,
        blocked,
      );
      return false;
    }
  }, [status, setMicIssue]);

  // -----------------------------------------------------------------------
  // Host music playback via ZEGO MediaPlayer + enableAux(true) so remote
  // users hear the track mixed into the host's published audio.
  // -----------------------------------------------------------------------
  const ensureMusicPlayer = useCallback(async (): Promise<ZegoMediaPlayerLike> => {
    const engine = engineRef.current as unknown as {
      createMediaPlayer: () => Promise<ZegoMediaPlayerLike> | ZegoMediaPlayerLike;
    } | null;
    if (!engine) throw new Error("Not connected to room yet");
    if (musicPlayerRef.current) return musicPlayerRef.current;
    const mp = await engine.createMediaPlayer();
    try {
      mp.on?.("playerStateUpdate", (arg: unknown) => {
        const st = (arg as { state?: string })?.state ?? String(arg);
        if (st === "PLAYING" || st === "playing") setMusicPlaying(true);
        else if (st === "NO_PLAY" || st === "PAUSING" || st === "pausing" || st === "STOPPED")
          setMusicPlaying(false);
      });
    } catch { /* older SDK — ignore */ }
    musicPlayerRef.current = mp;
    return mp;
  }, []);

  const playMusicFile = useCallback(async (file: Blob, title: string) => {
    const engine = engineRef.current;
    if (!engine) throw new Error("Not connected to room yet");
    if (status !== "connected") throw new Error("Still connecting to room, please wait");
    if (!publish) throw new Error("Only host can play music");
    if (!localStreamRef.current || !localAudioPublishedRef.current) {
      throw new Error("Enable your mic before playing music");
    }

    const mp = await ensureMusicPlayer();
    // Stop previous
    try { mp.stop(); } catch { /* ignore */ }
    if (musicUrlRef.current) {
      try { URL.revokeObjectURL(musicUrlRef.current); } catch { /* ignore */ }
      musicUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    musicUrlRef.current = url;
    await mp.loadResource(url);
    try { mp.enableAux?.(true); } catch { /* ignore */ }
    mp.start();
    setMusicTitle(title);
    setMusicPlaying(true);
  }, [ensureMusicPlayer, publish, status]);

  const pauseMusic = useCallback(() => {
    const mp = musicPlayerRef.current;
    if (!mp) return;
    try { mp.pause(); } catch { /* ignore */ }
    setMusicPlaying(false);
  }, []);

  const resumeMusic = useCallback(() => {
    const mp = musicPlayerRef.current;
    if (!mp) return;
    try { mp.resume(); } catch { /* ignore */ }
    setMusicPlaying(true);
  }, []);

  const stopMusic = useCallback(async () => {
    const mp = musicPlayerRef.current;
    if (!mp) return;
    try { mp.enableAux?.(false); } catch { /* ignore */ }
    try { mp.stop(); } catch { /* ignore */ }
    try { mp.destroy?.(); } catch { /* ignore */ }
    musicPlayerRef.current = null;
    if (musicUrlRef.current) {
      try { URL.revokeObjectURL(musicUrlRef.current); } catch { /* ignore */ }
      musicUrlRef.current = null;
    }
    setMusicPlaying(false);
    setMusicTitle(null);
  }, []);

  const setMusicVolume = useCallback((v: number) => {
    try { musicPlayerRef.current?.setVolume(Math.max(0, Math.min(100, v))); } catch { /* ignore */ }
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
    requestMic,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    // Compatibility refs kept for the room component's guards.
    localAudioTrack: localStreamRef,
    localAudioPublished: localAudioPublishedRef,
    localVideoTrack: localVideoTrackFacade,
    // music
    musicPlaying,
    musicTitle,
    playMusicFile,
    pauseMusic,
    resumeMusic,
    stopMusic,
    setMusicVolume,
  };
}
