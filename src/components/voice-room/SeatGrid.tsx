import { Mic, MicOff, Plus, Heart, Lock, Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat, RoomParticipant } from "@/types/room";
import { HostCard } from "./HostCard";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const normalizeCapacity = (value?: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value ?? MAX_CAPACITY)) || MAX_CAPACITY));
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

function EmptySeatArt({ locked }: { locked: boolean }) {
  return <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-[#d7b33d] bg-[radial-gradient(circle_at_35%_28%,#2b6138_0%,#123b27_55%,#071c17_100%)] shadow-[inset_0_0_18px_rgba(0,0,0,.55)]">
    <Armchair className="h-[58%] w-[58%] text-[#b79b28] drop-shadow-[0_2px_2px_rgba(0,0,0,.6)]" strokeWidth={1.6} />
    {!locked && <span className="absolute right-[8%] top-[8%] grid h-3.5 w-3.5 place-items-center rounded-full bg-[color:var(--primary)] text-white shadow"><Plus className="h-2.5 w-2.5" /></span>}
    {locked && <Lock className="absolute h-3.5 w-3.5 text-white/80" />}
  </span>;
}

export function Seat({ seat, onClick }: { seat: RoomSeat; onClick: () => void }) {
  const { user, is_locked, index } = seat;
  if (!user) return <button type="button" onClick={onClick} disabled={is_locked} className="group flex min-w-0 flex-col items-center gap-0 touch-manipulation active:scale-95 disabled:opacity-55" aria-label={is_locked ? `Locked seat ${index}` : `Join seat ${index}`}>
    <span className="relative aspect-square w-[78%] max-w-[68px] rounded-full border-2 p-[2px] shadow-[0_2px_10px_rgba(201,164,47,.24)]"><EmptySeatArt locked={is_locked} /></span>
    <span className="text-[9px] font-semibold tracking-tight text-foreground/90">No.{index}</span>
    <span className="flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-white/10 px-1 py-px text-[8px] text-foreground/70"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />0</span>
  </button>;

  const muted = user.is_muted;
  const speaking = user.is_speaking && !muted;
  return <button type="button" onClick={onClick} className="group relative flex min-w-0 flex-col items-center gap-0 touch-manipulation active:scale-95" aria-label={`Seat ${index}, ${user.username}`}>
    <span className={cn("relative aspect-square w-[78%] max-w-[68px] rounded-full border-2 p-[2px]", speaking ? "border-[color:var(--primary)] shadow-[0_0_16px_rgba(232,60,220,.7)]" : "border-[#c9a42f] shadow-[0_2px_10px_rgba(201,164,47,.24)]")}>
      <span className="relative block h-full w-full overflow-hidden rounded-full bg-background">
        {user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full place-items-center bg-[color:var(--primary)] text-xs font-black text-white">{user.username[0]?.toUpperCase()}</span>}
        {speaking && <span className="absolute inset-1 rounded-full border-2 border-white/80 animate-pulse" />}
      </span>
      <span className={cn("absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-full border border-black/50 text-white", muted ? "bg-red-500" : "bg-emerald-500")}>{muted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}</span>
    </span>
    <span className="max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight text-foreground">{user.username}</span>
    <span className="flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-white/10 px-1 py-px text-[8px] text-foreground/70"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(user.gift_score)}</span>
  </button>;
}

interface SeatGridProps { seats: RoomSeat[]; seatCount?: number; host: RoomParticipant; onSeatTap?: (index: number) => void; onJoinSeat?: (index: number) => void; onHostTap?: () => void; }

/** Master voice-room layout: one five-column seat grid; Host is always visual Seat 1. */
export function SeatGrid({ seats, seatCount, host, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const capacity = normalizeCapacity(seatCount);
  const byIndex = new Map(seats.filter((seat) => seat.index >= 2 && seat.index <= capacity).map((seat) => [seat.index, seat]));
  const participantSlots = Array.from({ length: Math.max(0, capacity - 1) }, (_, offset): RoomSeat => {
    const index = offset + 2;
    return byIndex.get(index) ?? { index, user: null, is_locked: false, is_requested: false };
  });
  const handleTap = (seat: RoomSeat) => { if (seat.user) onSeatTap?.(seat.index); else if (!seat.is_locked) onJoinSeat?.(seat.index); };
  return <section className="h-full w-full min-w-0 overflow-hidden px-2 pt-1 pb-0" data-seat-capacity={capacity}>
    <div className="grid w-full grid-cols-5 content-start gap-x-1 gap-y-1 sm:gap-x-2 sm:gap-y-1.5">
      <div className="relative flex min-w-0 flex-col items-center gap-0">
        <span className="relative aspect-square w-[78%] max-w-[68px] rounded-full border-2 p-[2px] shadow-[0_2px_10px_rgba(201,164,47,.32)]"><HostCard host={host} onTap={onHostTap} /></span>
        <span className="text-[9px] font-bold leading-tight tracking-tight text-foreground">No.1</span>
        <span className="flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-white/10 px-1 py-px text-[8px] leading-tight text-foreground/70"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(host.gift_score ?? 0)}</span>
      </div>
      {participantSlots.map((seat) => <Seat key={seat.index} seat={seat} onClick={() => handleTap(seat)} />)}
    </div>
  </section>;
}
