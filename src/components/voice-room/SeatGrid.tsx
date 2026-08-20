import React from "react";
import { RoomSeat } from "@/types/room";
import { MicOff, Lock, Plus } from "lucide-react";

interface SeatProps { seat: RoomSeat; onClick?: () => void; }

export const Seat = ({ seat, onClick }: SeatProps) => {
  const { user, is_locked, index } = seat;
  const label = user?.username || (is_locked ? "Locked" : `Seat ${index + 1}`);
  const initial = (user?.username || "?").slice(0, 1).toUpperCase();

  return (
    <button type="button" onClick={onClick} aria-label={label} className="group flex min-w-0 flex-col items-center gap-1.5 outline-none">
      <div className="relative h-[66px] w-[66px]">
        {user ? (
          <div className={`absolute inset-0 rounded-full p-[2px] transition-transform duration-200 group-active:scale-95 ${user.is_speaking ? "bg-gradient-to-r from-fuchsia-300 via-fuchsia-500 to-violet-500 shadow-[0_0_0_3px_rgba(217,70,239,.10),0_0_22px_rgba(217,70,239,.35)]" : "bg-gradient-to-b from-white/20 to-white/[0.05]"}`}>
            <div className="relative h-full w-full overflow-hidden rounded-full bg-[#17121e] ring-2 ring-black/40">
              {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/25 to-violet-500/20 text-xl font-bold text-white">{initial}</div>}
              {user.is_muted && <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black/40 bg-black/75 text-rose-300"><MicOff className="h-2.5 w-2.5" /></span>}
            </div>
          </div>
        ) : (
          <div className={`flex h-full w-full items-center justify-center rounded-full border ${is_locked ? "border-amber-300/15 bg-amber-300/[0.04]" : "border-white/10 bg-white/[0.035]"}`}>
            {is_locked ? <Lock className="h-4 w-4 text-amber-200/35" /> : <Plus className="h-5 w-5 text-white/25 transition group-active:scale-90" />}
          </div>
        )}
        {user && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#18101f]/95 px-1.5 py-0.5 text-[7px] font-extrabold tracking-wide text-fuchsia-100 shadow-lg">LV {user.level}</span>}
      </div>
      <span className="w-full max-w-[72px] truncate text-center text-[9px] font-semibold text-white/60">{label}</span>
    </button>
  );
};

interface SeatGridProps { seats: RoomSeat[]; onSeatTap?: (index: number) => void; onJoinSeat?: (index: number) => void; }

export const SeatGrid = ({ seats, onSeatTap, onJoinSeat }: SeatGridProps) => {
  const displaySeats = seats.slice(0, 20);
  return (
    <div className="grid grid-cols-4 gap-x-1 gap-y-6 px-2 py-3 sm:grid-cols-5 sm:gap-x-2 sm:gap-y-7">
      {displaySeats.map((seat) => (
        <Seat key={seat.index} seat={seat} onClick={() => seat.user ? onSeatTap?.(seat.index) : onJoinSeat?.(seat.index)} />
      ))}
    </div>
  );
};
