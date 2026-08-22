import { Mic, MicOff, Plus, Heart, Lock, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat, RoomParticipant } from "@/types/room";
import { HostCard } from "./HostCard";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const OCTAGON = { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" } as const;

interface SeatProps {
  seat: RoomSeat;
  onClick: () => void;
}

/** A single voice seat — square card, occupied (photo + mic ring) or empty (+ join). */
export function Seat({ seat, onClick }: SeatProps) {
  const { user, is_locked, index } = seat;

  if (!user) {
    return (
      <button
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-violet-400/25 bg-gradient-to-b from-white/[0.04] to-transparent px-1.5 py-2.5 transition-all duration-200 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/[0.06] active:scale-95"
        aria-label={is_locked ? `Locked seat ${index}` : `Join seat ${index}`}
      >
        <span className="absolute left-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-[9px] font-bold text-white/60 ring-1 ring-white/15">
          {index}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/25 bg-white/5 text-white/40 transition-colors group-hover:border-fuchsia-400/70 group-hover:text-fuchsia-300">
          {is_locked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
        <span className="text-[10px] font-medium text-white/40">No.{index}</span>
        <span className="flex items-center gap-0.5 text-[9px] text-white/25">
          <Heart className="h-2.5 w-2.5" />0
        </span>
      </button>
    );
  }

  const isMuted = user.is_muted;
  const speaking = user.is_speaking && !isMuted;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-1.5 py-2.5 transition-all duration-200 active:scale-95",
        "bg-gradient-to-b from-white/[0.07] to-black/40",
        speaking
          ? "border-fuchsia-400 shadow-[0_0_18px_-2px_rgba(232,60,220,0.75)]"
          : "border-violet-400/40 shadow-[0_0_10px_-4px_rgba(139,92,246,0.5)] hover:border-violet-300/70",
      )}
      aria-label={`Seat ${index}, ${user.username}`}
    >
      <span className="absolute left-1.5 top-1.5 z-10 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[9px] font-bold text-white/80 ring-1 ring-white/20">
        {index}
      </span>

      <span className="relative">
        <span className={cn("absolute inset-0 -m-1.5 rounded-full", speaking && "animate-ping bg-fuchsia-500/40")} />
        <span
          className={cn(
            "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ring-2",
            speaking ? "ring-fuchsia-400" : "ring-cyan-400/50",
          )}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xs font-bold text-white">
              {user.username[0]?.toUpperCase()}
            </span>
          )}
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

      <span className="max-w-full truncate text-[10px] font-medium text-white/90">{user.username}</span>
      <span className="flex items-center gap-0.5 text-[9px] text-white/45">
        <Heart className="h-2.5 w-2.5 fill-current text-pink-400/70" />
        {formatCount(user.gift_score)}
      </span>
    </button>
  );
}

interface VoiceControlsProps {
  micOn: boolean;
  onToggleMic: () => void;
}

function EmbeddedVoiceControls({ micOn, onToggleMic }: VoiceControlsProps) {
  return (
    <div className="flex w-full items-center justify-center gap-4 pt-1">
      <span
        style={OCTAGON}
        className="flex h-9 w-9 items-center justify-center border-2 border-violet-400/50 bg-gradient-to-b from-white/[0.06] to-black/40 text-white/70"
      >
        <Volume2 className="h-4 w-4" />
      </span>

      <button onClick={onToggleMic} className="flex flex-col items-center gap-1" aria-label="Toggle microphone">
        <span
          style={OCTAGON}
          className={cn(
            "flex h-[52px] w-[52px] items-center justify-center border-[3px] transition-colors",
            micOn
              ? "border-fuchsia-400 bg-gradient-to-b from-fuchsia-500 to-violet-700 shadow-[0_0_20px_-2px_rgba(232,60,220,0.9)]"
              : "border-white/20 bg-white/[0.06]",
          )}
        >
          {micOn ? <Mic className="h-5 w-5 text-white" /> : <MicOff className="h-5 w-5 text-white/50" />}
        </span>
        <span className="flex items-center gap-1 text-[9px] font-semibold text-white/70">
          <span className={cn("h-1.5 w-1.5 rounded-full", micOn ? "bg-emerald-400" : "bg-white/30")} />
          Mic {micOn ? "On" : "Off"}
        </span>
      </button>

      <span
        style={OCTAGON}
        className="flex h-9 w-9 items-center justify-center border-2 border-violet-400/50 bg-gradient-to-b from-white/[0.06] to-black/40 text-white/70"
      >
        <VolumeX className="h-4 w-4" />
      </span>
    </div>
  );
}

interface SeatGridProps {
  seats: RoomSeat[];
  host: RoomParticipant;
  micOn: boolean;
  onToggleMic: () => void;
  onSeatTap?: (index: number) => void;
  onJoinSeat?: (index: number) => void;
  onHostTap?: () => void;
}

/**
 * Reproduces the wireframe layout: seats 1-8 flank the host in two 2-wide
 * columns on the left, seats 9-16 on the right, seats 17-20 span a
 * full-width row underneath, and the host card + voice controls sit center.
 */
export function SeatGrid({ seats, host, micOn, onToggleMic, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const byIndex = new Map(seats.map((s) => [s.index, s]));
  const pick = (indices: number[]) => indices.map((i) => byIndex.get(i)).filter((s): s is RoomSeat => !!s);

  const left = pick([1, 2, 3, 4, 5, 6, 7, 8]);
  const right = pick([9, 10, 11, 12, 13, 14, 15, 16]);
  const bottom = pick([17, 18, 19, 20]);

  const handleTap = (seat: RoomSeat) => {
    if (seat.user) onSeatTap?.(seat.index);
    else onJoinSeat?.(seat.index);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 px-2.5 sm:px-3">
      <div className="flex w-full min-w-0 items-stretch gap-2">
        <div className="grid min-w-0 flex-[2] grid-cols-2 content-start gap-2">
          {left.map((s) => (
            <Seat key={s.index} seat={s} onClick={() => handleTap(s)} />
          ))}
        </div>

        <div className="flex min-w-0 flex-[2.6] flex-col items-center gap-2">
          <HostCard host={host} onTap={onHostTap} />
          <EmbeddedVoiceControls micOn={micOn} onToggleMic={onToggleMic} />
        </div>

        <div className="grid min-w-0 flex-[2] grid-cols-2 content-start gap-2">
          {right.map((s) => (
            <Seat key={s.index} seat={s} onClick={() => handleTap(s)} />
          ))}
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-4 gap-2">
        {bottom.map((s) => (
          <Seat key={s.index} seat={s} onClick={() => handleTap(s)} />
        ))}
      </div>
    </div>
  );
}
