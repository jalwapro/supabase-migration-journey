import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MoveVertical, Radio } from 'lucide-react';
import { useVoiceRoomSession } from '@/context/VoiceRoomSessionContext';
import { useNavigate } from '@tanstack/react-router';

const POSITION_KEY = 'jalwa:minimized-room-y';
const clampY = (value: number) => Math.max(72, Math.min(window.innerHeight - 92, value));

export function GlobalMinimizedVoiceRoom() {
  const { activeRoom, restoreRoom } = useVoiceRoomSession();
  const navigate = useNavigate();
  const [y, setY] = useState(() => {
    try {
      const value = Number(localStorage.getItem(POSITION_KEY));
      return Number.isFinite(value) ? clampY(value) : Math.max(72, window.innerHeight - 170);
    } catch {
      return 150;
    }
  });
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef(0);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      const next = clampY(event.clientY - offset.current);
      setY(next);
      try { localStorage.setItem(POSITION_KEY, String(next)); } catch {}
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  if (!activeRoom?.isMinimized) return null;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    moved.current = false;
    offset.current = event.clientY - y;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = 'none';
  };

  const returnToRoom = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    restoreRoom();
    navigate({ to: activeRoom.roomRoute as never });
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] mx-auto flex max-w-md justify-end px-4 touch-none"
      style={{ top: y }}
      role="region"
      aria-label="Active minimized Voice Room"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-0.5">
        <div
          onPointerDown={startDrag}
          className="cursor-grab rounded-full px-2 py-0.5 text-white/35 active:cursor-grabbing"
          aria-label="Drag Voice Room button up or down"
        >
          <MoveVertical className="h-3 w-3" />
        </div>
        <button
          type="button"
          onClick={returnToRoom}
          aria-label={`Return to ${activeRoom.roomName || 'Voice Room'}`}
          className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--gold)_60%,transparent)] transition-transform active:scale-95"
        >
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[color:var(--gold)]/25" />
          <span className="relative flex flex-col items-center leading-none">
            <span className="relative mb-0.5 grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-white/60 bg-black/20">
              {activeRoom.roomAvatar ? (
                <img src={activeRoom.roomAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <Radio className="h-4 w-4" />
              )}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-emerald-400" />
            </span>
            <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-wider">
              {activeRoom.microphoneMuted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
              Room
            </span>
          </span>
        </button>
        <span className="max-w-20 truncate rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-bold text-white/90 backdrop-blur-sm">
          {activeRoom.roomName || 'Voice Room'}
        </span>
      </div>
    </div>
  );
}
