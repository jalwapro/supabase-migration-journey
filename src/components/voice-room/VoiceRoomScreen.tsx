import React from "react";
import { RoomState } from "@/types/room";
import { RoomHeader } from "./RoomHeader";
import { SeatGrid } from "./SeatGrid";
import { RoomAdaptiveContainer } from "../room-shared/RoomAdaptiveContainer";
import { MessageSquare, Mic, Gift, MoreHorizontal, Users, MicOff } from "lucide-react";

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
  viewerCount,
}: VoiceRoomScreenProps) => {
  const isSeated = mySeatIndex !== null;
  const isMuted = room.host.is_muted;
  const seatCount = room.seats?.length ?? 0;

  return (
    <RoomAdaptiveContainer>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_-10%,rgba(217,70,239,.18),transparent_45%),linear-gradient(180deg,#120b20_0%,#08070d_55%,#050509_100%)] text-white">
        <RoomHeader room={room} />

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-32 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.045] px-3 py-2.5 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300"><Users className="h-3.5 w-3.5" /></span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-white/90">Live Voice Room</p>
                <p className="text-[9px] text-white/45">{viewerCount.toLocaleString()} listeners · {seatCount} seats</p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">LIVE</span>
          </div>

          <section className="rounded-[28px] border border-white/[0.07] bg-black/10 px-1 py-3 shadow-2xl shadow-black/20">
            <SeatGrid seats={room.seats} onSeatTap={onSeatTap} onJoinSeat={onJoinSeat} />
          </section>
        </main>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#050509] via-[#050509]/95 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-16">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <button type="button" onClick={onOpenChat} aria-label="Open chat" className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.07] px-4 text-left backdrop-blur-2xl transition active:scale-[.98]">
              <MessageSquare className="h-4 w-4 shrink-0 text-white/50" />
              <span className="truncate text-xs font-medium text-white/40">Say something...</span>
            </button>

            {(isHost || isSeated) && (
              <button type="button" onClick={onToggleMic} aria-label={isMuted ? "Unmute microphone" : "Mute microphone"} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border backdrop-blur-2xl transition active:scale-95 ${isMuted ? "border-rose-400/30 bg-rose-500/15 text-rose-300" : "border-white/10 bg-white/[0.07] text-white"}`}>
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}

            <button type="button" onClick={onOpenMore} aria-label="More room actions" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/80 backdrop-blur-2xl transition active:scale-95">
              <MoreHorizontal className="h-5 w-5" />
            </button>

            <button type="button" onClick={onOpenGift} aria-label="Send gift" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-600/30 transition active:scale-95">
              <Gift className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </RoomAdaptiveContainer>
  );
};
