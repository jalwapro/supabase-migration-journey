import { useEffect, useRef, useState } from 'react';
import { LogIn, Mic, MicOff, Move, Radio, Volume2, VolumeX, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVoiceRoomSession } from '@/context/VoiceRoomSessionContext';

const POSITION_KEY = 'jalwa:minimized-room-position';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type RecoverableRoom = {
  id: string;
  title: string | null;
  cover_url: string | null;
  status: 'live' | 'host_disconnected' | string;
  grace_period_until: string | null;
};

type SeatPresence = { seat_index: number | null; profile: { avatar: string | null } | null };

export function GlobalMinimizedVoiceRoom() {
  const { user } = useAuth();
  const { activeRoom, restoreRoom, clearRoom, updateRoom } = useVoiceRoomSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null') as { x?: number; y?: number } | null;
      return {
        x: typeof saved?.x === 'number' ? saved.x : Math.max(12, window.innerWidth - 92),
        y: typeof saved?.y === 'number' ? saved.y : Math.max(80, window.innerHeight - 190),
      };
    } catch {
      return { x: 12, y: 180 };
    }
  });
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const recovery = useQuery({
    enabled: !!user?.id && !activeRoom,
    queryKey: ['global-room-recovery', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_recoverable_room');
      if (error) throw error;
      return (Array.isArray(data) && data.length ? data[0] as RecoverableRoom : null);
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  const room = activeRoom ?? (recovery.data ? {
    roomId: recovery.data.id,
    roomName: recovery.data.title,
    roomAvatar: recovery.data.cover_url,
    roomRoute: `/room/${encodeURIComponent(recovery.data.id)}`,
    userId: user?.id ?? '',
    userRole: 'host',
    isMinimized: true,
    connectionState: recovery.data.status === 'host_disconnected' ? 'reconnecting' : 'connected',
    microphoneMuted: false,
  } : null);

  const seatPresence = useQuery({
    enabled: !!user?.id && !!room?.roomId,
    queryKey: ['global-room-seat-presence', room?.roomId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_members')
        .select('seat_index,profile:profiles!room_members_user_id_fkey(avatar)')
        .eq('room_id', room!.roomId)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SeatPresence | null) ?? null;
    },
    refetchInterval: 5_000,
    staleTime: 2_000,
  });

  const seatedAvatar = seatPresence.data?.seat_index != null ? seatPresence.data.profile?.avatar : null;

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      const next = {
        x: clamp(event.clientX - offset.current.x, 8, Math.max(8, window.innerWidth - 76)),
        y: clamp(event.clientY - offset.current.y, 72, Math.max(72, window.innerHeight - 84)),
      };
      setPosition(next);
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch {}
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
      document.body.style.userSelect = '';
    };
  }, []);

  const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;
  const normalizedRoomRoute = room?.roomRoute?.split('?')[0];
  const isViewingActiveRoom = !!normalizedRoomRoute && currentPath === normalizedRoomRoute;

  // The global control exists only while the room is minimized/recoverable.
  // Never render it on the full active Voice Room screen.
  if (!user || !room || isViewingActiveRoom || (activeRoom && !activeRoom.isMinimized)) return null;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    moved.current = false;
    offset.current = { x: event.clientX - position.x, y: event.clientY - position.y };
    event.preventDefault();
    document.body.style.userSelect = 'none';
  };

  const enterRoom = async () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if (recovery.data?.status === 'host_disconnected') {
      const { error } = await supabase.rpc('reclaim_room', { _room_id: recovery.data.id });
      if (error) { toast.error(error.message); return; }
      await qc.invalidateQueries({ queryKey: ['global-room-recovery', user.id] });
    }
    restoreRoom();
    setOpen(false);
    navigate({ to: room.roomRoute as never });
  };

  const endRoom = async () => {
    if (!confirm('End this room now?')) return;
    const { error } = await supabase.rpc('end_room', { _room_id: room.roomId });
    if (error) { toast.error(error.message); return; }
    clearRoom();
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ['global-room-recovery', user.id] });
    toast.success('Room ended');
  };

  const leaveRoom = () => {
    clearRoom();
    setOpen(false);
    if (window.location.pathname.startsWith('/room/')) navigate({ to: '/' });
    toast.success('Left Voice Room');
  };

  const toggleMic = () => {
    const muted = !Boolean(room.microphoneMuted);
    updateRoom({ microphoneMuted: muted });
    window.dispatchEvent(new CustomEvent('jalwa:voice-room-toggle-mic', { detail: { muted, roomId: room.roomId } }));
  };

  const toggleSpeaker = () => {
    window.dispatchEvent(new CustomEvent('jalwa:voice-room-toggle-speaker', { detail: { roomId: room.roomId } }));
    toast.success('Speaker control sent to Voice Room');
  };

  return (
    <div className="pointer-events-none fixed z-[90] touch-none" style={{ left: position.x, top: position.y }} role="region" aria-label="Active Voice Room control">
      <div className="pointer-events-auto relative">
        {open && (
          <div className="absolute bottom-[76px] left-1/2 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-black/90 p-2 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-2">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                {seatedAvatar ? <img src={seatedAvatar} alt="" className="h-full w-full object-cover" /> : <Radio className="m-2 h-5 w-5 text-white/70" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{room.roomName || 'Voice Room'}</p>
                <p className="text-[10px] text-emerald-300">● {room.connectionState === 'reconnecting' ? 'Reconnecting' : 'Room Active'}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-white/60" aria-label="Close room controls"><X className="h-4 w-4" /></button>
            </div>
            {room.userRole === 'host' ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={toggleMic} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 p-2.5 text-[10px] font-bold text-white">{room.microphoneMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{room.microphoneMuted ? 'Unmute Me' : 'Mute Me'}</button>
                  <button type="button" onClick={toggleSpeaker} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 p-2.5 text-[10px] font-bold text-white"><Volume2 className="h-4 w-4" />Speaker</button>
                  <button type="button" onClick={enterRoom} className="flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--primary)]/20 p-2.5 text-[10px] font-bold text-white"><LogIn className="h-4 w-4" />Manage Room</button>
                  <button type="button" onClick={leaveRoom} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 p-2.5 text-[10px] font-bold text-white"><X className="h-4 w-4" />Leave</button>
                </div>
                <button type="button" onClick={endRoom} className="mt-2 w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-[10px] font-black text-rose-200">End Room for Everyone</button>
              </>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={toggleMic} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 p-2 text-[9px] font-bold text-white">{room.microphoneMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{room.microphoneMuted ? 'Unmute' : 'Mute'}</button>
                  <button type="button" onClick={toggleSpeaker} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 p-2 text-[9px] font-bold text-white"><Volume2 className="h-4 w-4" />Speaker</button>
                  <button type="button" onClick={leaveRoom} className="flex flex-col items-center gap-1 rounded-xl bg-rose-500/15 p-2 text-[9px] font-bold text-rose-200"><VolumeX className="h-4 w-4" />Leave</button>
                </div>
                <button type="button" onClick={enterRoom} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-3 py-2.5 text-xs font-black text-white"><LogIn className="h-4 w-4" />Is Room Mein Jayein</button>
              </>
            )}
          </div>
        )}
        <div onPointerDown={startDrag} className="cursor-move select-none">
          <button type="button" onClick={() => { if (moved.current) { moved.current = false; return; } setOpen(v => !v); }} aria-label="Open Voice Room controls" className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-[color:var(--gold)] bg-black/70 shadow-[0_10px_30px_-6px_rgba(0,0,0,.7)] backdrop-blur active:scale-95">
            <span className="absolute inset-0 bg-gradient-to-br from-[color:var(--gold)]/35 via-[color:var(--primary)]/35 to-[color:var(--secondary)]/35" />
            {seatedAvatar ? <img src={seatedAvatar} alt="" className="relative h-12 w-12 rounded-full object-cover" draggable={false} /> : <Radio className="relative h-6 w-6 text-white" />}
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-black bg-emerald-400" />
            <span className="absolute bottom-1 rounded-full bg-black/70 px-1 text-[7px] font-black text-white">{room.microphoneMuted ? '🔇' : 'LIVE'}</span>
          </button>
        </div>
        <Move className="mx-auto mt-0.5 h-3 w-3 text-white/30" aria-hidden />
      </div>
    </div>
  );
}
