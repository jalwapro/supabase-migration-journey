import { useEffect, useState, useMemo } from "react";
import { Mic, MicOff, Heart, Lock, Unlock, Check, X, Settings, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HostCard } from "./HostCard";
import { LevelAvatar } from "@/components/LevelAvatar";
import { CpSeatAura } from "@/components/CP/CpSeatAura";
import { CpStageConnectionOverlay } from "@/components/CP/CpStageConnectionOverlay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MIN_CAPACITY = 4;
const MAX_CAPACITY = 20;
const DEFAULT_SEAT_AVATAR = "https://png.pngtree.com/png-vector/20260330/ourmid/pngtree-luxurious-red-throne-chair-with-golden-lion-armrests-and-ornate-crown-png-image_18968101.webp";

const normalizeCapacity = (value?: number) => Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(Number(value ?? MAX_CAPACITY)) || MAX_CAPACITY));
const formatCount = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

type SeatRequest = { id: string; from_user: string; seat_index: number | null; created_at: string; username: string; avatar: string | null; country?: string | null; country_code?: string | null };
type RoomViewer = { id: string; username: string; avatar: string | null; country?: string | null; country_code?: string | null };

function EmptySeatArt({ locked }: { locked: boolean }) {
  return (
    <span data-seat-empty-art="true" className="relative flex h-full w-full items-center justify-center overflow-visible">
      <img data-seat-empty-art-image="true" src={DEFAULT_SEAT_AVATAR} alt="" className="h-full w-full object-contain border-0 shadow-none" draggable={false} />
      {locked && <Lock className="pointer-events-none absolute z-[20] h-3.5 w-3.5 text-amber-400 drop-shadow" />}
    </span>
  );
}

type SeatProfileMedia = { frame: string | null; ring: string | null; level: number | null; render_config: unknown; country: string | null; country_code: string | null; cp_level?: number | null; cp_level_name?: string | null; cp_partner_id?: string | null; cp_partner_username?: string | null; cp_partner_avatar?: string | null; cp_badge_url?: string | null; cp_intimacy_score?: number | null };
type SeatProps = { seat: RoomSeat; onClick: () => void; profileMedia?: SeatProfileMedia | null; partnerPresentOnStage?: boolean };

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
  is_muted?: boolean;
  is_speaking?: boolean;
};

