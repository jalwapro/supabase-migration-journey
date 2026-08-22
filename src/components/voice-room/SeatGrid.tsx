import { Mic, MicOff, Plus, Heart, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat, RoomParticipant } from "@/types/room";
import { HostCard } from "./HostCard";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const OCTAGON = { clipPath: "polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)" } as const;
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
const normalizeCapacity = (value?: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value ?? MAX_CAPACITY)) || MAX_CAPACITY));

export function Seat({ seat, onClick }: { seat: RoomSeat; onClick: () => void }) {
  const { user, is_locked, index } = seat;
  if (!user) return <button type="button" onClick={onClick} disabled={is_locked} className="group relative flex min-w-0 aspect-square flex-col items-center justify-center gap-0.5 rounded-full border-2 border-[color:var(--secondary)]/50 bg-[color:var(--card)]/55 px-1 touch-manipulation active:scale-95 disabled:opacity-60" aria-label={is_locked ? `Locked seat ${index}` : `Join seat ${index}`}><span className="flex h-[72%] w-[72%] max-h-20 max-w-20 items-center justify-center rounded-full border-2 border-[color:var(--secondary)]/70 bg-[color:var(--card)]/60"><span className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white/60">{is_locked ? <Lock className="h-4 w-4" /> : <Plus className="h-5 w-5" />}</span></span><span className="text-[10px] font-semibold text-[color:var(--foreground)]">No.{index}</span><span className="flex items-center gap-0.5 text-[9px] text-foreground/55"><Heart className="h-2.5 w-2.5 fill-current text-pink-400" />0</span></button>;
  const muted = user.is_muted, speaking = user.is_speaking && !muted;
  return <button type="button" onClick={onClick} className={cn("group relative flex min-w-0 aspect-square flex-col items-center justify-center gap-0.5 rounded-full border-2 bg-[color:var(--card)]/45 px-1 touch-manipulation active:scale-95", speaking ? "border-[color:var(--primary)] shadow-[0_0_18px_-4px_rgba(232,60,220,.7)]" : "border-[color:var(--secondary)]/70")} aria-label={`Seat ${index}, ${user.username}`}><span className="relative flex h-[72%] w-[72%] max-h-20 max-w-20 items-center justify-center"><span className={cn("absolute inset-0 rounded-full", speaking && "animate-ping bg-[color:var(--primary)]/35")} /><span className={cn("relative flex h-full w-full items-center justify-center overflow-hidden rounded-full ring-2", speaking ? "ring-[color:var(--primary)]" : "ring-[color:var(--secondary)]/60")}>{user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full place-items-center bg-[color:var(--primary)] text-sm font-bold text-white">{user.username[0]?.toUpperCase()}</span>}</span><span className={cn("absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border border-black/50", muted ? "bg-red-500" : "bg-emerald-500")}>{muted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}</span></span><span className="max-w-full truncate text-[10px] font-semibold text-[color:var(--foreground)]">{user.username}</span><span className="flex items-center gap-0.5 text-[9px] text-foreground/55"><Heart className="h-2.5 w-2.5 fill-current text-pink-400" />{formatCount(user.gift_score)}</span></button>;
}

interface SeatGridProps { seats: RoomSeat[]; seatCount?: number; seatCount?: number; seatCount?: number; host: RoomParticipant; micOn: boolean; onToggleMic: () => void; onSeatTap?: (index: number) => void; onJoinSeat?: (index: number) => void; onHostTap?: () => void; }

/** Reference layout: one 5-column seat grid. Seat 1 is always the host; capacity is any whole number from 4 through 20. */
export function SeatGrid({ seats, seatCount, host, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const capacity = normalizeCapacity(seatCount);
  const byIndex = new Map(seats.filter((seat) => seat.index >= 2 && seat.index <= capacity).map((seat) => [seat.index, seat]));
  const participantSlots = Array.from({ length: Math.max(0, capacity - 1) }, (_, offset) => {
    const index = offset + 2;
    return byIndex.get(index) ?? ({ index, user: null, is_locked: false } as RoomSeat);
  });
  const handleTap = (seat: RoomSeat) => { if (seat.user) onSeatTap?.(seat.index); else if (!seat.is_locked) onJoinSeat?.(seat.index); };
  return <section className="w-full min-w-0 px-3 py-2" data-seat-capacity={capacity}>
    <div className="grid w-full grid-cols-5 gap-x-2 gap-y-3 sm:gap-x-3 sm:gap-y-4">
      <div className="relative min-w-0 aspect-square"><span className="absolute left-1 top-1 z-20 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-[10px] font-black text-white">1</span><HostCard host={host} onTap={onHostTap} /></div>
      {participantSlots.map((seat) => <Seat key={seat.index} seat={seat} onClick={() => handleTap(seat)} />)}
    </div>
  </section>;
}
