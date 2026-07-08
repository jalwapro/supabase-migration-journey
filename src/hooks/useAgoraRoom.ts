import { useEffect, useRef, useState, useCallback } from "react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IBufferSourceAudioTrack,
} from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";

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
};

async function fetchToken(channel: string, uid: number, role: "publisher" | "audience") {
  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) throw new Error("Sign in first");
  const res = await fetch("/api/agora-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ channel, uid, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "token failed");
  return data as { appId: string; token: string; uid: number; channel: string };
}

export function useAgoraRoom({ channel, uid, publish, video, enabled }: UseAgoraRoomArgs) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoRef = useRef<ILocalVideoTrack | null>(null);
  const [status, setStatus] = useState<AgoraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Map<number, RemoteUser>>(new Map());
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(video);

  const musicTrackRef = useRef<IBufferSourceAudioTrack | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  const teardown = useCallback(async () => {
    const client = clientRef.current;
    if (musicTrackRef.current) {
      try { musicTrackRef.current.stopProcessAudioBuffer(); } catch { /* ignore */ }
      try { if (client) await client.unpublish(musicTrackRef.current); } catch { /* ignore */ }
      try { musicTrackRef.current.close(); } catch { /* ignore */ }
      musicTrackRef.current = null;
      setMusicPlaying(false);
      setMusicTitle(null);
    }
    if (localAudioRef.current) {
      localAudioRef.current.stop();
      localAudioRef.current.close();
      localAudioRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.stop();
      localVideoRef.current.close();
      localVideoRef.current = null;
    }
    if (client) {
      try { await client.leave(); } catch { /* ignore */ }
      client.removeAllListeners();
      clientRef.current = null;
    }
    setRemotes(new Map());
    setStatus("idle");
  }, []);


  useEffect(() => {
    if (!enabled || !channel || uid == null) {
      void teardown();
      return;
    }
    let cancelled = false;

    (async () => {
      setStatus("connecting");
      setError(null);
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        AgoraRTC.setLogLevel(3);
        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;

        await client.setClientRole(publish ? "host" : "audience");

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") user.audioTrack?.play();
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

        client.on("user-unpublished", (user, mediaType) => {
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

        client.on("user-left", (user) => {
          setRemotes((prev) => {
            const next = new Map(prev);
            next.delete(Number(user.uid));
            return next;
          });
        });

        const { appId, token } = await fetchToken(channel, uid, publish ? "publisher" : "audience");
        if (cancelled) return;
        await client.join(appId, channel, token, uid);

        if (publish) {
          const audio = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioRef.current = audio;
          await client.publish(audio);
          if (video) {
            try {
              const cam = await AgoraRTC.createCameraVideoTrack();
              localVideoRef.current = cam;
              await client.publish(cam);
              setVideoOn(true);
            } catch (e) {
              console.warn("[agora] camera denied", e);
              setVideoOn(false);
            }
          }
        }

        if (!cancelled) setStatus("connected");
      } catch (e) {
        console.error("[agora] join failed", e);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus(msg.includes("Agora not configured") ? "disabled" : "error");
      }
    })();

    return () => {
      cancelled = true;
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channel, uid, publish, video]);

  const toggleMute = useCallback(async () => {
    const track = localAudioRef.current;
    if (!track) return;
    const next = !muted;
    await track.setEnabled(!next);
    setMuted(next);
  }, [muted]);

  const toggleVideo = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    if (localVideoRef.current) {
      localVideoRef.current.stop();
      await client.unpublish(localVideoRef.current);
      localVideoRef.current.close();
      localVideoRef.current = null;
      setVideoOn(false);
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
    videoOn,
    toggleMute,
    toggleVideo,
    localAudioTrack: localAudioRef,
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