export function Seat({ seat, onClick, profileMedia = null, partnerPresentOnStage = false }: SeatProps) {
  const { user, is_locked, index, seatNumber, className } = seat;
  const num = index ?? seatNumber ?? 1;
  const username = user?.username || user?.name || `No.${num}`;
  const avatar = user?.avatar || user?.avatarUrl || "";
  const frameUrl = user?.avatar_frame_url || user?.frame_url || null;
  const giftScore = user?.gift_score ?? user?.popularity ?? 0;
  const isMuted = user?.is_muted || user?.mic === "muted" || user?.mic === "off";
  const speaking = (user?.is_speaking && !isMuted) || user?.mic === "speaking";

  if (!user) {
    return (
      <div data-seat-index={num} data-seat="true" data-seat-cell="true" className={cn("relative z-10 flex h-[84px] min-h-[84px] w-full min-w-0 flex-col items-center justify-start p-0.5 overflow-visible", className)}>
        <button type="button" onClick={onClick} className="group relative flex h-full w-full flex-col items-center justify-start gap-0.5 bg-transparent p-0 transition-all active:scale-95 border-0 shadow-none cursor-pointer">
          <span className="absolute left-0.5 top-0 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/80 border border-amber-500 text-[8px] font-bold text-white shadow">{num}</span>
          <span className="relative h-[48px] w-[48px] shrink-0 p-0 bg-transparent overflow-visible"><EmptySeatArt locked={is_locked} /></span>
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
    <div data-seat-index={num} data-user-dp={user.id ?? ""} data-seat="true" data-seat-cell="true" className={cn("relative flex h-[84px] min-h-[84px] w-full min-w-0 flex-col items-center justify-start p-0.5 overflow-visible", className)}>
      <button type="button" onClick={onClick} className="group relative flex w-full flex-col items-center justify-center gap-0.5 bg-transparent p-0 transition-all active:scale-95 border-0 shadow-none cursor-pointer">
        <span className="absolute left-0.5 top-0 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/80 border border-amber-500 text-[8px] font-black text-white shadow">{num}</span>
        <span data-avatar="true" data-seat-media="true" className="relative z-20 h-[62px] w-[62px] shrink-0 p-0 flex items-center justify-center my-0.5 bg-transparent overflow-visible">
          <CpSeatAura cpLevel={profileMedia?.cp_level} partnerPresentOnStage={partnerPresentOnStage} isSpeaking={speaking}>
            <LevelAvatar src={avatar} name={username} level={level} size="sm" showBadge={false} frame={equippedFrame} ring={equippedRing} renderConfigOverride={profileMedia?.render_config} className={cn("origin-center", speaking && "ring-2 ring-fuchsia-400 shadow-[0_0_24px_rgba(236,72,153,0.95)] animate-[pulse_0.85s_ease-in-out_infinite]")} />
          </CpSeatAura>
          <span className={cn("absolute bottom-0 right-0 z-40 grid h-4 w-4 place-items-center rounded-full border-2 border-black text-white shadow-md", isMuted ? "bg-red-500" : "bg-emerald-500")}>
            {isMuted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}
          </span>
        </span>
        <span className="flex w-full items-center justify-center gap-0.5 truncate px-0.5 text-[9px] font-bold leading-tight text-white text-center drop-shadow">
          <span className="truncate">{username}</span>
        </span>
        <span className="flex items-center gap-0.5 text-[8px] font-medium text-white">
          <Heart className="h-2 w-2 fill-pink-500 text-pink-500" />
          {formatCount(giftScore)}
        </span>
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
  hostSeated?: boolean;
}

export function SeatGrid({ seats, seatCount, host, roomId, isHost = false, onSeatTap, onJoinSeat, onHostTap, hostSeated = false }: SeatGridProps) {
  const capacity = normalizeCapacity(seatCount);
  const [requests, setRequests] = useState<SeatRequest[]>([]);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [moderatorCanManageSeats, setModeratorCanManageSeats] = useState(false);
  const [lockBusy, setLockBusy] = useState<number | null>(null);
  const [selectedEmptySeat, setSelectedEmptySeat] = useState<RoomSeat | null>(null);
  const [roomViewers, setRoomViewers] = useState<RoomViewer[]>([]);
  const [hostSeatIndex, setHostSeatIndex] = useState(1);

  // Load all seated users' frame/ring/level/country metadata in one batch.
  const seatUserIds = [...new Set([host.id, ...seats.map((seat) => seat.user?.id).filter((id): id is string => !!id)])].sort().join(",");
  const [profileMediaById, setProfileMediaById] = useState<Record<string, SeatProfileMedia>>({});

  useEffect(() => {
    if (!seatUserIds) { setProfileMediaById({}); return; }
    let active = true;
    const ids = seatUserIds.split(",");
    void supabase.from("profiles")
      .select("id,frame,ring,vip_level,frame_render_config,country,country_code")
      .in("id", ids)
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const next: Record<string, SeatProfileMedia> = {};
        for (const row of data as Array<{ id: string; frame?: string | null; ring?: string | null; vip_level?: number | null; frame_render_config?: unknown; country?: string | null; country_code?: string | null }>) {
          next[row.id] = {
            frame: row.frame ?? null,
            ring: row.ring ?? null,
            level: Number(row.vip_level ?? 0),
            render_config: row.frame_render_config ?? {},
            country: row.country ?? null,
            country_code: row.country_code ?? null,
          };
        }
        void supabase.rpc("cp_room_badges", { p_user_ids: ids }).then(({ data: cpRows, error: cpError }) => {
          if (!active || cpError || !cpRows) return;
          for (const cp of cpRows as Array<{ user_id: string; partner_id: string; partner_username: string | null; partner_avatar: string | null; cp_level: number; cp_level_name: string; badge_url: string | null; intimacy_score: number }>) {
            const previous = next[cp.user_id] ?? { frame: null, ring: null, level: 0, render_config: {}, country: null, country_code: null };
            next[cp.user_id] = { ...previous, cp_level: Number(cp.cp_level), cp_level_name: cp.cp_level_name, cp_partner_id: cp.partner_id, cp_partner_username: cp.partner_username, cp_partner_avatar: cp.partner_avatar, cp_badge_url: cp.badge_url, cp_intimacy_score: Number(cp.intimacy_score) };
          }
          if (active) setProfileMediaById({ ...next });
        });
        setProfileMediaById(next);
      });
    return () => { active = false; };
  }, [seatUserIds]);

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
        const { data: profiles } = await supabase.from("profiles").select("id,username,avatar,country,country_code").in("id", ids);
        profilesById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      }
      setRequests(rows.map((r: any) => ({ id: r.id, from_user: r.from_user, seat_index: r.seat_index, created_at: r.created_at, username: profilesById[r.from_user]?.username || "User", avatar: profilesById[r.from_user]?.avatar || null, country: profilesById[r.from_user]?.country ?? null, country_code: profilesById[r.from_user]?.country_code ?? null })));
    };
    const upsertRequest = async (row: any) => {
      if (row.status !== "pending") { setRequests(prev => prev.filter(r => r.id !== row.id)); return; }
      const { data: profile } = await supabase.from("profiles").select("id,username,avatar,country,country_code").eq("id", row.from_user).maybeSingle();
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
      const { data } = await supabase.from("room_members").select("user_id, profiles(id, username, avatar, country, country_code)").eq("room_id", roomId);
      if (!active || !data) return;
      setRoomViewers(data.map((m: any) => ({ id: m.profiles?.id || m.user_id, username: m.profiles?.username || "User", avatar: m.profiles?.avatar || null, country: m.profiles?.country ?? null, country_code: m.profiles?.country_code ?? null })));
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
      const message = error.message || "";
      const alreadyHandled =
        /request already handled|request not found|status.*pending/i.test(message);
      if (alreadyHandled) {
        setRequests(prev => prev.filter(r => r.id !== request.id));
        toast.info("This seat request was already handled.");
      } else {
        toast.error(message || (accept ? "Could not approve seat request" : "Could not reject seat request"));
      }
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
    // Seat 1 stays visibly empty until the verified room owner explicitly claims it.
    if (idx === 1 && isHost) {
      onJoinSeat?.(1);
      return;
    }
    if (canManageSeats) {
      setSelectedEmptySeat(seat);
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
  const allSeats: (RoomSeat & { isHost?: boolean; isHostSeat?: boolean })[] = Array.from({ length: capacity }, (_, offset) => {
    const index = offset + 1;
    if (index === safeHostSeatIndex) {
      if (!hostSeated) {
        return { index, seatNumber: index, isHostSeat: true, user: null, is_locked: false, is_requested: false };
      }
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

  // Detect if any couple is present on stage
  const activeStageCouple = useMemo(() => {
    const seatedList: Array<{ seatIndex: number; userId: string; username: string; avatar: string | null; cpLevel: number; partnerId?: string | null }> = [];
    const hostMedia = profileMediaById[host.id];
    if (hostMedia?.cp_partner_id) {
      seatedList.push({
        seatIndex: safeHostSeatIndex,
        userId: host.id,
        username: host.username,
        avatar: host.avatar,
        cpLevel: hostMedia.cp_level || 1,
        partnerId: hostMedia.cp_partner_id,
      });
    }
    for (const seat of seats) {
      const u = seat.user;
      if (u?.id) {
        const media = profileMediaById[u.id];
        if (media?.cp_partner_id) {
          seatedList.push({
            seatIndex: seat.index ?? seat.seatNumber ?? 1,
            userId: u.id,
            username: u.username,
            avatar: u.avatar,
            cpLevel: media.cp_level || 1,
            partnerId: media.cp_partner_id,
          });
        }
      }
    }
    for (let i = 0; i < seatedList.length; i++) {
      for (let j = i + 1; j < seatedList.length; j++) {
        if (seatedList[i].partnerId === seatedList[j].userId) {
          return {
            partnerA: seatedList[i],
            partnerB: seatedList[j],
            intimacyScore: profileMediaById[seatedList[i].userId]?.cp_intimacy_score || 0,
            daysTogether: Math.max(1, Math.floor((profileMediaById[seatedList[i].userId]?.cp_intimacy_score || 0) / 100)),
          };
        }
      }
    }
    return null;
  }, [seats, host, profileMediaById, safeHostSeatIndex]);

  return (
    <section data-seat-grid="true" data-seat-grid-root="true" className="relative mx-auto flex w-full max-w-[480px] min-h-0 flex-col items-center justify-center px-[clamp(2px,1.2vw,8px)] py-1 bg-transparent overflow-visible" data-seat-capacity={capacity}>
      <div data-seat-grid-cells="true" className="grid w-full grid-cols-5 items-start justify-items-center gap-x-1 gap-y-1 bg-transparent [grid-auto-rows:84px]">
        <CpStageConnectionOverlay couple={activeStageCouple} capacity={capacity} />
        {allSeats.map((seat) => {
          const seatIdx = seat.index ?? seat.seatNumber ?? 1;
          const occupiedIds = new Set([host.id, ...seats.map((item) => item.user?.id).filter((id): id is string => !!id)]);
          const seatCp = seat.user?.id ? profileMediaById[seat.user.id] : null;
          const partnerPresentOnStage = !!seatCp?.cp_partner_id && occupiedIds.has(seatCp.cp_partner_id);
          const hostCp = profileMediaById[host.id];
          const hostPartnerPresentOnStage = !!hostCp?.cp_partner_id && occupiedIds.has(hostCp.cp_partner_id);

          if (seat.isHost) {
            const hostSpeaking = (host.is_speaking && !host.is_muted) || false;
            return (
              <div 
                key={seatIdx} 
                data-seat="true" 
                data-seat-cell="true" 
                data-user-dp={host.id} 
                data-jalwa-live-component="voice.host" 
                data-seat-index={seatIdx} 
                className="relative flex h-[84px] min-h-[84px] w-full min-w-0 flex-col items-center justify-start p-0.5 overflow-visible"
              >
                <button 
                  type="button" 
                  onClick={() => onHostTap?.()} 
                  className="group relative flex w-full flex-col items-center justify-center gap-0.5 bg-transparent p-0 transition-all active:scale-95 border-0 shadow-none cursor-pointer"
                >
                  <span className="absolute left-0.5 top-0 z-10 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/80 border border-amber-500 text-[8px] font-black text-amber-300 shadow">
                    {seatIdx}
                  </span>
                  <span data-avatar="true" data-seat-media="true" className="relative z-20 h-[62px] w-[62px] shrink-0 p-0 flex items-center justify-center my-0.5 bg-transparent overflow-visible">
                    <CpSeatAura 
                      cpLevel={hostCp?.cp_level} 
                      partnerPresentOnStage={hostPartnerPresentOnStage} 
                      isSpeaking={hostSpeaking}
                    >
                      <LevelAvatar 
                        src={host.avatar} 
                        name={host.username} 
                        level={host.level ?? hostCp?.level ?? 0} 
                        size="sm" 
                        showBadge={false} 
                        frame={host.avatar_frame_url || host.frame_url || hostCp?.frame} 
                        ring={host.ring || hostCp?.ring} 
                        renderConfigOverride={hostCp?.render_config} 
                        className={cn("origin-center", hostSpeaking && "ring-2 ring-fuchsia-400 shadow-[0_0_24px_rgba(236,72,153,0.95)] animate-[pulse_0.85s_ease-in-out_infinite]")} 
                      />
                    </CpSeatAura>
                    <span className="absolute -left-1 -top-1 z-40 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[#5b2800] shadow">
                      <Crown className="h-2.5 w-2.5 fill-current" />
                    </span>
                    <span className={cn("absolute bottom-0 right-0 z-40 grid h-4 w-4 place-items-center rounded-full border-2 border-black text-white shadow-md", host.is_muted ? "bg-red-500" : "bg-emerald-500")}>
                      {host.is_muted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}
                    </span>
                  </span>
                  <span className="flex w-full items-center justify-center gap-0.5 truncate px-0.5 text-[9px] font-bold text-white text-center drop-shadow">
                    <span className="truncate">{host.username}</span>
                  </span>
                  <span className="flex items-center gap-0.5 text-[8px] font-medium text-white">
                    <Heart className="h-2 w-2 fill-pink-500 text-pink-500" />
                    {formatCount(host.gift_score ?? 0)}
                  </span>
                </button>
              </div>
            );
          }

          return (
            <Seat 
              key={seatIdx} 
              seat={{ ...seat, index: seatIdx }} 
              profileMedia={seat.user?.id ? profileMediaById[seat.user.id] ?? null : null} 
              partnerPresentOnStage={partnerPresentOnStage} 
              onClick={() => void handleSeatClick(seat)} 
            />
          );
        })}
      </div>

      {selectedEmptySeat && (
        <div className="absolute inset-0 z-50 flex items-end justify-center px-3 pb-3 pointer-events-none" onClick={() => setSelectedEmptySeat(null)}>
          <div className="pointer-events-auto relative w-full max-w-sm rounded-[26px] border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl " onClick={e => e.stopPropagation()}>
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
                  <div className="flex min-w-0 items-center gap-2"><img src={viewer.avatar || DEFAULT_SEAT_AVATAR} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /><span className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold">{viewer.username}</span></div>
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
          <div className="space-y-1.5">{requests.map(request => <div key={request.id} className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-[#1e1238] p-1.5">{request.avatar ? <img src={request.avatar} alt={request.username} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-amber-500" /> : <div className="grid h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">{request.username[0]?.toUpperCase()}</div>}<div className="min-w-0 flex-1"><div className="flex items-center gap-1 truncate text-[11px] font-bold text-white">{request.username}</div><div className="truncate text-[9px] text-white/50">Wants to join a seat</div><div className="text-[9px] text-white">Requesting Seat {request.seat_index ?? "any"}</div></div><button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white disabled:opacity-50" aria-label={`Accept ${request.username}'s seat request`}><Check className="h-4 w-4" /></button><button type="button" disabled={busyRequest === request.id} onClick={() => void respond(request, false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500 text-white disabled:opacity-50" aria-label={`Reject ${request.username}'s seat request`}><X className="h-4 w-4" /></button></div>)}</div>
        </div>
      )}
    </section>
  );
}
