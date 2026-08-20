import React from "react";
import { RoomState, RoomParticipant, RoomSeat } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { HostCard } from "./HostCard";
import { SeatGrid } from "./SeatGrid";
import { RoomAdaptiveContainer } from "../room-shared/RoomAdaptiveContainer";
import { GlassPanel } from "../room-shared/PremiumStyles";
import { MessageSquare, Mic, Gift, Grid, MicOff } from "lucide-react";

interface VoiceRoomScreenProps {
  room: RoomState;
  onOpenChat: () => void;
  onOpenGift: () => void;
  onOpenMore: () => void;
  onToggleMic: () => void;
  onSeatTap: (index: number) => void;
  onJoinSeat: (index: number) => void;
  isHost: boolean;
  mySeatIndex: number | null;
  viewerCount: number;
}

export const VoiceRoomScreen = ({ 
  room, 
  onOpenChat, 
  onOpenGift, 
  onOpenMore, 
  onToggleMic, 
  onSeatTap,
  onJoinSeat,
  isHost,
  mySeatIndex,
  viewerCount
}: VoiceRoomScreenProps) => {
  const isMuted = room.host.is_muted;
  const isSeated = mySeatIndex !== null;

  return (
    <RoomAdaptiveContainer>
      <RoomHeader room={room} />
      
      <div className="flex flex-1 flex-col overflow-y-auto pb-24 scrollbar-hide">
        {/* Host Section */}
        <HostCard host={room.host} />

        {/* Announcement Ticker */}
        <div className="mx-4 mb-6">
          <GlassPanel className="py-2 px-4 border border-white/5 bg-white/5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="rounded bg-gradient-to-r from-fuchsia-600 to-purple-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow-sm">Notice</span>
              <p className="truncate text-[11px] font-medium text-white/70">
                Welcome to JALWA Global Live! Follow the host and enjoy the luxury experience.
              </p>
            </div>
          </GlassPanel>
        </div>

        {/* Participants Grid */}
        <div className="px-2">
          <SeatGrid 
            seats={room.seats} 
            onSeatTap={onSeatTap} 
            onJoinSeat={onJoinSeat} 
          />
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenChat}
            className="flex h-12 flex-1 items-center gap-3 rounded-full border border-white/10 bg-black/40 px-5 text-white backdrop-blur-xl active:scale-95 transition-transform"
          >
            <MessageSquare className="h-5 w-5 text-white/60" />
            <span className="text-sm font-bold text-white/40">Say something...</span>
          </button>

          <div className="flex items-center gap-2">
            {(isHost || isSeated) && (
              <button 
                onClick={onToggleMic}
                className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl active:scale-95 transition-all ${
                  room.host.is_muted ? 'text-rose-400 border-rose-500/30' : 'text-emerald-400 border-emerald-500/30'
                }`}
              >
                {room.host.is_muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            <button 
              onClick={onOpenMore}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl active:scale-95 transition-transform"
            >
              <Grid className="h-5 w-5" />
            </button>
            <button 
              onClick={onOpenGift}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/40 active:scale-95 transition-all hover:brightness-110"
            >
              <Gift className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </RoomAdaptiveContainer>
  );
};
