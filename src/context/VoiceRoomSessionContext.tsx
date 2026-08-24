import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type ActiveVoiceRoom = {
  roomId: string;
  roomName?: string | null;
  roomAvatar?: string | null;
  roomRoute: string;
  userRole?: string | null;
  isMinimized: boolean;
  connectionState?: string | null;
  microphoneMuted?: boolean;
};

type VoiceRoomSessionContextValue = {
  activeRoom: ActiveVoiceRoom | null;
  minimizeRoom: (room: Omit<ActiveVoiceRoom, 'isMinimized'>) => void;
  restoreRoom: () => void;
  clearRoom: () => void;
  updateRoom: (patch: Partial<ActiveVoiceRoom>) => void;
};

const STORAGE_KEY = 'jalwa:active-voice-room';
const VoiceRoomSessionContext = createContext<VoiceRoomSessionContextValue | null>(null);

export function VoiceRoomSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ActiveVoiceRoom | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user) {
      setActiveRoom(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (activeRoom) localStorage.setItem(STORAGE_KEY, JSON.stringify(activeRoom));
    else localStorage.removeItem(STORAGE_KEY);
  }, [activeRoom, user]);

  const minimizeRoom = useCallback((room: Omit<ActiveVoiceRoom, 'isMinimized'>) => {
    setActiveRoom({ ...room, isMinimized: true });
  }, []);
  const restoreRoom = useCallback(() => setActiveRoom(r => r ? { ...r, isMinimized: false } : r), []);
  const clearRoom = useCallback(() => setActiveRoom(null), []);
  const updateRoom = useCallback((patch: Partial<ActiveVoiceRoom>) => setActiveRoom(r => r ? { ...r, ...patch } : r), []);

  const value = useMemo(() => ({ activeRoom, minimizeRoom, restoreRoom, clearRoom, updateRoom }), [activeRoom, minimizeRoom, restoreRoom, clearRoom, updateRoom]);
  return <VoiceRoomSessionContext.Provider value={value}>{children}</VoiceRoomSessionContext.Provider>;
}

export function useVoiceRoomSession() {
  const context = useContext(VoiceRoomSessionContext);
  if (!context) throw new Error('useVoiceRoomSession must be used inside VoiceRoomSessionProvider');
  return context;
}
