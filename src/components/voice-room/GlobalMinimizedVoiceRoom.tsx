import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MoveVertical, Radio } from 'lucide-react';
import { useVoiceRoomSession } from '@/context/VoiceRoomSessionContext';
import { useNavigate } from '@tanstack/react-router';

const POSITION_KEY = 'jalwa:minimized-room-y';
const clampY = (value: number) => Math.max(72, Math.min(window.innerHeight - 92, value));

export function GlobalMinimizedVoiceRoom() {
  const { activeRoom, restoreRoom } = useVoiceRoomSession();
  const navigate = useNavigate();
  const [y, setY] = useState(() => { try { const value = Number(localStorage.getItem(POSITION_KEY)); return Number.isFinite(value) ? clampY(value) : 0; } catch { return 0; } });
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef(0);

  useEffect(() => {
    if (!y) setY(Math.max(72, window.innerHeight - 190));
    const onMove = (event: PointerEvent) => { if (!dragging.current) return; moved.current = true; const next = clampY(event.clientY - offset.current); setY(next); try { localStorage.setItem(POSITION_KEY, String(next)); } catch {} };
    const onUp = () => { dragging.current = false; document.body.style.userSelect = ''; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [y]);

  if (!activeRoom?.isMinimized) return null;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => { dragging.current = true; moved.current = false; offset.current = event.clientY - y; event.currentTarget.setPointerCapture?.(event.pointerId); document.body.style.userSelect = 'none'; };
  const returnToRoom = () => { if (moved.current) { moved.current = false; return; } restoreRoom(); navigate({ to: activeRoom.roomRoute as never }); };

  return (
    <div className="fixed left-1/2 z-[80] w-[calc(100%-24px)] max-w-md -translate-x-1/2 touch-none" style={{ top: y }} role="region" aria-label="Active minimized Voice Room">
      <div className="flex items-center gap-2 overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-[#120b1c]/95 p-2.5 shadow-[0_14px_45px_rgba(0,0,0,.5)] backdrop-blur-xl">
        <div onPointerDown={startDrag} className="grid h-11 w-6 shrink-0 cursor-grab place-items-center text-white/45 active:cursor-grabbing" aria-label="Drag Voice Room button up or down"><MoveVertical className="h-4 w-4" /></div>
        <button type="button" onClick={returnToRoom} aria-label="Return to active Voice Room" className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[.99]">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-fuchsia-300/30 bg-white/10">{activeRoom.roomAvatar ? <img src={activeRoom.roomAvatar} alt="" className="h-full w-full object-cover" /> : <Radio className="absolute inset-0 m-auto h-5 w-5 text-fuchsia-200" />}<span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#120b1c] bg-emerald-400" /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{activeRoom.roomName || 'Voice Room'}</div><div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/60"><span className="font-black text-emerald-300">LIVE</span>{activeRoom.microphoneMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}<span>Voice Room active</span></div></div>
          <span className="shrink-0 rounded-full bg-fuchsia-500 px-3 py-2 text-[11px] font-black text-white shadow-lg">Is Room Mein Jayein</span>
        </button>
      </div>
    </div>
  );
}
