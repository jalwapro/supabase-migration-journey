import { Mic, MicOff, Plus, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat } from "./types";
import { formatCount } from "./types";

interface SeatProps {
  seat: RoomSeat;
  onTap: (seat: RoomSeat) => void;
}

/** A single voice seat — occupied (avatar + mic state) or empty (+ join button). */
export function Seat({ seat, onTap }: SeatProps) {
  const { user, seatNumber } = seat;

  if (!user) {
    return (
      <button
        onClick={() => onTap(seat)}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed",
          "border-white/15 bg-white/[0.03] px-1.5 py-2.5 transition-all duration-200",
          "hover:border-fuchsia-400/50 hover:bg-fuchsia-500/[0.06] active:scale-95",
        )}
        aria-label={`Join seat ${seatNumber}`}
      >
        <span className="absolute left-1.5 top-1.5 text-[9px] font-semibold text-white/35">{seatNumber}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/40 transition-colors group-hover:border-fuchsia-400/60 group-hover:text-fuchsia-300">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-medium text-white/35">No.{seatNumber}</span>
      </button>
    );
  }

  const speaking = user.mic === "speaking";
  const muted = user.mic === "muted";
  const micOff = user.mic === "off";

  return (
    <button
      onClick={() => onTap(seat)}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2.5",
        "bg-gradient-to-b from-white/[0.06] to-white/[0.02] transition-all duration-200 active:scale-95",
        speaking
          ? "border-fuchsia-400/70 shadow-[0_0_16px_-2px_rgba(232,60,220,0.65)]"
          : "border-white/10 hover:border-white/25",
      )}
      aria-label={`Seat ${seatNumber}, ${user.name}`}
    >
      <span className="absolute left-1.5 top-1.5 z-10 text-[9px] font-semibold text-white/40">{seatNumber}</span>

      <span className="relative">
        <span
          className={cn(
            "absolute inset-0 -m-1 rounded-full",
            speaking && "animate-ping bg-fuchsia-500/40",
          )}
        />
        <span
          className={cn(
            "relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2",
            speaking ? "ring-fuchsia-400" : "ring-violet-500/30",
          )}
        >
          <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" draggable={false} />
        </span>

        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/40 text-[8px]",
            speaking && "bg-fuchsia-500 text-white",
            muted && "bg-red-500 text-white",
            micOff && "bg-white/20 text-white/70",
            user.mic === "on" && "bg-emerald-500 text-white",
          )}
        >
          {muted || micOff ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
        </span>
      </span>

      <span className="max-w-full truncate text-[10px] font-medium text-white/85">{user.name}</span>
      <span className="flex items-center gap-0.5 text-[9px] text-white/40">
        <Heart className="h-2.5 w-2.5 fill-current text-pink-400/70" />
        {formatCount(user.popularity)}
      </span>
    </button>
  );
}

interface SeatsGridProps {
  seats: RoomSeat[];
  onSeatTap: (seat: RoomSeat) => void;
  /** Rendered in the middle of the grid (the host card). */
  center: React.ReactNode;
}

/**
 * Reproduces the wireframe's layout: 8 seats flank the host in two 2-wide
 * columns (left = 1-8, right = 9-16), with the last 4 seats (17-20) spanning
 * a full-width row underneath. Pure CSS grid — no hardcoded pixel positions,
 * so it reflows naturally at any width.
 */
export function SeatsGrid({ seats, onSeatTap, center }: SeatsGridProps) {
  const left = seats.slice(0, 8);
  const right = seats.slice(8, 16);
  const bottom = seats.slice(16, 20);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <div className="grid flex-[2] grid-cols-2 content-start gap-1.5 sm:gap-2">
          {left.map((s) => (
            <Seat key={s.seatNumber} seat={s} onTap={onSeatTap} />
          ))}
        </div>
        <div className="flex-[2.6]">{center}</div>
        <div className="grid flex-[2] grid-cols-2 content-start gap-1.5 sm:gap-2">
          {right.map((s) => (
            <Seat key={s.seatNumber} seat={s} onTap={onSeatTap} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {bottom.map((s) => (
          <Seat key={s.seatNumber} seat={s} onTap={onSeatTap} />
        ))}
      </div>
    </div>
  );
}
