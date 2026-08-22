import { Mic, MicOff, Plus, Heart, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat, RoomParticipant } from "@/types/room";
import { HostCard } from "./HostCard";

const CAPACITIES = [4, 8, 12, 16, 20] as const;
const OCTAGON = { clipPath: "polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)" } as const;
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
const normalizeCapacity = (value?: number) => CAPACITIES.includes(Math.floor(Number(value ?? 20)) as (typeof CAPACITIES)[number]) ? Math.floor(Number(value ?? 20)) : 20;

export function Seat({ seat, onClick }: { seat: RoomSeat; onClick: () => void }) {
  const { user, is_locked, index } = seat;
  if (!user) return <button type="button" onClick={onClick} disabled={is_locked} className="group relative flex min-w-0 min-h-[74px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[color:var(--secondary)]/30 bg-[color:var(--card)]/60 px-1.5 py-2 touch-manipulation active:scale-95 disabled:opacity-60" aria-label={is_locked ? `Locked seat ${index}` : `Join seat ${index}`}><span className="absolute left-1.5 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-[9px] font-bold text-white/70">{index}</span><span className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--secondary)]/30 bg-white/5 text-white/50">{is_locked ? <Lock className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}</span><span className="text-[10px] text-white/50">No. {index}</span><span className="flex items-center gap-0.5 text-[9px] text-white/35"><Heart className="h-2.5 w-2.5" />0</span></button>;
  const muted = user.is_muted, speaking = user.is_speaking && !muted;
  return <button type="button" onClick={onClick} className={cn("group relative flex min-w-0 min-h-[74px] flex-col items-center justify-center gap-1 rounded-xl border-2 bg-[color:var(--card)]/70 px-1.5 py-2 touch-manipulation active:scale-95", speaking ? "border-[color:var(--primary)] shadow-[0_0_18px_-4px_rgba(232,60,220,.7)]" : "border-[color:var(--secondary)]/40")} aria-label={`Seat ${index}, ${user.username}`}><span className="absolute left-1.5 top-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[9px] font-bold text-white/80">{index}</span><span className="relative"><span className={cn("absolute inset-0 -m-1.5 rounded-full", speaking && "animate-ping bg-[color:var(--primary)]/35")} /><span className={cn("relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2", speaking ? "ring-[color:var(--primary)]" : "ring-[color:var(--secondary)]/60")}>{user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full place-items-center bg-[color:var(--primary)] text-xs font-bold text-white">{user.username[0]?.toUpperCase()}</span>}</span><span className={cn("absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/50", muted ? "bg-red-500" : "bg-emerald-500")}>{muted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}</span></span><span className="max-w-full truncate text-[10px] text-[color:var(--foreground)]">{user.username}</span><span className="flex items-center gap-0.5 text-[9px] text-white/55"><Heart className="h-2.5 w-2.5 fill-current text-pink-400/70" />{formatCount(user.gift_score)}</span></button>;
}

function EmbeddedVoiceControls({ micOn, onToggleMic }: { micOn: boolean; onToggleMic: () => void }) { return <div className="flex w-full items-center justify-center pt-1"><button type="button" onClick={onToggleMic} className="flex flex-col items-center gap-1 touch-manipulation" aria-label="Toggle microphone"><span style={OCTAGON} className={cn("flex h-11 w-11 items-center justify-center border-2", micOn ? "border-[color:var(--primary)] bg-[color:var(--primary)]/30" : "border-white/20 bg-white/[0.06]")}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-white/50" />}</span><span className="text-[9px] font-semibold text-white/70">Mic {micOn ? "On" : "Off"}</span></button></div>; }

interface SeatGridProps { seats: RoomSeat[]; seatCount?: number; host: RoomParticipant; micOn: boolean; onToggleMic: () => void; onSeatTap?: (index: number) => void; onJoinSeat?: (index: number) => void; onHostTap?: () => void; }

/** One reusable grid. Seat 1 is always the host; there is no separate host area. */
export function SeatGrid({ seats, seatCount, host, micOn, onToggleMic, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const capacity = normalizeCapacity(seatCount);
  // The visual room contract is 1..capacity with the host permanently occupying #1.
  // Participant seat records are rendered only in slots 2..capacity.
  const byIndex = new Map(seats.filter((seat) => seat.index >= 2 && seat.index <= capacity).map((seat) => [seat.index, seat]));
  const participantSlots = Array.from({ length: Math.max(0, capacity - 1) }, (_, offset) => {
    const index = offset + 2;
    return byIndex.get(index) ?? ({ index, user: null, is_locked: false } as RoomSeat);
  });
  const handleTap = (seat: RoomSeat) => { if (seat.user) onSeatTap?.(seat.index); else if (!seat.is_locked) onJoinSeat?.(seat.index); };
  return <section className={cn("flex w-full min-w-0 flex-col px-2.5", capacity >= 16 ? "gap-1.5" : "gap-2")} data-seat-capacity={capacity}>
    <div className="grid w-full min-w-0 grid-cols-4 gap-1.5 sm:gap-2">
      <div className="relative col-span-1 row-span-2 min-h-[158px] min-w-0"><span className="absolute left-1.5 top-1 z-20 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[10px] font-black text-white">1</span><HostCard host={host} onTap={onHostTap} /></div>
      {participantSlots.map((seat) => <Seat key={seat.index} seat={seat} onClick={() => handleTap(seat)} />)}
    </div>
    <EmbeddedVoiceControls micOn={micOn} onToggleMic={onToggleMic} />
  </section>;
}
