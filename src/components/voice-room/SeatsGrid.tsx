import { Mic, MicOff, Plus, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat } from "./types";
import { formatCount } from "./types";

interface SeatProps {
  seat: RoomSeat;
  onTap: (seat: RoomSeat) => void;
}

/** A single voice seat — occupied (photo + mic ring) or empty (+ join). */
export function Seat({ seat, onTap }: SeatProps) {
  const { user, seatNumber } = seat;

  if (!user) {
    return (
      <button
        onClick={() => onTap(seat)}
        className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-violet-400/25 bg-gradient-to-b from-white/[0.04] to-transparent px-1.5 py-2.5 transition-all duration-200 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/[0.06] active:scale-95"
        aria-label={`Join seat ${seatNumber}`}
      >
        <span className="absolute left-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-[9px] font-bold text-white/60 ring-1 ring-white/15">
          {seatNumber}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/25 bg-white/5 text-white/40 transition-colors group-hover:border-fuchsia-400/70 group-hover:text-fuchsia-300 group-hover:shadow-[0_0_12px_-2px_rgba(232,60,220,0.7)]">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-medium text-white/40">No.{seatNumber}</span>
        <span className="flex items-center gap-0.5 text-[9px] text-white/25">
          <Heart className="h-2.5 w-2.5" />0
        </span>
      </button>
    );
  }

  const speaking = user.mic === "speaking";
  const muted = user.mic === "muted";
  const micOff = user.mic === "off";
  const isMuted = muted || micOff;

  return (
    <button
      onClick={() => onTap(seat)}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1.5 py-2.5 transition-all duration-200 active:scale-95",
        "bg-gradient-to-b from-white/[0.07] to-black/40",
        speaking
          ? "border-fuchsia-400 shadow-[0_0_18px_-2px_rgba(232,60,220,0.75)]"
          : "border-violet-400/40 shadow-[0_0_10px_-4px_rgba(139,92,246,0.5)] hover:border-violet-300/70",
      )}
      aria-label={`Seat ${seatNumber}, ${user.name}`}
    >
      {/* corner accents for a framed/premium feel */}
      <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 rounded-tl-2xl border-l-2 border-t-2 border-cyan-300/70" />
      <span className="pointer-events-none absolute -right-px -bottom-px h-3 w-3 rounded-br-2xl border-b-2 border-r-2 border-fuchsia-300/70" />

      <span className="absolute left-1.5 top-1.5 z-10 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[9px] font-bold text-white/80 ring-1 ring-white/20">
        {seatNumber}
      </span>

      <span className="relative">
        <span className={cn("absolute inset-0 -m-1.5 rounded-full", speaking && "animate-ping bg-fuchsia-500/40")} />
        <span
          className={cn(
            "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ring-2",
            speaking ? "ring-fuchsia-400" : "ring-cyan-400/50",
          )}
        >
          <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" draggable={false} />
        </span>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/50",
            isMuted ? "bg-red-500 text-white" : "bg-emerald-500 text-white",
          )}
        >
          {isMuted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
        </span>
      </span>

      <span className="max-w-full truncate text-[10px] font-medium text-white/90">{user.name}</span>
      <span className="flex items-center gap-0.5 text-[9px] text-white/45">
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
 * Reproduces the reference layout: 8 seats flank the host in two 2-wide
 * columns (left = 1-8, right = 9-16), with the last 4 seats (17-20) spanning
 * a full-width row underneath. Pure flex/grid — no hardcoded positions.
 */
export function SeatsGrid({ seats, onSeatTap, center }: SeatsGridProps) {
  const left = seats.slice(0, 8);
  const right = seats.slice(8, 16);
  const bottom = seats.slice(16, 20);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex w-full min-w-0 items-stretch gap-1.5 sm:gap-2">
        <div className="grid min-w-0 flex-[2] grid-cols-2 content-start gap-1.5 sm:gap-2">
          {left.map((s) => (
            <Seat key={s.seatNumber} seat={s} onTap={onSeatTap} />
          ))}
        </div>
        <div className="min-w-0 flex-[2.6]">{center}</div>
        <div className="grid min-w-0 flex-[2] grid-cols-2 content-start gap-1.5 sm:gap-2">
          {right.map((s) => (
            <Seat key={s.seatNumber} seat={s} onTap={onSeatTap} />
          ))}
        </div>
      </div>
      <div className="grid w-full min-w-0 grid-cols-4 gap-1.5 sm:gap-2">
        {bottom.map((s) => (
          <Seat key={s.seatNumber} seat={s} onTap={onSeatTap} />
        ))}
      </div>
    </div>
  );
}
