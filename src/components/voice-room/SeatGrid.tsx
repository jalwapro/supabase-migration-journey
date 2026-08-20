import React from "react";
import { RoomSeat } from "@/types/room";
import { NeonBorder } from "@/components/room-shared/PremiumStyles";
import { MicOff, Lock } from "lucide-react";

interface SeatProps {
  seat: RoomSeat;
  onClick?: () => void;
}

export const Seat = ({ seat, onClick }: SeatProps) => {
  const { user, is_locked, index } = seat;

  return (
    <div className="flex flex-col items-center gap-1.5" onClick={onClick}>
      <div className="relative">
        {user ? (
          <NeonBorder color={user.is_speaking ? "primary" : "secondary"}>
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-zinc-800">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-bold">
                  {user.username[0]}
                </div>
              )}
              {user.is_muted && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <MicOff className="h-4 w-4 text-white/70" />
                </div>
              )}
              {user.is_speaking && (
                <div className="absolute inset-0 animate-pulse rounded-full border-2 border-fuchsia-500" />
              )}
            </div>
          </NeonBorder>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/10 bg-white/5 transition-colors hover:bg-white/10">
            {is_locked ? (
              <Lock className="h-5 w-5 text-white/30" />
            ) : (
              <span className="text-xs font-bold text-white/30">{index + 1}</span>
            )}
          </div>
        )}

        {user && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-1.5 py-0.5 text-[8px] font-black uppercase ring-1 ring-white/20">
            Lv.{user.level}
          </div>
        )}
      </div>
      <span className="max-w-[64px] truncate text-[10px] font-medium text-white/70">
        {user ? user.username : is_locked ? "Locked" : `Seat ${index + 1}`}
      </span>
    </div>
  );
};

interface SeatGridProps {
  seats: RoomSeat[];
  onSeatTap?: (index: number) => void;
  onJoinSeat?: (index: number) => void;
}

export const SeatGrid = ({ seats, onSeatTap, onJoinSeat }: SeatGridProps) => {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-6 px-4 pb-8">
      {seats.map((seat) => (
        <Seat
          key={seat.index}
          seat={seat}
          onClick={() => {
            if (seat.user) {
              onSeatTap?.(seat.index);
            } else {
              onJoinSeat?.(seat.index);
            }
          }}
        />
      ))}
    </div>
  );
};
