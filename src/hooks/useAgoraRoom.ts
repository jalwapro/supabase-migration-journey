import { useEffect, useRef, useState, useCallback } from "react";
import type {
  IAgoraRTC,
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IBufferSourceAudioTrack,
} from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";

// Cache the AgoraRTC module at module scope so requestMic() doesn't need to
// `await import()` inside a click handler — that await can break the
// user-gesture chain in Safari and cause getUserMedia to reject silently.
let cachedAgoraRTC: IAgoraRTC | null = null;
let agoraRTCLoader: Promise<IAgoraRTC> | null = null;
function loadAgoraRTC(): Promise<IAgoraRTC> {
  if (cachedAgoraRTC) return Promise.resolve(cachedAgoraRTC);
  if (!agoraRTCLoader) {
    agoraRTCLoader = import("agora-rtc-sdk-ng").then((m) => {
      cachedAgoraRTC = m.default;
      return m.default;
    });
  }
  return agoraRTCLoader;
}

async function preflightMicPermission(): Promise<{ ok: boolean; error?: string }> {
  try {
    const perms = (navigator as Navigator & {
      permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> };
    }).permissions;
    if (perms?.query) {
      const status = await perms.query({ name: "microphone" as PermissionName });
      if (status.state === "denied") {
        return {
          ok: false,
          error:
            "Microphone is blocked in browser settings. Tap the 🔒/ⓘ icon in the address bar → Site settings → Microphone → Allow, then reload.",
        };
      }
    }
  } catch {
    // Firefox/Safari may not support the microphone permission name — that's fine, fall through.
  }
  return { ok: true };
}

export type RemoteUser = {
  uid: number;
  hasAudio: boolean;
  hasVideo: boolean;
  videoTrack?: IAgoraRTCRemoteUser["videoTrack"];
  audioTrack?: IAgoraRTCRemoteUser["audioTrack"];
};

export type AgoraStatus = "idle" | "connecting" | "connected" | "error" | "disabled";

export type UseAgoraRoomArgs = {
  channel: string | null;
  uid: number | null;
  publish: boolean;         // true = take mic/camera
  video: boolean;           // true = also publish camera
  enabled: boolean;         // false = don't connect
  kind?: "voice" | "video" | "pk"; // which Agora pool to draw from
};

async function fetchToken(
  channel: string,
  uid: number,
  role: "publisher" | "audience",
  kind: "voice" | "video" | "pk",
) {
  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) throw new Error("Sign in first");
  const res = await fetch("/api/agora-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ channel, uid, role, kind }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "token failed");
  return data as { appId: string; token: string; uid: number; channel: string };
}

