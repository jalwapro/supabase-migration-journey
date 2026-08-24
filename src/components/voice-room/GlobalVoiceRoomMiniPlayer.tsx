import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio, MoveVertical, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type MiniRoom = {
  roomId: string;
  roomName: string;
  roomAvatar: string | null;
  roomRoute: string;
  muted: boolean;
};

const STORAGE_KEY = "jalwa_minimized_voice_room";
const POSITION_KEY = "jalwa_minimized_voice_room_position";
const DEFAULT_Y = 150;

type MiniEventDetail = Omit<MiniRoom, "muted"> & { muted?: boolean };

function readRoom(): MiniRoom | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MiniRoom>;
    if (!value.roomId || !value.roomRoute) return null;
    return {
      roomId: value.roomId,
      roomName: value.roomName || "Voice Room",
      roomAvatar: value.roomAvatar || null,
      roomRoute: value.roomRoute,
      muted: Boolean(value.muted),
    };
  } catch {
    return null;
  }
}

function readY() {
  try {
    const y = Number(localStorage.getItem(POSITION_KEY));
    return Number.isFinite(y) ? Math.max(76, Math.min(window.innerHeight - 90, y)) : DEFAULT_Y;
  } catch {
    return DEFAULT_Y;
  }
}

export function setMinimizedVoiceRoom(detail: MiniEventDetail) {
  const room: MiniRoom = { ...detail, muted: Boolean(detail.muted) };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(room)); } catch {}
  window.dispatchEvent(new CustomEvent("jalwa:minimized-voice-room", { detail: room }));
}

export function clearMinimizedVoiceRoom() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  window.dispatchEvent(new CustomEvent("jalwa:minimized-voice-room-cleared"));
}

export function GlobalVoiceRoomMiniPlayer() {
  const navigate = useNavigate();
  const [room, setRoom] = useState<MiniRoom | null>(() => typeof window === "undefined" ? null : readRoom());
  const [y, setY] = useState(() => typeof window === "undefined" ? DEFAULT_Y : readY());
  const dragging = useRef(false);
  const moved = useRef(false);
  const pointerOffset = useRef(0);

  useEffect(() => {
    const onRoom = (event: Event) => setRoom((event as CustomEvent<MiniRoom>).detail ?? null);
    const onClear = () => setRoom(null);
    window.addEventListener("jalwa:minimized-voice-room", onRoom);
    window.addEventListener("jalwa:minimized-voice-room-cleared", onClear);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setRoom(readRoom());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("jalwa:minimized-voice-room", onRoom);
      window.removeEventListener("jalwa:minimized-voice-room-cleared", onClear);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      const next = Math.max(76, Math.min(window.innerHeight - 90, event.clientY - pointerOffset.current));
      setY(next);
      try { localStorage.setItem(POSITION_KEY, String(next)); } catch {}
    };
    const onUp = () => { dragging.current = false; document.body.style.userSelect = ""; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  if (!room) return null;

  const returnToRoom = () => {
    if (moved.current) { moved.current = false; return; }
    navigate({ to: room.roomRoute as never });
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    moved.current = false;
    pointerOffset.current = event.clientY - y;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className="fixed left-1/2 z-[70] w-[min(92vw,390px)] -translate-x-1/2 touch-none"
      style={{ top: y, paddingBottom: "env(safe-area-inset-bottom)" }}
      role="region"
      aria-label="Active minimized voice room"
    >
      <div className="overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-[#120b1c]/95 shadow-[0_14px_45px_rgba(0,0,0,.5)] backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div onPointerDown={startDrag} className="grid h-9 w-6 shrink-0 cursor-grab place-items-center text-white/45 active:cursor-grabbing" aria-label="Drag room button up or down">
            <MoveVertical className="h-4 w-4" />
          </div>
          <button type="button" onClick={returnToRoom} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-fuchsia-300/30 bg-white/10">
              {room.roomAvatar ? <img src={room.roomAvatar} alt="" className="h-full w-full object-cover" /> : <Radio className="absolute inset-0 m-auto h-5 w-5 text-fuchsia-200" />}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#120b1c] bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{room.roomName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/60">
                <span className="font-semibold text-emerald-300">LIVE</span>
                {room.muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                <span>Voice Room active</span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-fuchsia-500 px-3 py-2 text-xs font-bold text-white shadow-lg">Is Room Mein Jayein</span>
          </button>
          <button type="button" onClick={clearMinimizedVoiceRoom} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white" aria-label="Close minimized room">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
