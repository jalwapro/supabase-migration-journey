import React from "react";
import { RoomState } from "@/types/room";
import { SeatGrid } from "./SeatGrid";
import { RoomAdaptiveContainer } from "../room-shared/RoomAdaptiveContainer";
import { MessageSquare, Mic, Gift, MoreHorizontal, Users, Share2, X, Trophy, MicOff } from "lucide-react";

interface VoiceRoomScreenProps {
  room: RoomState;
  onOpenChat: () => void;
  onOpenGift: () => void;
  onOpenMore: () => void;
  onToggleMic: () => void;
  onSeatTap: (index: number) => void;
  onJoinSeat: (index: number) => void;
  onExit?: () => void;
  onShare?: () => void;
  onOnline?: () => void;
  onRanking?: () => void;
  isHost: boolean;
  mySeatIndex: number | null;
  viewerCount: number;
  isMicMuted?: boolean;
}

export const VoiceRoomScreen = ({
  room,
  onOpenChat,
  onOpenGift,
  onOpenMore,
  onToggleMic,
  onSeatTap,
  onJoinSeat,
  onExit,
  onShare,
  onOnline,
  onRanking,
  isHost,
  mySeatIndex,
  viewerCount,
  isMicMuted = true,
}: VoiceRoomScreenProps) => {
  const isSeated = mySeatIndex !== null;
  const canUseMic = isHost || isSeated;
  const occupied = room.seats.filter((seat) => !!seat.user).length;

  return (
    <RoomAdaptiveContainer>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(168,85,247,0.20),transparent_38%),linear-gradient(180deg,#160523_0%,#07030d_48%,#020205_100%)] text-white">
        <header className="relative z-20 shrink-0 px-3 pt-[max(10px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-2.5 py-2 backdrop-blur-xl">
            <button type="button" onClick={onExit} aria-label="Close room" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white active:scale-95">
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black">{room.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/50"><span>LIVE</span><span>•</span><span>ID {room.id.slice(0, 8)}</span></div>
            </div>
            <button type="button" onClick={onOnline} aria-label="View online users" className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-bold active:scale-95">
              <Users className="h-4 w-4" />{viewerCount}
            </button>
            <button type="button" onClick={onShare} aria-label="Share room" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 active:scale-95"><Share2 className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={onRanking} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold text-amber-100 active:scale-[0.99]">
              <Trophy className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Room ranking • {occupied} on stage</span>
            </button>
            <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-200">Voice</div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-28 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-2 mb-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-fuchsia-300/40 bg-gradient-to-br from-fuchsia-500/30 to-violet-700/30">
                {room.host.avatar ? <img src={room.host.avatar} alt={room.host.username} className="h-full w-full object-cover" /> : <span className="text-base font-black">{room.host.username.slice(0, 1).toUpperCase()}</span>}
                {room.host.is_speaking && <span className="pointer-events-none absolute inset-[-2px] animate-pulse rounded-full border-2 border-fuchsia-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><span className="truncate text-sm font-black">{room.host.username}</span><span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[8px] font-black text-amber-200">HOST</span></div>
                <div className="mt-1 text-[10px] text-white/45">{room.host.is_muted ? "Muted" : "Speaking enabled"}</div>
              </div>
            </div>
          </div>
          <div className="px-1"><SeatGrid seats={room.seats} onSeatTap={onSeatTap} onJoinSeat={onJoinSeat} /></div>
        </main>

        <footer className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <div className="rounded-[24px] border border-white/10 bg-black/60 p-2.5 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center gap-2">
              <button type="button" onClick={onOpenChat} aria-label="Open room chat" className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-left active:scale-[0.98]"><MessageSquare className="h-5 w-5 shrink-0 text-white/60" /><span className="truncate text-xs font-bold text-white/45">Say something...</span></button>
              <button type="button" onClick={onToggleMic} disabled={!canUseMic} aria-label={canUseMic ? (isMicMuted ? "Turn microphone on" : "Mute microphone") : "Take a seat to use microphone"} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${!isMicMuted ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/10 text-white"}`}>
                {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button type="button" onClick={onOpenMore} aria-label="Open room controls" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/10 text-white active:scale-95"><MoreHorizontal className="h-5 w-5" /></button>
              <button type="button" onClick={onOpenGift} aria-label="Send gift" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-700 text-white shadow-[0_0_20px_rgba(217,70,239,0.35)] active:scale-95"><Gift className="h-5 w-5" /></button>
            </div>
            {!canUseMic && <div className="pt-1 text-center text-[9px] font-medium text-white/35">Take a seat before enabling your microphone</div>}
          </div>
        </footer>
      </div>
    </RoomAdaptiveContainer>
  );
};
