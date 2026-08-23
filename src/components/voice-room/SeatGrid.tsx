import { useEffect, useState } from "react";
import { Mic, MicOff, Plus, Heart, Lock, Armchair, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSeat, RoomParticipant } from "@/types/room";
import { HostCard } from "./HostCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const normalizeCapacity = (value?: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value ?? MAX_CAPACITY)) || MAX_CAPACITY));
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
type SeatRequest = { id: string; from_user: string; seat_index: number | null; created_at: string; username: string; avatar: string | null };

function EmptySeatArt({ locked }: { locked: boolean }) { return <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-[#d7b33d] bg-[radial-gradient(circle_at_35%_28%,#2b6138_0%,#123b27_55%,#071c17_100%)] shadow-[inset_0_0_18px_rgba(0,0,0,.55)]"><Armchair className="h-[58%] w-[58%] text-[#b79b28] drop-shadow-[0_2px_2px_rgba(0,0,0,.6)]" strokeWidth={1.6} />{!locked && <span className="absolute right-[8%] top-[8%] grid h-3.5 w-3.5 place-items-center rounded-full bg-[color:var(--primary)] text-white shadow"><Plus className="h-2.5 w-2.5" /></span>}{locked && <Lock className="absolute h-3.5 w-3.5 text-white/80" />}</span>; }

export function Seat({ seat, onClick }: { seat: RoomSeat; onClick: () => void }) {
  const { user, is_locked, index } = seat;
  if (!user) return <button type="button" onClick={onClick} disabled={is_locked} className="group flex min-w-0 flex-col items-center gap-0 touch-manipulation active:scale-95 disabled:opacity-55" aria-label={is_locked ? `Locked seat ${index}` : `Request seat ${index}`}><span className="relative aspect-square w-[78%] max-w-[68px] rounded-full border-2 p-[2px] shadow-[0_2px_10px_rgba(201,164,47,.24)]"><EmptySeatArt locked={is_locked} /></span><span className="text-[9px] font-semibold tracking-tight text-foreground/90">No.{index}</span><span className="flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-white/10 px-1 py-px text-[8px] text-foreground/70"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />0</span></button>;
  const muted = user.is_muted, speaking = user.is_speaking && !muted;
  return <button type="button" onClick={onClick} className="group relative flex min-w-0 flex-col items-center gap-0 touch-manipulation active:scale-95" aria-label={`Seat ${index}, ${user.username}`}><span className={cn("relative aspect-square w-[78%] max-w-[68px] rounded-full border-2 p-[2px]", speaking ? "border-[color:var(--primary)] shadow-[0_0_16px_rgba(232,60,220,.7)]" : "border-[#c9a42f] shadow-[0_2px_10px_rgba(201,164,47,.24)]")}><span className="relative block h-full w-full overflow-hidden rounded-full bg-background">{user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full place-items-center bg-[color:var(--primary)] text-xs font-black text-white">{user.username[0]?.toUpperCase()}</span>}{speaking && <span className="absolute inset-1 rounded-full border-2 border-white/80 animate-pulse" />}</span><span className={cn("absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-full border border-black/50 text-white", muted ? "bg-red-500" : "bg-emerald-500")}>{muted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}</span></span><span className="max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight text-foreground">{user.username}</span><span className="flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-white/10 px-1 py-px text-[8px] text-foreground/70"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(user.gift_score)}</span></button>;
}

interface SeatGridProps { seats: RoomSeat[]; seatCount?: number; host: RoomParticipant; roomId?: string; isHost?: boolean; onSeatTap?: (index: number) => void; onJoinSeat?: (index: number) => void; onHostTap?: () => void; }

export function SeatGrid({ seats, seatCount, host, roomId, isHost = false, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const capacity = normalizeCapacity(seatCount);
  const [requests, setRequests] = useState<SeatRequest[]>([]);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  useEffect(() => {
    if (!roomId || !isHost) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("seat_requests").select("id,from_user,seat_index,created_at").eq("room_id", roomId).eq("status", "pending").order("created_at", { ascending: true });
      if (!active) return;
      if (!data?.length) { setRequests([]); return; }
      const ids = data.map(r => r.from_user);
      const { data: profiles } = await supabase.from("profiles").select("id,username,avatar_url").in("id", ids);
      const map = new Map((profiles ?? []).map(p => [p.id, p]));
      setRequests(data.map(r => { const p = map.get(r.from_user); return { ...r, username: p?.username || "User", avatar: p?.avatar_url || null }; }));
    };
    void load();
    const channel = supabase.channel(`seat-requests-${roomId}-${host.id}`).on("postgres_changes", { event: "*", schema: "public", table: "seat_requests", filter: `room_id=eq.${roomId}` }, () => void load()).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, isHost, host.id]);
  const respond = async (request: SeatRequest, accept: boolean) => { if (busyRequest) return; setBusyRequest(request.id); const { error } = await supabase.rpc("respond_seat_request", { _request_id: request.id, _accept: accept }); if (error) toast.error(error.message || "Could not respond to seat request"); else toast.success(accept ? `${request.username} joined the seat` : "Seat request rejected"); setBusyRequest(null); };
  const byIndex = new Map(seats.filter(s => s.index >= 2 && s.index <= capacity).map(s => [s.index, s]));
  const participantSlots = Array.from({ length: Math.max(0, capacity - 1) }, (_, offset): RoomSeat => { const index = offset + 2; return byIndex.get(index) ?? { index, user: null, is_locked: false, is_requested: false }; });
  const handleTap = async (seat: RoomSeat) => { if (seat.user) { onSeatTap?.(seat.index); return; } if (seat.is_locked) return; if (isHost || !roomId) { onJoinSeat?.(seat.index); return; } const { error } = await supabase.rpc("request_seat", { _room_id: roomId, _seat_index: seat.index }); if (error) toast.error(error.message || "Could not send seat request"); else toast.success("Seat request sent to host"); };
  return <section className="relative flex h-full w-full min-w-0 items-start overflow-hidden px-2 pb-0 pt-0" data-seat-capacity={capacity}><div className="grid w-full grid-cols-5 content-start gap-x-1 gap-y-1 sm:gap-x-2 sm:gap-y-1.5"><div className="relative flex min-w-0 flex-col items-center gap-0"><span className="relative aspect-square w-[78%] max-w-[68px] rounded-full border-2 p-[2px] shadow-[0_2px_10px_rgba(201,164,47,.32)]"><HostCard host={host} onTap={onHostTap} /></span><span className="text-[9px] font-bold leading-tight tracking-tight text-foreground">No.1</span><span className="flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-white/10 px-1 py-px text-[8px] leading-tight text-foreground/70"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(host.gift_score ?? 0)}</span></div>{participantSlots.map(seat => <Seat key={seat.index} seat={seat} onClick={() => void handleTap(seat)} />)}</div>{isHost && requests.length > 0 && <div className="pointer-events-auto absolute left-3 right-3 top-1 z-[80] max-h-[42%] overflow-y-auto rounded-2xl border border-[color:var(--primary)]/45 bg-background/95 p-2 shadow-2xl backdrop-blur-md"><div className="mb-1.5 flex items-center justify-between px-1"><span className="text-xs font-bold text-foreground">Seat requests ({requests.length})</span><span className="text-[9px] text-foreground/50">Approve or reject</span></div><div className="space-y-1.5">{requests.map(request => <div key={request.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] p-1.5">{request.avatar ? <img src={request.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--primary)] text-[10px] font-bold text-white">{request.username[0]?.toUpperCase()}</div>}<div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-foreground">{request.username}</div><div className="text-[9px] text-foreground/55">wants Seat {request.seat_index ?? "any"}</div></div><button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white disabled:opacity-50" aria-label="Accept seat request"><Check className="h-4 w-4" /></button><button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500 text-white disabled:opacity-50" aria-label="Reject seat request"><X className="h-4 w-4" /></button></div>)}</div></div>}</section>;
}
