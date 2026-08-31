import { useEffect, useState } from "react";
import { Mic, MicOff, Heart, Lock, Unlock, Check, X, Plus, Settings, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HostCard } from "./HostCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const DEFAULT_SEAT_AVATAR = "https://png.pngtree.com/png-vector/20260330/ourmid/pngtree-luxurious-red-throne-chair-with-golden-lion-armrests-and-ornate-crown-png-image_18968101.webp";

const normalizeCapacity = (value?: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value ?? MAX_CAPACITY)) || MAX_CAPACITY));
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

type SeatRequest = { id: string; from_user: string; seat_index: number | null; created_at: string; username: string; avatar: string | null };

export type RoomSeatUser = {
  id?: string;
  name?: string;
  username: string;
  avatar: string | null;
  avatarUrl?: string;
  avatar_frame_url?: string | null;
  frame_url?: string | null;
  is_muted?: boolean;
  is_speaking?: boolean;
  mic?: "speaking" | "muted" | "off";
  gift_score: number;
  popularity?: number;
};

export type RoomSeat = {
  index: number;
  seatNumber?: number;
  user: RoomSeatUser | null;
  is_locked: boolean;
  is_requested?: boolean;
};

export type RoomParticipant = {
  id: string;
  username: string;
  avatar: string | null;
  avatar_frame_url?: string | null;
  frame_url?: string | null;
  gift_score?: number;
  level?: number;
};

function EmptySeatArt({ locked }: { locked: boolean }) { 
  return (
    <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full border border-white/20 bg-black/20 shadow-inner">
      <img src={DEFAULT_SEAT_AVATAR} alt="" className="h-full w-full object-contain p-0.5 opacity-60" draggable={false} />
      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
        <Plus className="h-3.5 w-3.5 text-white/70" />
      </span>
      {locked && <Lock className="absolute h-3.5 w-3.5 text-amber-400 drop-shadow" />}
    </span>
  ); 
}

type SeatProps = { 
  seat: RoomSeat; 
  onClick: () => void; 
  canManage?: boolean; 
  onToggleLock?: () => void; 
  lockBusy?: boolean 
};

