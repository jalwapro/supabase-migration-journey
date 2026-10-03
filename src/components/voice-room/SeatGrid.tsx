import { useEffect, useState } from "react";
import { Mic, MicOff, Heart, Lock, Unlock, Check, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { HostCard } from "./HostCard";
import { LevelAvatar } from "@/components/LevelAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const DEFAULT_SEAT_AVATAR = "https://png.pngtree.com/png-vector/20260330/ourmid/pngtree-luxurious-red-throne-chair-with-golden-lion-armrests-and-ornate-crown-png-image_18968101.webp";

const normalizeCapacity = (value?: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value ?? MAX_CAPACITY)) || MAX_CAPACITY));
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

type SeatRequest = { id: string; from_user: string; seat_index: number | null; created_at: string; username: string; avatar: string | null };
type RoomViewer = { id: string; username: string; avatar: string | null };

function EmptySeatArt({ locked }: { locked: boolean }) {
  return (
    <span className="relative flex h-full w-full items-center justify-center overflow-visible">
      <img src={DEFAULT_SEAT_AVATAR} alt="" className="h-full w-full rounded-full object-cover border-0 shadow-none" draggable={false} />
      {locked && <Lock className="pointer-events-none absolute z-[20] h-3.5 w-3.5 text-amber-400 drop-shadow" />}
    </span>
  );
}

type SeatProps = { seat: RoomSeat; onClick: () => void };

export type RoomSeatUser = {
  id?: string;
  name?: string;
  username: string;
  avatar: string | null;
  avatarUrl?: string;
  avatar_frame_url?: string | null;
  frame_url?: string | null;
  ring?: string | null;
  level?: number;
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
  className?: string;
};

export type RoomParticipant = {
  id: string;
  username: string;
  avatar: string | null;
  avatar_frame_url?: string | null;
  frame_url?: string | null;
  ring?: string | null;
  gift_score?: number;
  level?: number;
};

