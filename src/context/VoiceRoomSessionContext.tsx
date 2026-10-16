import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type ActiveVoiceRoom = { roomId: string; roomName?: string | null; roomAvatar?: string | null; roomRoute: string; userId: string; userRole?: string | null; isMinimized: boolean; connectionState?: string | null; microphoneMuted?: boolean; };
type VoiceRoomSessionContextValue = { activeRoom: ActiveVoiceRoom | null; minimizeRoom: (room: Omit<ActiveVoiceRoom, 'isMinimized'>) => void; restoreRoom: () => void; clearRoom: (roomId?: string, userId?: string) => void; updateRoom: (patch: Partial<ActiveVoiceRoom>) => void; };
const STORAGE_KEY = 'jalwa:active-voice-room';
const EXITED_ROOM_KEY = 'jalwa:explicitly-exited-room';
const VoiceRoomSessionContext = createContext<VoiceRoomSessionContextValue | null>(null);
export function VoiceRoomSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ActiveVoiceRoom | null>(() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as ActiveVoiceRoom; return parsed?.roomId && parsed?.userId ? parsed : null; } catch { return null; } });
  useEffect(() => { if (!user?.id) { setActiveRoom(null); try { localStorage.removeItem(STORAGE_KEY); } catch {} return; } if (activeRoom && activeRoom.userId !== user.id) { setActiveRoom(null); try { localStorage.removeItem(STORAGE_KEY); } catch {} return; } try { if (activeRoom) localStorage.setItem(STORAGE_KEY, JSON.stringify(activeRoom)); else localStorage.removeItem(STORAGE_KEY); } catch {} }, [activeRoom, user?.id]);
  const minimizeRoom = useCallback((room: Omit<ActiveVoiceRoom, 'isMinimized'>) => {
    if (!user?.id || room.userId !== user.id || !room.roomId || !room.roomRoute) return;
    const next: ActiveVoiceRoom = { ...room, isMinimized: true };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setActiveRoom(next);
    window.dispatchEvent(new CustomEvent('jalwa:voice-room-minimized', { detail: next }));
  }, [user?.id]);
  const restoreRoom = useCallback(() => setActiveRoom(r => r ? { ...r, isMinimized: false } : r), []);
  const clearRoom = useCallback((roomId?: string, userId?: string) => {
    // Explicit exit must be recorded from the route itself too: activeRoom can
    // already be null/stale while recovery data still exists in React Query.
    const exitedRoomId = roomId || activeRoom?.roomId;
    const exitedUserId = userId || activeRoom?.userId;
    if (exitedRoomId && exitedUserId) {
      try { localStorage.setItem(EXITED_ROOM_KEY, JSON.stringify({ roomId: exitedRoomId, userId: exitedUserId, at: Date.now() })); } catch {}
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setActiveRoom(null);
    window.dispatchEvent(new CustomEvent('jalwa:voice-room-exited', { detail: { roomId: exitedRoomId, userId: exitedUserId } }));
  }, [activeRoom]);
  const updateRoom = useCallback((patch: Partial<ActiveVoiceRoom>) => {
    // Do not clear an explicit-exit marker merely because stale room effects
    // run again during a route transition. RoomPage owns intentional re-entry.
    setActiveRoom(r => {
      if (r) return { ...r, ...patch };
      if (patch.roomId && patch.roomRoute && patch.userId) {
        return { roomId: patch.roomId, roomRoute: patch.roomRoute, userId: patch.userId, isMinimized: patch.isMinimized ?? false, ...patch } as ActiveVoiceRoom;
      }
      return r;
    });
  }, []);
  const value = useMemo(() => ({ activeRoom, minimizeRoom, restoreRoom, clearRoom, updateRoom }), [activeRoom, minimizeRoom, restoreRoom, clearRoom, updateRoom]);
  return <VoiceRoomSessionContext.Provider value={value}>{children}</VoiceRoomSessionContext.Provider>;
}
export function useVoiceRoomSession() { const context = useContext(VoiceRoomSessionContext); if (!context) throw new Error('useVoiceRoomSession must be used inside VoiceRoomSessionProvider'); return context; }