export function Seat({ seat, onClick, canManage = false, onToggleLock, lockBusy = false }: SeatProps) {
  const { user, is_locked, index, seatNumber } = seat;
  const num = index ?? seatNumber ?? 1;
  const username = user?.username || user?.name || `No.${num}`;
  const avatar = user?.avatar || user?.avatarUrl || DEFAULT_SEAT_AVATAR;
  const frameUrl = user?.avatar_frame_url || user?.frame_url;
  const giftScore = user?.gift_score ?? user?.popularity ?? 0;
  
  const isMuted = user?.is_muted || user?.mic === "muted" || user?.mic === "off";
  const speaking = (user?.is_speaking && !isMuted) || user?.mic === "speaking";

  const lockButton = canManage ? (
    <button 
      type="button" 
      disabled={lockBusy} 
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleLock?.(); }} 
      className="absolute -right-1 -top-1 z-20 grid h-5 w-5 place-items-center rounded-full border border-white/70 bg-black/75 text-white shadow-md disabled:opacity-50" 
      aria-label={is_locked ? `Unlock seat ${num}` : `Lock seat ${num}`}
    >
      {is_locked ? <Unlock className="h-2.5 w-2.5 text-amber-400" /> : <Lock className="h-2.5 w-2.5" />}
    </button>
  ) : null;

  if (!user) {
    return (
      <div className="relative flex flex-col items-center justify-center">
        <button 
          type="button" 
          onClick={onClick} 
          className="group relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-1 shadow-sm transition-all active:scale-95"
          aria-label={is_locked ? `Locked seat ${num}` : `Manage seat ${num}`}
        >
          <span className="absolute left-1 top-1 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/60 text-[8px] font-bold text-white/70">
            {num}
          </span>
          <span className="relative aspect-square w-[72%] max-w-[42px] rounded-full border border-white/15 p-0.5">
            <EmptySeatArt locked={is_locked} />
          </span>
          <span className="w-full truncate text-[8px] font-semibold text-white/50 text-center">No.{num}</span>
          <span className="flex items-center gap-0.5 text-[7px] text-white/40">
            <Heart className="h-2 w-2 fill-pink-500/60 text-pink-500" />0
          </span>
        </button>
        {lockButton}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      <button 
        type="button" 
        onClick={onClick} 
        className={cn(
          "group relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border p-1 shadow-md transition-all active:scale-95",
          speaking ? "border-fuchsia-400 bg-fuchsia-950/30 shadow-[0_0_12px_rgba(236,72,153,0.5)]" : "border-white/15 bg-white/[0.06]"
        )}
      >
        <span className="absolute left-1 top-1 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/70 text-[8px] font-black text-white/90">
          {num}
        </span>
        <span className="relative aspect-square w-[72%] max-w-[42px] rounded-full p-0.5 flex items-center justify-center">
          <span className="relative block h-full w-full overflow-hidden rounded-full bg-slate-900 border-2 border-[color:var(--primary)]">
            <img src={avatar} alt={username} className="h-full w-full object-cover" draggable={false} />
            {speaking && <span className="absolute inset-0 rounded-full border-2 border-fuchsia-400 animate-pulse pointer-events-none" />}
          </span>
          {frameUrl && (
            <img src={frameUrl} alt="" className="absolute inset-0 -m-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] pointer-events-none object-contain z-10" draggable={false} />
          )}
          <span className={cn("absolute -bottom-0.5 -right-0.5 z-20 grid h-3.5 w-3.5 place-items-center rounded-full border border-black text-white", isMuted ? "bg-red-500" : "bg-emerald-500")}>
            {isMuted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}
          </span>
        </span>
        <span className="w-full truncate px-0.5 text-[8px] font-bold leading-tight text-white text-center">{username}</span>
        <span className="flex items-center gap-0.5 text-[7px] font-medium text-white/75">
          <Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(giftScore)}
        </span>
      </button>
      {lockButton}
    </div>
  );
}

interface SeatGridProps { 
  seats: RoomSeat[]; 
  seatCount?: number; 
  host: RoomParticipant; 
  roomId?: string; 
  isHost?: boolean; 
  onSeatTap?: (index: number) => void; 
  onJoinSeat?: (index: number) => void; 
  onHostTap?: () => void; 
}