export function useAgoraRoom({ channel, uid, publish, video, enabled, kind }: UseAgoraRoomArgs) {
  const resolvedKind: "voice" | "video" | "pk" = kind ?? (video ? "video" : "voice");

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinSeqRef = useRef(0);
  const localAudioRef = useRef<ILocalAudioTrack | null>(null);
  const localAudioPublishedRef = useRef(false);
  const localVideoRef = useRef<ILocalVideoTrack | null>(null);
  const [status, setStatus] = useState<AgoraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(true);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const speakerMutedRef = useRef(false);
  const [videoOn, setVideoOn] = useState(video);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const micErrorRef = useRef<string | null>(null);

  const musicTrackRef = useRef<IBufferSourceAudioTrack | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  // Serialize Agora client leaves so a new join always waits for the previous
  // client to fully disconnect. Without this, two clients with the same uid
  // briefly overlap during a role change (viewer → seat) and the old audience
  // client subscribes to the new publisher — the user hears their own voice.
  const leaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const setMicIssue = useCallback((message: string | null, blocked: boolean) => {
    micErrorRef.current = message;
    setMicError(message);
    setMicBlocked(blocked);
  }, []);

  const closeLocalTracks = useCallback(() => {
    const audio = localAudioRef.current;
    if (audio) {
      try { audio.stop(); } catch { /* ignore */ }
      try { audio.close(); } catch { /* ignore */ }
      localAudioRef.current = null;
      localAudioPublishedRef.current = false;
    }
    const videoTrack = localVideoRef.current;
    if (videoTrack) {
      try { videoTrack.stop(); } catch { /* ignore */ }
      try { videoTrack.close(); } catch { /* ignore */ }
      localVideoRef.current = null;
    }
    const music = musicTrackRef.current;
    if (music) {
      try { music.stopProcessAudioBuffer(); } catch { /* ignore */ }
      try { music.close(); } catch { /* ignore */ }
      musicTrackRef.current = null;
      setMusicPlaying(false);
      setMusicTitle(null);
    }
  }, []);

  const stopMicTrack = useCallback(async (client?: IAgoraRTCClient | null) => {
    const audio = localAudioRef.current;
    if (audio) {
      try { await audio.setMuted(true); } catch { /* ignore */ }
      try {
        if (client && localAudioPublishedRef.current) await client.unpublish(audio);
      } catch { /* ignore */ }
      try { audio.stop(); } catch { /* ignore */ }
      try { audio.close(); } catch { /* ignore */ }
    }
    localAudioRef.current = null;
    localAudioPublishedRef.current = false;
    setMuted(true);
  }, []);


  useEffect(() => {
    if (!enabled || !channel || uid == null) {
      joinSeqRef.current += 1;
      const stale = clientRef.current;
      clientRef.current = null;
      if (stale) {
        try { stale.remoteUsers?.forEach((u) => u.audioTrack?.setVolume(0)); } catch { /* ignore */ }
        try { stale.removeAllListeners(); } catch { /* ignore */ }
        leaveQueueRef.current = leaveQueueRef.current
          .then(() => stale.leave())
          .catch(() => {});
      }
      closeLocalTracks();
      setRemotes(new Map());
      setStatus("idle");
      return;
    }
    let cancelled = false;
    const joinSeq = ++joinSeqRef.current;
    const isCurrentJoin = () => !cancelled && joinSeqRef.current === joinSeq;
    let myClient: IAgoraRTCClient | null = null;

    (async () => {
      // Wait for any previously queued leave to finish so we never have two
      // clients with the same uid connected simultaneously (root cause of the
      // "hear my own voice" echo when a viewer takes a seat).
      try { await leaveQueueRef.current; } catch { /* ignore */ }
      if (!isCurrentJoin()) return;

      setStatus("connecting");
      setError(null);
      try {
        const AgoraRTC = await loadAgoraRTC();
        if (!isCurrentJoin()) return;
        AgoraRTC.setLogLevel(3);
        myClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = myClient;
        const activeClient = myClient;

        await activeClient.setClientRole(publish ? "host" : "audience");
        if (!isCurrentJoin()) return;

        activeClient.on("user-published", async (user, mediaType) => {
          if (!isCurrentJoin()) return;
          const publishedUid = Number(user.uid);
          if (publishedUid === uid) {
            if (mediaType === "audio") {
              try { user.audioTrack?.setVolume(0); } catch { /* ignore */ }
              try { user.audioTrack?.stop(); } catch { /* ignore */ }
            }
            return;
          }
          await activeClient.subscribe(user, mediaType);
          if (mediaType === "audio") {
            if (speakerMutedRef.current) {
              try { user.audioTrack?.setVolume(0); } catch { /* ignore */ }
            } else {
              user.audioTrack?.play();
            }
          }
          setRemotes((prev) => {
            const next = new Map(prev);
            const uidNum = Number(user.uid);
            const cur = next.get(uidNum) ?? { uid: uidNum, hasAudio: false, hasVideo: false };
            if (mediaType === "audio") { cur.hasAudio = true; cur.audioTrack = user.audioTrack; }
            if (mediaType === "video") { cur.hasVideo = true; cur.videoTrack = user.videoTrack; }
            next.set(uidNum, cur);
            return next;
          });
        });

        activeClient.on("user-unpublished", (user, mediaType) => {
          setRemotes((prev) => {
            const next = new Map(prev);
            const uidNum = Number(user.uid);
            const cur = next.get(uidNum);
            if (cur) {
              if (mediaType === "audio") { cur.hasAudio = false; cur.audioTrack = undefined; }
              if (mediaType === "video") { cur.hasVideo = false; cur.videoTrack = undefined; }
              next.set(uidNum, { ...cur });
            }
            return next;
          });
        });

        activeClient.on("user-left", (user) => {
          setRemotes((prev) => {
            const next = new Map(prev);
            next.delete(Number(user.uid));
            return next;
          });
        });

        activeClient.on("token-privilege-will-expire", async () => {
          try {
            const { token: newToken } = await fetchToken(
              channel,
              uid,
              publish ? "publisher" : "audience",
              resolvedKind,
            );
            await activeClient.renewToken(newToken);
            console.info("[agora] token renewed");
          } catch (err) {
            console.warn("[agora] token renew failed", err);
          }
        });

        activeClient.on("connection-state-change", (curState, prevState, reason) => {
          console.info("[agora] connection", prevState, "→", curState, reason ?? "");
          if (curState === "DISCONNECTED") setStatus("connecting");
          if (curState === "CONNECTED") setStatus("connected");
        });

        const { appId, token } = await fetchToken(channel, uid, publish ? "publisher" : "audience", resolvedKind);
        if (!isCurrentJoin()) return;
        await activeClient.join(appId, channel, token, uid);
        if (!isCurrentJoin()) return;

        if (publish) {
          setMuted(true);
          setMicIssue(null, false);
          if (video) {
            try {
              const cam = await AgoraRTC.createCameraVideoTrack();
              localVideoRef.current = cam;
              await activeClient.publish(cam);
              setVideoOn(true);
            } catch (e) {
              console.warn("[agora] camera denied", e);
              setVideoOn(false);
            }
          }
        }

        if (isCurrentJoin()) setStatus("connected");
      } catch (e) {
        if (!isCurrentJoin()) return;
        console.error("[agora] join failed", e);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus(msg.includes("Agora not configured") ? "disabled" : "error");
      }
    })();

    return () => {
      cancelled = true;
      const c = myClient;
      // Immediately silence and detach the outgoing client so during the
      // handoff to the next join it cannot subscribe/play the new publisher.
      if (c) {
        try { c.remoteUsers?.forEach((u) => u.audioTrack?.setVolume(0)); } catch { /* ignore */ }
        try { c.removeAllListeners(); } catch { /* ignore */ }
      }
      if (c && clientRef.current === c) clientRef.current = null;
      closeLocalTracks();
      setRemotes(new Map());
      // Queue the actual leave so the next join can await it before joining
      // the same channel/uid again.
      if (c) {
        leaveQueueRef.current = leaveQueueRef.current
          .then(() => c.leave())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channel, uid, publish, video]);


  const requestMic = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    // Wait briefly for the join effect to create the client if this is the
    // very first mic tap right after entering the room.
    let client = clientRef.current;
    if (!client) {
      for (let i = 0; i < 20 && !clientRef.current; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      client = clientRef.current;
    }
    if (!client) {
      const message = "Room connection not ready yet. Please try again in a moment.";
      setMicIssue(message, false);
      return { ok: false, error: message };
    }

    const mapMediaError = (e: unknown): string => {
      const err = e as { name?: string; code?: string; message?: string };
      const name = err?.name ?? err?.code ?? "";
      if (name === "NotAllowedError" || name === "PERMISSION_DENIED")
        return "Microphone permission denied. Tap the 🔒 icon in the address bar → Site settings → Microphone → Allow.";
      if (name === "NotFoundError" || name === "DEVICE_NOT_FOUND")
        return "No microphone found on this device.";
      if (name === "NotReadableError" || name === "NOT_READABLE")
        return "Microphone is in use by another app. Close it and try again.";
      if (name === "SecurityError")
        return "Microphone blocked — the page must be served over HTTPS.";
      return err?.message ?? "Could not access microphone.";
    };
    const isPermDenied = (e: unknown) => {
      const n = (e as { name?: string; code?: string })?.name ?? (e as { code?: string })?.code ?? "";
      return n === "NotAllowedError" || n === "PERMISSION_DENIED";
    };

    // Wait for the latest room client to reach CONNECTED before publishing.
    // If the user taps mic immediately after taking a seat, the hook may still
    // be replacing the old audience client with a publisher client.
    if ((client.connectionState as string) !== "CONNECTED") {
      for (let i = 0; i < 80; i++) {
        const latest = clientRef.current;
        if (latest && (latest.connectionState as string) === "CONNECTED") {
          client = latest;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if ((client.connectionState as string) !== "CONNECTED") {
      const message = "Still connecting to room. Please try the mic again in a moment.";
      setMicIssue(message, false);
      return { ok: false, error: message };
    }


    if (!localAudioRef.current) {
      const AgoraRTC = cachedAgoraRTC;
      if (!AgoraRTC) {
        // SDK not preloaded yet — fall back to a permission preflight so we
        // can give a clear error without hanging.
        const preflight = await preflightMicPermission();
        if (!preflight.ok) {
          setMicIssue(preflight.error!, true);
          return { ok: false, error: preflight.error };
        }
        const loaded = await loadAgoraRTC();
        try {
          localAudioRef.current = await loaded.createMicrophoneAudioTrack();
        } catch (e) {
          console.warn("[agora] createMicrophoneAudioTrack failed", e);
          const message = mapMediaError(e);
          setMicIssue(message, isPermDenied(e));
          return { ok: false, error: message };
        }
      } else {
        try {
          localAudioRef.current = await AgoraRTC.createMicrophoneAudioTrack();
        } catch (e) {
          console.warn("[agora] createMicrophoneAudioTrack failed", e);
          const message = mapMediaError(e);
          setMicIssue(message, isPermDenied(e));
          return { ok: false, error: message };
        }
      }
    }

    try {
      await localAudioRef.current.setMuted(false);
    } catch (e) {
      console.warn("[agora] setMuted(false) failed", e);
    }

    if (!channel || uid == null) {
      const message = "Room connection not ready yet. Please try again in a moment.";
      setMicIssue(message, false);
      return { ok: false, error: message };
    }

    try {
      // Re-apply a publisher token before publishing. This fixes the race where
      // a viewer taps mic while their old audience connection is still being
      // upgraded after taking a seat.
      const { token } = await fetchToken(channel, uid, "publisher", resolvedKind);
      await client.renewToken(token);
      if (client.role !== "host") await client.setClientRole("host");
    } catch (e) {
      console.warn("[agora] publisher upgrade failed", e);
      const raw = e instanceof Error ? e.message : String(e);
      const message = `Mic connection is still upgrading. Please tap the mic again in a moment.${raw ? ` (${raw})` : ""}`;
      setMicIssue(message, false);
      return { ok: false, error: message };
    }

    if (!localAudioPublishedRef.current) {
      try {
        await client.publish(localAudioRef.current);
        localAudioPublishedRef.current = true;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        if (/already\s+published/i.test(raw)) {
          localAudioPublishedRef.current = true;
        } else {
          console.error("[agora] publish mic failed", e);
          const message = `Could not publish mic: ${raw}`;
          setMicIssue(message, false);
          return { ok: false, error: message };
        }
      }
    }

    setMuted(false);
    setMicIssue(null, false);
    return { ok: true };
  }, [channel, resolvedKind, setMicIssue, uid]);


  const toggleMute = useCallback(async () => {
    const track = localAudioRef.current;
    if (!track || !localAudioPublishedRef.current) {
      // No track yet — try to acquire it via a user-gesture request.
      await requestMic();
      return;
    }
    const next = !muted;
    if (next) {
      // On mobile, setMuted(true) can leave the capture/playback pipeline alive
      // and the user may still hear themselves. Fully unpublish + close the
      // mic track so the local device audio stops immediately.
      await stopMicTrack(clientRef.current);
      setMicIssue(null, false);
      return;
    }
    try {
      await track.setMuted(false);
      setMuted(false);
      setMicIssue(null, false);
    } catch (e) {
      console.error("[agora] setMuted failed", e);
    }
  }, [muted, requestMic, setMicIssue, stopMicTrack]);



  const toggleSpeaker = useCallback(() => {
    setSpeakerMuted((prev) => {
      const next = !prev;
      speakerMutedRef.current = next;
      remotes.forEach((r) => {
        try {
          if (next) r.audioTrack?.setVolume(0);
          else {
            r.audioTrack?.setVolume(100);
            r.audioTrack?.play();
          }
        } catch { /* ignore */ }
      });
      return next;
    });
  }, [remotes]);

  const toggleVideo = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    if (localVideoRef.current) {
      localVideoRef.current.stop();
      try { await client.unpublish(localVideoRef.current); } catch { /* ignore */ }
      localVideoRef.current.close();
      localVideoRef.current = null;
      setVideoOn(false);
      return;
    }
    if (client.connectionState !== "CONNECTED") {
      console.warn("[agora] cannot publish video, not connected:", client.connectionState);
      return;
    }
    if (client.role !== "host") {
      console.warn("[agora] cannot publish video, role is audience");
      return;
    }
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const cam = await AgoraRTC.createCameraVideoTrack();
      localVideoRef.current = cam;
      await client.publish(cam);
      setVideoOn(true);
    } catch (e) {
      console.warn("[agora] camera failed", e);
    }
  }, []);


  const playMusicFile = useCallback(async (file: Blob, title: string) => {
    const client = clientRef.current;
    if (!client) throw new Error("Not connected to room yet");
    if (client.connectionState !== "CONNECTED") throw new Error("Still connecting to room, please wait");
    if (client.role !== "host") throw new Error("Only host can play music");

    const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
    // Stop previous
    if (musicTrackRef.current) {
      try { musicTrackRef.current.stopProcessAudioBuffer(); } catch { /* ignore */ }
      try { await client.unpublish(musicTrackRef.current); } catch { /* ignore */ }
      try { musicTrackRef.current.close(); } catch { /* ignore */ }
      musicTrackRef.current = null;
    }
    const track = await AgoraRTC.createBufferSourceAudioTrack({ source: file as File });
    musicTrackRef.current = track;
    track.on("source-state-change", (state) => {
      if (state === "stopped") {
        setMusicPlaying(false);
      } else if (state === "playing") {
        setMusicPlaying(true);
      }
    });
    track.startProcessAudioBuffer({ loop: false });
    // Play locally so the host also hears their own music (remote users hear
    // it via the published track).
    try { track.play(); } catch (e) { console.warn("[agora] music local play failed", e); }
    await client.publish(track);
    setMusicTitle(title);
    setMusicPlaying(true);
  }, []);


  const pauseMusic = useCallback(() => {
    const t = musicTrackRef.current;
    if (!t) return;
    t.pauseProcessAudioBuffer();
    setMusicPlaying(false);
  }, []);

  const resumeMusic = useCallback(() => {
    const t = musicTrackRef.current;
    if (!t) return;
    t.resumeProcessAudioBuffer();
    setMusicPlaying(true);
  }, []);

  const stopMusic = useCallback(async () => {
    const client = clientRef.current;
    const t = musicTrackRef.current;
    if (!t) return;
    try { t.stopProcessAudioBuffer(); } catch { /* ignore */ }
    try { if (client) await client.unpublish(t); } catch { /* ignore */ }
    try { t.close(); } catch { /* ignore */ }
    musicTrackRef.current = null;
    setMusicPlaying(false);
    setMusicTitle(null);
  }, []);

  const setMusicVolume = useCallback((v: number) => {
    musicTrackRef.current?.setVolume(v);
  }, []);

  return {
    status,
    error,
    remotes,
    muted,
    speakerMuted,
    videoOn,
    micBlocked,
    micError,
    requestMic,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    localAudioTrack: localAudioRef,
    localAudioPublished: localAudioPublishedRef,
    localVideoTrack: localVideoRef,
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