export function Seat({ seat, onClick }: SeatProps) {
  const { user, is_locked, index, seatNumber, className } = seat;
  const num = index ?? seatNumber ?? 1;
  const username = user?.username || user?.name || `No.${num}`;
  const avatar = user?.avatar || user?.avatarUrl || DEFAULT_SEAT_AVATAR;
  const frameUrl = user?.avatar_frame_url || user?.frame_url || null;
  const giftScore = user?.gift_score ?? user?.popularity ?? 0;
  const isMuted = user?.is_muted || user?.mic === "muted" || user?.mic === "off";
  const speaking = (user?.is_speaking && !isMuted) || user?.mic === "speaking";
  const [profileMedia, setProfileMedia] = useState<{ frame: string | null; ring: string | null; level: number | null; render_config: unknown } | null>(null);

  useEffect(() => {
    let active = true;
    const id = user?.id;
    if (!id) {
      setProfileMedia(null);
      return;
    }
    void supabase.from("profiles").select("frame,ring,vip_level,frame_render_config").eq("id", id).maybeSingle().then(({ data }) => {
      if (!active) return;
      setProfileMedia({
        frame: (data as { frame?: string | null } | null)?.frame ?? null,
        ring: (data as { ring?: string | null } | null)?.ring ?? null,
        level: Number((data as { vip_level?: number | null } | null)?.vip_level ?? 0),
        render_config: (data as { frame_render_config?: unknown } | null)?.frame_render_config ?? {},
      });
    });
    return () => { active = false; };
  }, [user?.id]);

  if (!user) {
    return (
      <div data-seat-index={num} data-seat="true" className={cn("relative z-10 flex min-w-0 w-full flex-col items-center justify-center p-0.5 overflow-visible", className)}>
        <button type="button" onClick={onClick} className="group relative flex w-full flex-col items-center justify-center gap-0.5 bg-transparent p-0 transition-all active:scale-95 border-0 shadow-none cursor-pointer">
          <span className="absolute left-0.5 top-0 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/80 border border-amber-500 text-[8px] font-bold text-white shadow">{num}</span>
          <span className="relative aspect-square w-full max-w-[60px] p-0 bg-transparent overflow-visible"><EmptySeatArt locked={is_locked} /></span>
          <span className="w-full truncate text-[9px] font-semibold text-white text-center leading-tight">No.{num}</span>
          <span className="flex items-center gap-0.5 text-[8px] text-white"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />0</span>
        </button>
      </div>
    );
  }

  const equippedFrame = frameUrl || profileMedia?.frame || null;
  const equippedRing = user?.ring || profileMedia?.ring || null;
  const level = user?.level ?? profileMedia?.level ?? 0;

  return (
    <div data-seat-index={num} data-seat="true" className={cn("relative flex min-w-0 w-full min-h-[68px] flex-col items-center justify-start p-0.5", className)}>
      <button type="button" onClick={onClick} className="group relative flex w-full flex-col items-center justify-center gap-0.5 bg-transparent p-0 transition-all active:scale-95 border-0 shadow-none cursor-pointer">
        <span className="absolute left-0.5 top-0 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/80 border border-amber-500 text-[8px] font-black text-white shadow">{num}</span>
        <span data-avatar="true" className="relative z-20 aspect-square w-[clamp(42px,10.5vw,52px)] max-w-[52px] p-0 flex items-center justify-center my-0.5 bg-transparent overflow-visible">
          <LevelAvatar src={avatar} name={username} level={level} size="sm" showBadge={false} frame={equippedFrame} ring={equippedRing} renderConfigOverride={profileMedia?.render_config} className={cn("scale-[0.9] origin-center", speaking && "ring-0 shadow-[0_0_15px_rgba(236,72,153,0.8)]")} />
          <span className={cn("absolute bottom-0 right-0 z-40 grid h-4 w-4 place-items-center rounded-full border-2 border-black text-white shadow-md", isMuted ? "bg-red-500" : "bg-emerald-500")}>{isMuted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}</span>
        </span>
        <span className="w-full truncate px-0.5 text-[9px] font-bold leading-tight text-white text-center drop-shadow">{username}</span>
        <span className="flex items-center gap-0.5 text-[8px] font-medium text-white"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(giftScore)}</span>
      </button>
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
  const [roomViewers, setRoomViewers] = useState<RoomViewer[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "shift">("users");
  const [hostSeatIndex, setHostSeatIndex] = useState(1);

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
        supabase.from("live_rooms").select("moderator_can_manage_seats").eq("id", roomId).maybeSingle()
      ]);
      if (active) {
        setIsModerator(member?.is_moderator === true);
        setModeratorCanManageSeats(room?.moderator_can_manage_seats === true);
      }
    };
    void loadPermissions();
    const channel = supabase.channel(`seat-permissions-${roomId}-${host.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, payload => {
        const row = payload.new as { user_id?: string; is_moderator?: boolean; seat_index?: number | null };
        if (row.user_id === authUserId) setIsModerator(row.is_moderator === true);
        if (row.user_id === host.id && typeof row.seat_index === "number") setHostSeatIndex(Math.min(capacity, Math.max(1, row.seat_index)));
        else if (row.user_id !== authUserId) void loadPermissions();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, payload => {
        const value = (payload.new as { moderator_can_manage_seats?: boolean } | null)?.moderator_can_manage_seats;
        if (typeof value === "boolean") setModeratorCanManageSeats(value);
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, host.id, isHost, capacity]);

  useEffect(() => {
    if (!roomId || !host.id) return;
    let active = true;
    const loadHostSeat = async () => {
      const { data, error } = await supabase.from("room_members").select("seat_index").eq("room_id", roomId).eq("user_id", host.id).maybeSingle();
      if (!active || error) return;
      const next = Number(data?.seat_index ?? 1);
      if (Number.isFinite(next) && next >= 1 && next <= capacity) setHostSeatIndex(next);
    };
    void loadHostSeat();
    return () => { active = false; };
  }, [roomId, host.id, capacity]);

  const canManageSeats = isHost || (isModerator && moderatorCanManageSeats);

  useEffect(() => {
    if (!roomId || !isHost) { setRequests([]); return; }
    let active = true;
    const loadRequests = async () => {
      const { data, error } = await supabase.from("seat_requests").select("id,from_user,seat_index,created_at,status").eq("room_id", roomId).eq("status", "pending").order("created_at", { ascending: true });
      if (!active) return;
      if (error) { toast.error(error.message); return; }
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r: any) => r.from_user))];
      let profilesById: Record<string, any> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id,username,avatar").in("id", ids);
        profilesById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      }
      setRequests(rows.map((r: any) => ({ id: r.id, from_user: r.from_user, seat_index: r.seat_index, created_at: r.created_at, username: profilesById[r.from_user]?.username || "User", avatar: profilesById[r.from_user]?.avatar || null })));
    };
    const upsertRequest = async (row: any) => {
      if (row.status !== "pending") { setRequests(prev => prev.filter(r => r.id !== row.id)); return; }
      const { data: profile } = await supabase.from("profiles").select("id,username,avatar").eq("id", row.from_user).maybeSingle();
      const next: SeatRequest = { id: row.id, from_user: row.from_user, seat_index: row.seat_index ?? null, created_at: row.created_at, username: profile?.username || "User", avatar: profile?.avatar || null };
      setRequests(prev => prev.some(r => r.id === next.id) ? prev.map(r => r.id === next.id ? next : r) : [...prev, next].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    };
    void loadRequests();
    const channel = supabase.channel(`seat-requests-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "seat_requests", filter: `room_id=eq.${roomId}` }, payload => void upsertRequest(payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seat_requests", filter: `room_id=eq.${roomId}` }, payload => void upsertRequest(payload.new))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "seat_requests", filter: `room_id=eq.${roomId}` }, payload => setRequests(prev => prev.filter(r => r.id !== (payload.old as any).id)))
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [roomId, isHost]);

  useEffect(() => {
    if (!roomId || !selectedEmptySeat) return;
    let active = true;
    const fetchViewers = async () => {
      const { data } = await supabase.from("room_members").select("user_id, profiles(id, username, avatar)").eq("room_id", roomId);
      if (!active || !data) return;
      setRoomViewers(data.map((m: any) => ({ id: m.profiles?.id || m.user_id, username: m.profiles?.username || "User", avatar: m.profiles?.avatar || null })));
    };
    void fetchViewers();
    return () => { active = false; };
  }, [roomId, selectedEmptySeat]);

  const toggleSeatLock = async (seatIndex: number, currentlyLocked: boolean) => {
    if (!roomId || !canManageSeats || lockBusy !== null) return;
    setLockBusy(seatIndex);
    const { error } = await supabase.rpc("toggle_seat_lock", { _room_id: roomId, _seat_index: seatIndex, _locked: !currentlyLocked });
    if (error) toast.error(error.message || "Could not update seat lock");
    else {
      toast.success(currentlyLocked ? `Seat ${seatIndex} unlocked` : `Seat ${seatIndex} locked`);
      setSelectedEmptySeat(prev => prev ? { ...prev, is_locked: !currentlyLocked } : null);
    }
    setLockBusy(null);
  };

  const respond = async (request: SeatRequest, accept: boolean) => {
    if (!roomId || !canManageSeats || busyRequest !== null) return;
    setBusyRequest(request.id);
    const { error } = await supabase.rpc("respond_seat_request", {
      _request_id: request.id,
      _accept: accept,
    });
    if (error) {
      toast.error(error.message || (accept ? "Could not approve seat request" : "Could not reject seat request"));
    } else {
      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success(accept ? `${request.username} approved for Seat ${request.seat_index ?? "the next available seat"}` : `${request.username}'s seat request rejected`);
    }
    setBusyRequest(null);
  };

  const assignViewer = async (viewer: RoomViewer) => {
    if (!roomId || !selectedEmptySeat || !isHost) return;
    const seatIndex = selectedEmptySeat.index ?? selectedEmptySeat.seatNumber ?? 2;
    if (selectedEmptySeat.is_locked) {
      toast.error("Unlock this seat first");
      return;
    }
    const { error } = await supabase.rpc("host_assign_seat", { _room_id: roomId, _user_id: viewer.id, _seat_index: seatIndex });
    if (error) { toast.error(error.message || "Could not assign seat"); return; }
    toast.success(`${viewer.username} moved to seat ${seatIndex}`);
    setSelectedEmptySeat(null);
  };

  const changeMySeat = async () => {
    if (!roomId || !selectedEmptySeat || !isHost) return;
    const target = selectedEmptySeat.index ?? selectedEmptySeat.seatNumber ?? 1;
    if (target < 1 || target > capacity) {
      toast.error("Invalid host seat");
      return;
    }
    if (selectedEmptySeat.is_locked && target !== 1) {
      toast.error("Unlock this seat first");
      return;
    }
    const { error } = await supabase.rpc("take_seat", {
      _room_id: roomId,
      _seat_index: target,
    });
    if (error) {
      toast.error(error.message || "Could not change your seat");
      return;
    }
    toast.success("You moved to seat " + target);
    setHostSeatIndex(target);
    setSelectedEmptySeat(null);
  };

  const byIndex = new Map(
    seats
      .filter(s => (s.index >= 2 && s.index <= capacity) || (s.seatNumber && s.seatNumber >= 2 && s.seatNumber <= capacity))
      .filter(s => s.user?.id !== host.id)
      .map(s => [s.index ?? s.seatNumber!, s]),
  );
  const participantSlots = Array.from({ length: Math.max(0, capacity - 1) }, (_, offset): RoomSeat => {
    const index = offset + 2;
    return byIndex.get(index) ?? { index, seatNumber: index, user: null, is_locked: false, is_requested: false };
  });

  const handleSeatClick = async (seat: RoomSeat) => {
    const idx = seat.index ?? seat.seatNumber ?? 1;
    if (idx === 1 && !isHost) {
      toast.error("Seat 1 is reserved for the host");
      return;
    }
    if (seat.user) {
      onSeatTap?.(idx);
      return;
    }
    if (isHost) {
      if (!roomId) {
        onJoinSeat?.(idx);
        return;
      }
      if (seat.is_locked && idx !== 1) {
        toast.error("Unlock this seat first");
        return;
      }
      const { error } = await supabase.rpc("take_seat", {
        _room_id: roomId,
        _seat_index: idx,
      });
      if (error) {
        toast.error(error.message || "Could not change your seat");
        return;
      }
      setHostSeatIndex(idx);
      setSelectedEmptySeat(null);
      toast.success("You moved to seat " + idx);
      return;
    }
    if (canManageSeats) {
      setSelectedEmptySeat(seat);
      setActiveTab("users");
      return;
    }
    if (seat.is_locked) {
      toast.error("Seat is locked");
      return;
    }
    if (!roomId) {
      onJoinSeat?.(idx);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      toast.error("Your login session is not ready. Please sign in again.");
      return;
    }

    onJoinSeat?.(idx);
  };

  const safeHostSeatIndex = Math.min(capacity, Math.max(1, hostSeatIndex));
  const allSeats: (RoomSeat & { isHost?: boolean })[] = Array.from({ length: capacity }, (_, offset) => {
    const index = offset + 1;
    if (index === safeHostSeatIndex) {
      return {
        index,
        seatNumber: index,
        isHost: true,
        user: {
          id: host.id,
          username: host.username,
          avatar: host.avatar,
          avatar_frame_url: host.avatar_frame_url,
          frame_url: host.frame_url,
          ring: host.ring,
          level: host.level,
          gift_score: host.gift_score ?? 0,
        },
        is_locked: false,
      };
    }
    if (index === 1) return { index, seatNumber: 1, user: null, is_locked: false, is_requested: false };
    return byIndex.get(index) ?? { index, seatNumber: index, user: null, is_locked: false, is_requested: false };
  });

  return (
    <section data-seat-grid="true" className="relative mx-auto flex w-full max-w-[480px] min-h-0 flex-col items-center justify-center px-[clamp(2px,1.2vw,8px)] py-1 bg-transparent overflow-visible" data-seat-capacity={capacity}>
      <div className="grid w-full grid-cols-5 items-start justify-items-center gap-x-[clamp(1px,0.5vw,4px)] gap-y-[clamp(3px,0.8vw,6px)] bg-transparent [grid-auto-rows:minmax(68px,auto)]">
        {allSeats.map((seat) => {
          const seatIdx = seat.index ?? seat.seatNumber ?? 1;
          if (seat.isHost) return (
            <div key={seatIdx} data-seat="true" data-jalwa-live-component="voice.host" data-seat-index={seatIdx} className="relative flex w-full min-w-0 min-h-[68px] flex-col items-center justify-start p-0.5">
              <div className="group relative flex w-full flex-col items-center justify-center gap-0.5 bg-transparent p-0">
                <span className="absolute left-0.5 top-0 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/80 border border-amber-500 text-[8px] font-black text-amber-300 shadow">{seatIdx}</span>
                <span data-avatar="true" className="relative z-20 aspect-square w-full max-w-[52px] p-0 flex items-center justify-center my-0.5 bg-transparent overflow-visible shrink-0">
                  <span className="relative block h-full w-full overflow-visible rounded-full border-2 border-amber-400 z-10 bg-transparent shadow-md scale-[0.78]"><HostCard host={host} onTap={() => { if (!isHost) { toast.error("Only room owner can occupy the host seat"); return; } onHostTap?.(); }} /></span>

                </span>
                <span className="w-full truncate px-0.5 text-[9px] font-bold text-white text-center drop-shadow">{host.username}</span>
                <span className="flex items-center gap-0.5 text-[8px] font-medium text-white"><Heart className="h-2 w-2 fill-pink-500 text-pink-500" />{formatCount(host.gift_score ?? 0)}</span>
              </div>
            </div>
          );
          return <Seat key={seatIdx} seat={{ ...seat, index: seatIdx }} onClick={() => void handleSeatClick(seat)} />;
        })}
      </div>

      {selectedEmptySeat && (
        <div className="absolute inset-0 z-50 flex items-end justify-center px-3 pb-3 pointer-events-none" onClick={() => setSelectedEmptySeat(null)}>
          <div className="pointer-events-auto relative w-full max-w-sm rounded-[26px] border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div><div className="text-[11px] font-black uppercase tracking-wider text-amber-300">Seat Manager</div><div className="text-sm font-bold">Seat No. {selectedEmptySeat.index ?? selectedEmptySeat.seatNumber}</div></div>
              <button type="button" onClick={() => setSelectedEmptySeat(null)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">{selectedEmptySeat.is_locked ? <Lock className="h-4 w-4 text-amber-400" /> : <Unlock className="h-4 w-4 text-emerald-400" />}{selectedEmptySeat.is_locked ? "Seat is Locked" : "Seat is Unlocked"}</div>
              <button type="button" disabled={lockBusy !== null} onClick={() => { const idx = selectedEmptySeat.index ?? selectedEmptySeat.seatNumber ?? 2; void toggleSeatLock(idx, selectedEmptySeat.is_locked); }} className="rounded-xl bg-amber-400 px-3 py-1.5 text-[10px] font-black text-black">{selectedEmptySeat.is_locked ? "Unlock" : "Lock"}</button>
            </div>
            {isHost && <button type="button" onClick={() => void changeMySeat()} className="mb-3 w-full rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-black text-black shadow-lg">
              {(selectedEmptySeat.index ?? selectedEmptySeat.seatNumber) === 1 ? "Move to Host Seat 1" : "Change Host Seat → " + (selectedEmptySeat.index ?? selectedEmptySeat.seatNumber)}
            </button>}
            <div className="mb-2 flex items-center gap-2"><div className="h-px flex-1 bg-white/10" /><span className="text-[9px] font-bold uppercase tracking-wider text-white/40">Assign Viewer</span><div className="h-px flex-1 bg-white/10" /></div>
            <div className="max-h-44 overflow-y-auto space-y-1.5">
              {roomViewers.length === 0 ? <p className="py-5 text-center text-xs text-white/50">No viewers found</p> : roomViewers.map(viewer => (
                <div key={viewer.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex min-w-0 items-center gap-2"><img src={viewer.avatar || DEFAULT_SEAT_AVATAR} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /><span className="truncate text-xs font-semibold">{viewer.username}</span></div>
                  <button type="button" onClick={() => void assignViewer(viewer)} className="rounded-xl bg-amber-400 px-3 py-1.5 text-[10px] font-black text-black">Assign</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isHost && requests.length > 0 && (
        <div className="pointer-events-auto absolute left-3 right-3 top-1 z-[80] max-h-[42%] overflow-y-auto rounded-2xl border border-amber-500 bg-[#120a1f] p-2 shadow-2xl">
          <div className="mb-2 flex items-center justify-between px-1"><div><span className="text-sm font-black text-white">Seat Requests</span><div className="text-[9px] text-white/50">Approve or reject pending requests</div></div><span className="rounded-full bg-amber-400/15 px-2 py-1 text-[9px] font-bold text-amber-300">{requests.length} pending</span></div>
          <div className="space-y-1.5">{requests.map(request => <div key={request.id} className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-[#1e1238] p-1.5">{request.avatar ? <img src={request.avatar} alt={request.username} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-amber-500" /> : <div className="grid h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">{request.username[0]?.toUpperCase()}</div>}<div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold text-white">{request.username}</div><div className="truncate text-[9px] text-white/50">Wants to join a seat</div><div className="text-[9px] text-white">Requesting Seat {request.seat_index ?? "any"}</div></div><button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white disabled:opacity-50" aria-label={`Accept ${request.username}'s seat request`}><Check className="h-4 w-4" /></button><button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500 text-white disabled:opacity-50" aria-label={`Reject ${request.username}'s seat request`}><X className="h-4 w-4" /></button></div>)}</div>
        </div>
      )}
    </section>
  );
}
