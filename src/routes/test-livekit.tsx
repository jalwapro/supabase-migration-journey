import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/test-livekit")({ component: LiveKitDiagnosticPage });

type DiagnosticState = "idle" | "finding-room" | "fetching-token" | "connecting" | "connected" | "error";

type TokenResponse = {
  server_url?: string;
  participant_token?: string;
  room?: string;
  canPublish?: boolean;
  error?: string;
};

function LiveKitDiagnosticPage() {
  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef<Set<HTMLAudioElement>>(new Set());
  const [state, setState] = useState<DiagnosticState>("idle");
  const [message, setMessage] = useState("Ready to test LiveKit");
  const [roomId, setRoomId] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [participantIdentity, setParticipantIdentity] = useState("");
  const [canPublish, setCanPublish] = useState(false);
  const [micPublished, setMicPublished] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [remoteParticipants, setRemoteParticipants] = useState(0);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const statusLabel = useMemo(() => {
    switch (state) {
      case "finding-room": return "Finding a live room...";
      case "fetching-token": return "Fetching LiveKit test token...";
      case "connecting": return "Connecting to LiveKit...";
      case "connected": return "Connected successfully to Room";
      case "error": return `Error: ${error ?? "Unknown error"}`;
      default: return message;
    }
  }, [state, message, error]);

  const cleanup = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    audioElsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    audioElsRef.current.clear();
    setRemoteParticipants(0);
    setRemoteAudioTracks(0);
    setMicPublished(false);
    setMicMuted(true);
  }, []);

  const connect = useCallback(async () => {
    const started = performance.now();
    setError(null);
    setElapsedMs(null);
    setCanPublish(false);
    setMicPublished(false);
    setMicMuted(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("You must be signed in before running the LiveKit test.");

      let targetRoom = roomId.trim();
      if (!targetRoom) {
        setState("finding-room");
        const { data: liveRoom, error: roomError } = await supabase
          .from("live_rooms")
          .select("id")
          .eq("status", "live")
          .limit(1)
          .maybeSingle();
        if (roomError) throw roomError;
        if (!liveRoom?.id) throw new Error("No live room was found. Enter a live room ID and try again.");
        targetRoom = liveRoom.id;
        setRoomId(targetRoom);
      }

      setState("fetching-token");
      const tokenResponse = await fetch("/api/livekit-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          room: targetRoom,
          name: `LiveKit Diagnostic ${Date.now()}`,
          canPublish: true,
        }),
      });

      const body = await tokenResponse.json() as TokenResponse;
      if (!tokenResponse.ok || !body.server_url || !body.participant_token) {
        throw new Error(body.error ?? `Token endpoint failed with HTTP ${tokenResponse.status}`);
      }

      setServerUrl(body.server_url);
      setCanPublish(body.canPublish === true);
      setState("connecting");

      await cleanup();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const refreshParticipants = () => {
        let audioCount = 0;
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((publication) => {
            if (publication.isSubscribed || publication.track) audioCount += 1;
          });
        });
        setRemoteParticipants(room.remoteParticipants.size);
        setRemoteAudioTracks(audioCount);
      };

      const attachAudio = (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach() as HTMLAudioElement;
        el.autoplay = true;
        el.muted = false;
        el.volume = 1;
        el.setAttribute("playsinline", "true");
        el.setAttribute("data-livekit-diagnostic", participant.identity);
        el.style.display = "none";
        document.body.appendChild(el);
        audioElsRef.current.add(el);
        void el.play().catch(() => undefined);
        refreshParticipants();
      };

      const detachAudio = (track: RemoteTrack, _pub?: RemoteTrackPublication, _p?: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio) return;
        track.detach().forEach((el) => {
          audioElsRef.current.delete(el as HTMLAudioElement);
          el.remove();
        });
        refreshParticipants();
      };

      room.on(RoomEvent.TrackSubscribed, attachAudio);
      room.on(RoomEvent.TrackUnsubscribed, detachAudio);
      room.on(RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.TrackPublished, refreshParticipants);
      room.on(RoomEvent.TrackUnpublished, refreshParticipants);
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          setState("idle");
          setMessage("Disconnected from LiveKit");
        }
      });

      await room.connect(body.server_url, body.participant_token, { autoSubscribe: true });
      if (roomRef.current !== room) return;

      setParticipantIdentity(room.localParticipant.identity);
      refreshParticipants();
      setState("connected");
      setMessage("LiveKit WebSocket/RTC connection is active");
      setElapsedMs(Math.round(performance.now() - started));

      if (body.canPublish === true) {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicPublished(true);
        setMicMuted(false);
        setMessage("Connected and microphone publishing successfully");
      } else {
        setMicPublished(false);
        setMicMuted(true);
        setMessage("Connected successfully; this account is subscribe-only in this room");
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setState("error");
      setError(detail);
      setElapsedMs(Math.round(performance.now() - started));
      await cleanup();
    }
  }, [cleanup, roomId]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected" || !canPublish) return;
    const nextEnabled = micMuted;
    await room.localParticipant.setMicrophoneEnabled(nextEnabled);
    setMicMuted(!nextEnabled);
    setMicPublished(nextEnabled);
    setMessage(nextEnabled ? "Microphone is publishing" : "Microphone is muted");
  }, [canPublish, micMuted]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRoom = params.get("room");
    if (requestedRoom) setRoomId(requestedRoom);
    return () => { void cleanup(); };
  }, [cleanup]);

  return (
    <main style={{ minHeight: "100vh", background: "#0b1020", color: "#fff", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>LiveKit Diagnostic</h1>
        <p style={{ opacity: 0.75, marginTop: 0 }}>Temporary production-readiness test for the Voice Room LiveKit connection.</p>

        <section style={{ background: "#151c31", borderRadius: 16, padding: 20, marginTop: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{statusLabel}</div>
          <div style={{ marginTop: 8, opacity: 0.75 }}>{message}</div>
          {elapsedMs !== null && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65 }}>Connection time: {elapsedMs} ms</div>}
        </section>

        <section style={{ background: "#151c31", borderRadius: 16, padding: 20, marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Live Room ID (optional)</label>
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="Leave empty to use the first live room"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #34405f", background: "#0e1426", color: "#fff", padding: "12px 14px" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={() => void connect()} style={{ border: 0, borderRadius: 10, padding: "12px 16px", fontWeight: 700, cursor: "pointer" }}>
              {state === "connecting" || state === "fetching-token" || state === "finding-room" ? "Testing..." : "Run LiveKit Test"}
            </button>
            <button onClick={() => void cleanup()} style={{ border: "1px solid #34405f", borderRadius: 10, padding: "12px 16px", background: "transparent", color: "#fff", cursor: "pointer" }}>
              Disconnect
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.55 }}>You can also open <code>/test-livekit?room=ROOM_ID</code>.</div>
        </section>

        <section style={{ background: "#151c31", borderRadius: 16, padding: 20, marginTop: 16 }}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Checks</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <Check label="Token endpoint" ok={state === "connecting" || state === "connected"} />
            <Check label="LiveKit server URL received" ok={Boolean(serverUrl)} />
            <Check label="Connected to LiveKit Room" ok={state === "connected"} />
            <Check label="Publish permission granted" ok={canPublish} />
            <Check label="Microphone track publishing" ok={micPublished && !micMuted} />
            <Check label={`Remote participants (${remoteParticipants})`} ok={remoteParticipants > 0} neutral={state === "connected" && remoteParticipants === 0} />
            <Check label={`Remote audio tracks (${remoteAudioTracks})`} ok={remoteAudioTracks > 0} neutral={state === "connected" && remoteAudioTracks === 0} />
          </div>
        </section>

        {state === "connected" && canPublish && (
          <section style={{ background: "#151c31", borderRadius: 16, padding: 20, marginTop: 16 }}>
            <h2 style={{ fontSize: 17, marginTop: 0 }}>Microphone test</h2>
            <p style={{ opacity: 0.7, fontSize: 14 }}>Speak while this is publishing. A second device/user in the same room should hear this diagnostic participant.</p>
            <button onClick={() => void toggleMic()} style={{ border: 0, borderRadius: 10, padding: "12px 16px", fontWeight: 700, cursor: "pointer" }}>
              {micMuted ? "Enable microphone" : "Mute microphone"}
            </button>
          </section>
        )}

        {error && (
          <section style={{ background: "#3a1720", borderRadius: 16, padding: 20, marginTop: 16 }}>
            <strong>Diagnostic error</strong>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginBottom: 0 }}>{error}</pre>
          </section>
        )}

        <section style={{ opacity: 0.55, fontSize: 12, marginTop: 18 }}>
          <div>Server: {serverUrl || "not received yet"}</div>
          <div>Participant: {participantIdentity || "not connected"}</div>
          <div>Room: {roomId || "auto-selected"}</div>
        </section>
      </div>
    </main>
  );
}

function Check({ label, ok, neutral = false }: { label: string; ok: boolean; neutral?: boolean }) {
  const symbol = ok ? "✓" : neutral ? "–" : "✗";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#0e1426" }}>
      <span>{label}</span>
      <strong style={{ opacity: ok || neutral ? 1 : 0.75 }}>{symbol}</strong>
    </div>
  );
}