export function SeatGrid({ seats, seatCount, host, roomId, isHost = false, onSeatTap, onJoinSeat, onHostTap }: SeatGridProps) {
  const capacity = normalizeCapacity(seatCount);
  const [requests, setRequests] = useState<SeatRequest[]>([]);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [moderatorCanManageSeats, setModeratorCanManageSeats] = useState(false);
  const [lockBusy, setLockBusy] = useState<number | null>(null);
  const [selectedEmptySeat, setSelectedEmptySeat] = useState<RoomSeat | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    let authUserId = "";
    const loadPermissions = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active || !auth.user) return;
      authUserId = auth.user.id;
      if (auth.user.id === host.id || isHost) {
        setIsModerator(false);
        setModeratorCanManageSeats(true);
        return;
      }
      const [{ data: member }, { data: room }] = await Promise.all([
        supabase.from("room_members").select("is_moderator").eq("room_id", roomId).eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("live_rooms").select("moderator_can_manage_seats").eq("id", roomId).maybeSingle(),
      ]);
      if (active) {
        setIsModerator(member?.is_moderator === true);
        setModeratorCanManageSeats(room?.moderator_can_manage_seats === true);
      }
    };
    void loadPermissions();
    const channel = supabase.channel(`seat-permissions-${roomId}-${host.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as { user_id?: string; is_moderator?: boolean };
        if (row.user_id === authUserId) setIsModerator(row.is_moderator === true);
        else void loadPermissions();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const value = (payload.new as { moderator_can_manage_seats?: boolean } | null)?.moderator_can_manage_seats;
        if (typeof value === "boolean") setModeratorCanManageSeats(value);
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, host.id, isHost]);

  const canManageSeats = isHost || (isModerator && moderatorCanManageSeats);

  useEffect(() => {
    if (!roomId || !isHost) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("seat_requests").select("id,from_user,seat_index,created_at").eq("room_id", roomId).eq("status", "pending").order("created_at", { ascending: true });
      if (!active) return;
      if (!data?.length) { setRequests([]); return; }
      const ids = data.map(r => r.from_user);
      const { data: profiles } = await supabase.from("profiles").select("id,username,avatar").in("id", ids);
      const map = new Map((profiles ?? []).map(p => [p.id, p]));
      setRequests(data.map(r => { const p = map.get(r.from_user); return { ...r, username: p?.username || "User", avatar: p?.avatar || null }; }));
    };
    void load();
    const channel = supabase.channel(`seat-requests-${roomId}-${host.id}`).on("postgres_changes", { event: "*", schema: "public", table: "seat_requests", filter: `room_id=eq.${roomId}` }, () => void load()).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, isHost, host.id]);

  const respond = async (request: SeatRequest, accept: boolean) => { 
    if (busyRequest) return; 
    setBusyRequest(request.id); 
    const { error } = await supabase.rpc("respond_seat_request", { _request_id: request.id, _accept: accept }); 
    if (error) toast.error(error.message || "Could not respond to seat request"); 
    else toast.success(accept ? `${request.username} joined the seat` : "Seat request rejected"); 
    setBusyRequest(null); 
  };

  const toggleSeatLock = async (seatIndex: number, currentlyLocked: boolean) => {
    if (!roomId || !canManageSeats || lockBusy !== null) return;
    setLockBusy(seatIndex);
    const { error } = await supabase.rpc("toggle_seat_lock", { _room_id: roomId, _seat_index: seatIndex, _locked: !currentlyLocked });
    if (error) toast.error(error.message || "Could not update seat lock");
    else toast.success(currentlyLocked ? `Seat ${seatIndex} unlocked` : `Seat ${seatIndex} locked`);
    setLockBusy(null);
  };

  const byIndex = new Map(seats.filter(s => (s.index >= 2 && s.index <= capacity) || (s.seatNumber && s.seatNumber >= 2 && s.seatNumber <= capacity)).map(s => [s.index ?? s.seatNumber!, s]));
  const participantSlots = Array.from({ length: Math.max(0, capacity - 1) }, (_, offset): RoomSeat => { 
    const index = offset + 2; 
    return byIndex.get(index) ?? { index, seatNumber: index, user: null, is_locked: false, is_requested: false }; 
  });

  const handleTap = async (seat: RoomSeat) => { 
    const idx = seat.index ?? seat.seatNumber ?? 1;
    if (seat.user) { 
      onSeatTap?.(idx); 
      return; 
    } 
    
    // Agar user Host ya Moderator hai aur seat empty hai, toh popup open karein
    if (canManageSeats) {
      setSelectedEmptySeat(seat);
      return;
    }

    if (seat.is_locked) return; 
    if (!roomId) { 
      onJoinSeat?.(idx); 
      return; 
    } 
    const { error } = await supabase.rpc("request_seat", { _room_id: roomId, _seat_index: idx }); 
    if (error) toast.error(error.message || "Could not send seat request"); 
    else toast.success("Seat request sent to host"); 
  };

  const hostFrameUrl = host.avatar_frame_url || host.frame_url;

  return (
    <section className="relative flex w-full flex-col items-center px-1 py-0.5" data-seat-capacity={capacity}>
      <div className="grid w-full grid-cols-5 gap-1 content-start">
        {/* Seat No. 1: Host */}
        <div className="relative flex flex-col items-center justify-center">
          <div className="group relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-fuchsia-400/50 bg-fuchsia-950/20 p-1 shadow-md">
            <span className="absolute left-1 top-1 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/75 text-[8px] font-black text-amber-300">
              1
            </span>
            <span className="relative aspect-square w-[72%] max-w-[42px] rounded-full p-0.5 flex items-center justify-center">
              <span className="relative block h-full w-full overflow-hidden rounded-full border-2 border-amber-400">
                <HostCard host={host} onTap={onHostTap} />
              </span>
              {hostFrameUrl && (
                <img src={hostFrameUrl} alt="" className="absolute inset-0 -m-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] pointer-events-none object-contain z-10" draggable={false} />
              )}
            </span>
            <span className="w-full truncate px-0.5 text-[8px] font-bold leading-tight text-white text-center">
              {host.username}
            </span>
            <span className="flex items-center gap-0.5 text-[7px] font-medium text-white/85">
              <Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(host.gift_score ?? 0)}
            </span>
          </div>
        </div>

        {/* Remaining Seats (2 to Capacity) */}
        {participantSlots.map(seat => {
          const seatIdx = seat.index ?? seat.seatNumber ?? 2;
          return (
            <Seat 
              key={seatIdx} 
              seat={{ ...seat, index: seatIdx }} 
              canManage={canManageSeats} 
              lockBusy={lockBusy === seatIdx} 
              onToggleLock={() => void toggleSeatLock(seatIdx, seat.is_locked)} 
              onClick={() => void handleTap(seat)} 
            />
          );
        })}
      </div>

      {/* Host / Moderator Empty Seat Management Popup */}
      {selectedEmptySeat && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="relative flex flex-col max-w-xs w-full rounded-2xl bg-slate-900 border border-amber-500/40 p-4 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">Manage Seat No. {selectedEmptySeat.index ?? selectedEmptySeat.seatNumber}</span>
              </div>
              <button type="button" onClick={() => setSelectedEmptySeat(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-2.5">
              <button 
                type="button"
                onClick={() => {
                  const idx = selectedEmptySeat.index ?? selectedEmptySeat.seatNumber ?? 2;
                  void toggleSeatLock(idx, selectedEmptySeat.is_locked);
                  setSelectedEmptySeat(null);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-all border border-slate-700"
              >
                <div className="flex items-center gap-2">
                  {selectedEmptySeat.is_locked ? <Unlock className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-amber-400" />}
                  <span>{selectedEmptySeat.is_locked ? "Unlock This Seat" : "Lock This Seat"}</span>
                </div>
                <span className="text-[10px] text-slate-400">{selectedEmptySeat.is_locked ? "Allow users" : "Block users"}</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  const idx = selectedEmptySeat.index ?? selectedEmptySeat.seatNumber ?? 2;
                  setSelectedEmptySeat(null);
                  onJoinSeat?.(idx);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 transition-all border border-amber-500/30"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-amber-400" />
                  <span>Assign / Take Seat</span>
                </div>
                <span className="text-[10px] text-amber-400/70">Join</span>
              </button>
            </div>

            <button 
              type="button"
              onClick={() => setSelectedEmptySeat(null)}
              className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Host Pending Seat Requests Drawer */}
      {isHost && requests.length > 0 && (
        <div className="pointer-events-auto absolute left-3 right-3 top-1 z-[80] max-h-[42%] overflow-y-auto rounded-2xl border border-[color:var(--primary)]/70 bg-background/95 p-2 shadow-2xl backdrop-blur-md">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-bold text-foreground">Seat requests ({requests.length})</span>
            <span className="text-[9px] text-foreground/50">Approve or reject</span>
          </div>
          <div className="space-y-1.5">
            {requests.map(request => (
              <div key={request.id} className="flex items-center gap-2 rounded-xl border border-[color:var(--primary)]/35 bg-transparent p-1.5">
                {request.avatar ? (
                  <img src={request.avatar} alt={request.username} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--primary)]/50" />
                ) : (
                  <div className="grid h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[10px] font-bold text-white">
                    {request.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold text-foreground">{request.username}</div>
                  <div className="truncate text-[8px] font-mono text-foreground/45">ID: {request.from_user}</div>
                  <div className="text-[9px] text-foreground/60">Requesting Seat {request.seat_index ?? "any"}</div>
                </div>
                <button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white disabled:opacity-50" aria-label={`Accept ${request.username}'s seat request`}>
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500 text-white disabled:opacity-50" aria-label={`Reject ${request.username}'s seat request`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
