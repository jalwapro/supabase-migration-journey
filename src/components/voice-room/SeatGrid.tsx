import { Mic, MicOff, Plus, Heart, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat, RoomParticipant } from "@/types/room";
import { HostCard } from "./HostCard";

function formatCount(n: number): string { if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`; return `${n}`; }
const OCTAGON = { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" } as const;

export function Seat({ seat, onClick }: { seat: RoomSeat; onClick: () => void }) {
  const { user, is_locked, index } = seat;
  if (!user) return <button type="button" onClick={onClick} disabled={is_locked} className="group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-violet-400/25 bg-gradient-to-b from-white/[0.04] to-transparent px-1.5 py-2.5 touch-manipulation active:scale-95 disabled:cursor-not-allowed disabled:opacity-70" aria-label={is_locked ? `Locked seat ${index}` : `Join seat ${index}`}><span className="absolute left-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-[9px] font-bold text-white/60">{index}</span><span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/25 bg-white/5 text-white/40">{is_locked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span><span className="text-[10px] font-medium text-white/40">No.{index}</span><span className="flex items-center gap-0.5 text-[9px] text-white/25"><Heart className="h-2.5 w-2.5" />0</span></button>;
  const isMuted = user.is_muted;
  const speaking = user.is_speaking && !isMuted;
  return <button type="button" onClick={onClick} className={cn("group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1.5 py-2.5 touch-manipulation active:scale-95", "bg-gradient-to-b from-white/[0.07] to-black/40", speaking ? "border-fuchsia-400 shadow-[0_0_18px_-2px_rgba(232,60,220,0.75)]" : "border-violet-400/40 shadow-[0_0_10px_-4px_rgba(139,92,246,0.5)]")} aria-label={`Seat ${index}, ${user.username}`}><span className="absolute left-1.5 top-1.5 z-10 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[9px] font-bold text-white/80">{index}</span><span className="relative"><span className={cn("absolute inset-0 -m-1.5 rounded-full", speaking && "animate-ping bg-fuchsia-500/40")} /><span className={cn("relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ring-2", speaking ? "ring-fuchsia-400" : "ring-cyan-400/50")}>{user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xs font-bold text-white">{user.username[0]?.toUpperCase()}</span>}</span><span className={cn("absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/50", isMuted ? "bg-red-500 text-white" : "bg-emerald-500 text-white")}>{isMuted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}</span></span><span className="max-w-full truncate text-[10px] font-medium text-white/90">{user.username}</span><span className="flex items-center gap-0.5 text-[9px] text-white/45"><Heart className="h-2.5 w-2.5 fill-current text-pink-400/70" />{formatCount(user.gift_score)}</span></button>;
}

function EmbeddedVoiceControls({ micOn, onToggleMic }: { micOn: boolean; onToggleMic: () => void }) { return <div className="flex w-full items-center justify-center pt-1"><button type="button" onClick={onToggleMic} className="flex flex-col items-center gap-1 touch-manipulation" aria-label="Toggle microphone"><span style={OCTAGON} className={cn("flex h-[52px] w-[52px] items-center justify-center border-[3px]", micOn ? "border-fuchsia-400 bg-gradient-to-b from-fuchsia-500 to-violet-700 shadow-[0_0_20px_-2px_rgba(232,60,220,0.9)]" : "border-white/20 bg-white/[0.06]")}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-white/50" />}</span><span className="text-[9px] font-semibold text-white/70">Mic {micOn ? "On" : "Off"}</span></button></div>; }

interface SeatGridProps { seats: RoomSeat[]; seatCount?: number; seatCount?: number; host: RoomParticipant; micOn: boolean; onToggleMic: () => void; onSeatTap?: (index: number) => void; onJoinSeat?: (index: number) => void; onHostTap?: () => void; }
export function SeatGrid({ seats, seatCount, host, micOn, onToggleMic, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const capacity = Math.max(2, Math.min(20, Math.floor(Number(seatCount ?? 20))));
  const byIndex = new Map(seats.filter(s => s.index >= 1 && s.index <= capacity).map(s => [s.index, s]));
  const visible = Array.from({ length: capacity }, (_, i) => {
    const index = i + 1;
    return byIndex.get(index) ?? ({ index, user: null, is_locked: false } as RoomSeat);
  });
  const handleTap = (seat: RoomSeat) => seat.user ? onSeatTap?.(seat.index) : onJoinSeat?.(seat.index);
  const split = Math.ceil(capacity / 2);
  const left = visible.filter(s => s.index <= split);
  const right = visible.filter(s => s.index > split);
  return <div className="flex w-full min-w-0 flex-col gap-2 px-2.5"><div className="flex w-full min-w-0 items-stretch gap-2"><div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-2">{left.map(s => <Seat key={s.index} seat={s} onClick={() => handleTap(s)} />)}</div><div className="flex min-w-0 flex-[1.15] flex-col items-center gap-1.5"><HostCard host={host} onTap={onHostTap} /><EmbeddedVoiceControls micOn={micOn} onToggleMic={onToggleMic} /></div><div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-2">{right.map(s => <Seat key={s.index} seat={s} onClick={() => handleTap(s)} />)}</div></div></div>;
}
