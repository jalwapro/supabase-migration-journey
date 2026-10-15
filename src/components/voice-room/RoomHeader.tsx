import { Flag, Share2, Power, Trophy, Users, ChevronRight, Pencil, ImagePlus, Minimize2, LogOut, X, Search, UserPlus, Loader2, Flame, Crown, Medal, Star } from "lucide-react";
import type { RoomState } from "@/types/room";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToUserFolder } from "@/lib/uploads";
import { useRoomEntrances } from "@/hooks/useRoomEntrances";
import { EntrancePlayer } from "@/components/room/EntrancePlayer";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useVoiceRoomSession } from "@/context/VoiceRoomSessionContext";

interface RoomHeaderProps { room: RoomState; roomCode: string; onlineCount: number; topGifterName?: string | null; topGifterCoins?: number; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; isHost?: boolean; exitMenuOpen?: boolean; onExitMenuOpenChange?: (open: boolean) => void; }
type RoomMemberPreview = { id: string; username: string; avatar: string | null; country?: string | null; country_code?: string | null; level: number; host?: boolean; moderator?: boolean };
type IncomingSeatInvite = { id: string; fromUser: string; inviterName: string; inviterAvatar: string | null; role: "Host" | "Moderator"; seatIndex: number | null };

export function RoomHeader({ room, roomCode, onlineCount, topGifterName, topGifterCoins, onHostTap, onReport, onShare, onExit, onHome, isHost: isHostProp = false, exitMenuOpen: exitMenuOpenProp, onExitMenuOpenChange }: RoomHeaderProps) {
  const { user } = useAuth();
  const { minimizeRoom: saveMinimizedRoom } = useVoiceRoomSession();
  const isHost = isHostProp || user?.id === room.host.id;
  const { current: currentEntrance, done: finishEntrance } = useRoomEntrances(room.id, user?.id ?? null);
  const [roomTitle, setRoomTitle] = useState(room.title);
  const [roomDp, setRoomDp] = useState<string | null>(room.host.avatar);
  const [internalExitMenuOpen, setInternalExitMenuOpen] = useState(false);
  const exitMenuOpen = exitMenuOpenProp ?? internalExitMenuOpen;
  const setExitMenuOpen = (open: boolean) => { setInternalExitMenuOpen(open); onExitMenuOpenChange?.(open); };
  const [hostExitConfirmOpen, setHostExitConfirmOpen] = useState(false);
  const [hostEndConfirmOpen, setHostEndConfirmOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<RoomMemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [pendingInvites, setPendingInvites] = useState<Set<string>>(new Set());
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<IncomingSeatInvite | null>(null);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [seatPickerUser, setSeatPickerUser] = useState<RoomMemberPreview | null>(null);
  const [exiting, setExiting] = useState(false);
  const [topRooms, setTopRooms] = useState<Array<{ id: string; title: string; cover_url: string | null; viewer_count: number; host_id: string; host_avatar?: string | null }>>([]);
  const [topRoomsLoading, setTopRoomsLoading] = useState(false);
  const [hostRankOpen, setHostRankOpen] = useState(false);
  const [hostRankLoading, setHostRankLoading] = useState(false);
  const [hostRank, setHostRank] = useState<{ rank: number | null; score: number; frame: string | null; ring: string | null } | null>(null);
  const [peopleAvatars, setPeopleAvatars] = useState<Array<{ user_id: string; avatar: string | null }>>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setRoomTitle(room.title), [room.title]);
  useEffect(() => setRoomDp(room.host.avatar), [room.host.avatar]);
  useEffect(() => {
    let active = true;
    let loading = false;
    const loadPeopleAvatars = async () => {
      if (loading) return;
      loading = true;
      try {
        const { data, error } = await supabase
          .from("room_members")
          .select("user_id,last_seen_at,user:profiles!room_members_user_id_fkey(avatar)")
          .eq("room_id", room.id)
          .gte("last_seen_at", new Date(Date.now() - 120_000).toISOString())
          .limit(3);
        if (error) throw error;
        if (active) {
          const seen = new Set<string>();
          setPeopleAvatars(((data ?? []) as Array<{ user_id: string; last_seen_at: string | null; user?: { avatar: string | null } | null }>)
            .filter((row) => row.user_id && !seen.has(row.user_id) && !!seen.add(row.user_id))
            .map((row) => ({ user_id: row.user_id, avatar: row.user?.avatar ?? null })));
        }
      } catch (error) {
        console.warn("[room people avatars]", error);
      } finally {
        loading = false;
      }
    };
    void loadPeopleAvatars();
    const channel = supabase.channel(`room-people-avatars-${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` }, () => void loadPeopleAvatars())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` }, () => void loadPeopleAvatars())
      .subscribe();
    const interval = window.setInterval(() => void loadPeopleAvatars(), 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [room.id]);

  useEffect(() => {
    if (!exitMenuOpen) return;
    let active = true;
    setTopRoomsLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("live_rooms")
          .select("id,title,cover_url,viewer_count,host_id")
          .eq("status", "live")
          .eq("room_type", "voice")
          .neq("id", room.id)
          .order("viewer_count", { ascending: false, nullsFirst: false })
          .limit(10);
        if (error) throw error;
        const rows = (data ?? []) as Array<{ id: string; title: string | null; cover_url: string | null; viewer_count: number | null; host_id: string }>;
        const hostIds = [...new Set(rows.map((item) => item.host_id).filter(Boolean))];
        const { data: profiles } = hostIds.length
          ? await supabase.from("profiles").select("id,avatar").in("id", hostIds)
          : { data: [] as Array<{ id: string; avatar: string | null }> };
        const avatars = new Map((profiles ?? []).map((item: { id: string; avatar: string | null }) => [item.id, item.avatar]));
        const roomIds = rows.map((item) => item.id);
        const { data: memberRows, error: memberError } = roomIds.length
          ? await supabase.from("room_members").select("room_id,user_id,last_seen_at").in("room_id", roomIds).gte("last_seen_at", new Date(Date.now() - 120_000).toISOString())
          : { data: [], error: null };
        if (memberError) throw memberError;
        const counts = new Map<string, Set<string>>();
        for (const member of (memberRows ?? []) as Array<{ room_id: string; user_id: string; last_seen_at: string | null }>) {
          const people = counts.get(member.room_id) ?? new Set<string>();
          people.add(member.user_id);
          counts.set(member.room_id, people);
        }
        if (active) setTopRooms(rows.map((item) => ({
          id: item.id,
          title: item.title || "Live Room",
          cover_url: item.cover_url,
          viewer_count: counts.get(item.id)?.size ?? 0,
          host_id: item.host_id,
          host_avatar: avatars.get(item.host_id) ?? null,
        })));
      } catch (error) {
        if (active) {
          setTopRooms([]);
          console.warn("[top live rooms]", error);
        }
      } finally {
        if (active) setTopRoomsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [exitMenuOpen, room.id]);
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); handler(); };
  const hostName = room.host.username || "Host";
  const actionClass = "relative z-[62] grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/80 bg-[color:var(--secondary)]/30 text-white shadow-[0_1px_8px_rgba(0,0,0,.35)] touch-manipulation active:scale-95";
  const hostProfileClick = () => onHostTap ? onHostTap() : onHome();
  const canInviteToSeat = isHost || user?.id === room.host.id;

  const showIncomingInvite = async (invite: { id: string; from_user: string; seat_index: number | null }) => {
    if (!user?.id || invite.from_user === user.id) return;
    const { data: inviter } = await supabase.from("profiles").select("username,avatar,country,country_code").eq("id", invite.from_user).maybeSingle();
    const { data: roomRow } = await supabase.from("live_rooms").select("host_id").eq("id", room.id).maybeSingle();
    let role: "Host" | "Moderator" = roomRow?.host_id === invite.from_user ? "Host" : "Moderator";
    if (role !== "Host") {
      const { data: mod } = await supabase.from("room_members").select("is_moderator").eq("room_id", room.id).eq("user_id", invite.from_user).maybeSingle();
      if (!mod?.is_moderator) return;
    }
    setIncomingInvite({ id: invite.id, fromUser: invite.from_user, inviterName: inviter?.username || role, inviterAvatar: inviter?.avatar ?? null, role, seatIndex: invite.seat_index ?? null });
  };

  useEffect(() => {
    if (!user?.id) { setIncomingInvite(null); return; }
    let active = true;
    let polling = false;
    const loadPending = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        const { data } = await supabase.from("seat_invites").select("id,from_user,seat_index").eq("room_id", room.id).eq("to_user", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1);
        if (active && data?.[0]) {
          setIncomingInvite(current => current?.id === data[0].id ? current : null);
          await showIncomingInvite(data[0] as { id: string; from_user: string; seat_index: number | null });
        }
      } finally { polling = false; }
    };
    void loadPending();
    const interval = window.setInterval(() => { if (!incomingInvite) void loadPending(); }, 10000);
    const channel = supabase.channel(`voice-seat-invites-${room.id}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "seat_invites", filter: `room_id=eq.${room.id}` }, payload => {
        const row = payload.new as { id: string; from_user: string; to_user: string; seat_index: number | null; status: string };
        if (row.to_user === user.id && row.status === "pending") void showIncomingInvite(row);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seat_invites", filter: `room_id=eq.${room.id}` }, payload => {
        const row = payload.new as { id: string; to_user: string; status: string };
        if (row.to_user === user.id && row.status !== "pending") setIncomingInvite(current => current?.id === row.id ? null : current);
      });
    void channel.subscribe();
    return () => { active = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [room.id, user?.id, incomingInvite?.id]);

  const respondToIncomingInvite = async (accept: boolean) => {
    if (!incomingInvite || respondingInvite) return;
    setRespondingInvite(true);
    try {
      if (accept) {
        const { data: seatedAt, error } = await supabase.rpc("accept_seat_invite", { _invite_id: incomingInvite.id });
        if (error) throw error;
        toast.success(seatedAt != null ? `Seat ${Number(seatedAt)} joined` : "Seat invite accepted");
      } else {
        const { error } = await supabase.from("seat_invites").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", incomingInvite.id).eq("to_user", user?.id ?? "").eq("status", "pending");
        if (error) throw error;
        toast.success("Seat invite declined");
      }
      setIncomingInvite(null);
    } catch (error) {
      toast.error(`Unable to ${accept ? "accept" : "decline"} seat invite: ${(error as Error).message || "Unknown error"}`);
    } finally { setRespondingInvite(false); }
  };

  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const ids = new Set<string>();
      const seeded: RoomMemberPreview[] = [];
      if (room.host.id) { ids.add(room.host.id); seeded.push({ id: room.host.id, username: room.host.username || "Host", avatar: room.host.avatar, country: room.host.country, country_code: room.host.country_code, level: room.host.vip_level ?? 0, host: true }); }
      room.seats.forEach((seat) => { if (seat.user?.id && !ids.has(seat.user.id)) { ids.add(seat.user.id); seeded.push({ id: seat.user.id, username: seat.user.username || "User", avatar: seat.user.avatar, level: seat.user.vip_level ?? 0 }); } });
      const { data, error } = await supabase.from("room_members").select("user_id,is_moderator").eq("room_id", room.id).limit(100);
      if (error) throw error;
      const memberIds = (data ?? []).map((row: { user_id: string }) => row.user_id).filter(Boolean);
      memberIds.forEach(id => ids.add(id));
      const missingIds = [...new Set([...memberIds, ...seeded.filter(m => !m.country && !m.country_code).map(m => m.id)])].filter(id => { const existing = seeded.find(m => m.id === id); return !existing || (!existing.country && !existing.country_code); });
      const moderators = new Set((data ?? []).filter((row: { is_moderator?: boolean }) => row.is_moderator).map((row: { user_id: string }) => row.user_id));
      seeded.forEach(m => { if (moderators.has(m.id)) m.moderator = true; });
      if (missingIds.length) {
        const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,avatar,country,country_code,vip_level").in("id", missingIds).limit(100);
        if (profileError) throw profileError;
        (profiles ?? []).forEach((p: { id: string; username: string | null; avatar: string | null; country?: string | null; country_code?: string | null; vip_level?: number | null }) => { const existing = seeded.find(m => m.id === p.id); if (existing) { existing.country = p.country; existing.country_code = p.country_code; } else seeded.push({ id: p.id, username: p.username || "User", avatar: p.avatar, country: p.country, country_code: p.country_code, level: p.vip_level ?? 0, moderator: moderators.has(p.id) }); });
      }
      if (canInviteToSeat) {
        const { data: invites, error: inviteError } = await supabase.from("seat_invites").select("to_user").eq("room_id", room.id).eq("status", "pending");
        if (!inviteError) setPendingInvites(new Set((invites ?? []).map((row: { to_user: string }) => row.to_user).filter(Boolean)));
      }
      setMembers(seeded);
    } catch (error) { toast.error(`Unable to load room members: ${(error as Error).message || "Unknown error"}`); setMembers([]); }
    finally { setMembersLoading(false); }
  };
  const openMembers = () => { setMembersOpen(true); setMemberSearch(""); void loadMembers(); };

  const inviteToSeat = async (memberId: string, seatNumber: number) => {
    if (!user?.id || !canInviteToSeat || invitingUserId) return;
    if (memberId === room.host.id) return;
    const safeSeat = Math.floor(Number(seatNumber));
    if (!Number.isFinite(safeSeat) || safeSeat < 2 || safeSeat > 20) {
      toast.error("Invalid voice seat number");
      return;
    }
    if (room.seats.some((seat) => seat.user?.id === memberId)) { toast.info("User is already on a seat"); return; }
    const selectedSeat = room.seats.find((seat) => seat.index === safeSeat);
    if (selectedSeat?.user?.id) { toast.error(`Seat ${safeSeat} is already occupied`); return; }
    setInvitingUserId(memberId);
    try {
      const { error: cancelError } = await supabase.from("seat_invites").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("room_id", room.id).eq("to_user", memberId).eq("status", "pending");
      if (cancelError) throw cancelError;
      const { error } = await supabase.from("seat_invites").insert({ room_id: room.id, from_user: user.id, to_user: memberId, seat_index: safeSeat, status: "pending" });
      if (error) throw error;
      setPendingInvites(prev => { const next = new Set(prev); next.delete(memberId); return next; });
      const target = members.find(m => m.id === memberId);
      toast.success(`Seat ${safeSeat} invite sent to ${target?.username ?? "user"}`);
      setSeatPickerUser(null);
    } catch (error) { toast.error(`Unable to send seat invite: ${(error as Error).message || "Unknown error"}`); }
    finally { setInvitingUserId(null); }
  };

  const saveRoomTitle = async () => {
    if (!isHost || !user?.id) return;
    const next = window.prompt("Room name", roomTitle)?.trim();
    if (!next || next === roomTitle) return;
    const { error } = await supabase.from("live_rooms").update({ title: next }).eq("id", room.id).eq("host_id", user.id);
    if (error) { toast.error(error.message || "Unable to change room name"); return; }
    setRoomTitle(next); toast.success("Room name updated");
  };
  const saveRoomDp = async (file: File) => {
    if (!isHost || !user?.id) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Room image must be 15MB or smaller"); return; }
    try { const result = await uploadToUserFolder("room-covers", file, user.id, room.id); const { error } = await supabase.rpc("update_room_cover", { _room_id: room.id, _cover_url: result.url }); if (error) throw error; setRoomDp(result.url); toast.success("Room DP updated"); }
    catch (e) { toast.error(`Unable to upload room DP: ${(e as Error).message || "Cloud storage error"}`); }
  };
  const openHostRank = async () => {
    setHostRankOpen(true);
    setHostRankLoading(true);
    try {
      const [rankResult, profileResult] = await Promise.all([
        supabase.rpc("rank_users", { p_category: "hosts", p_period: "daily", p_scope: "global", p_scope_value: null, p_limit: 50 }),
        supabase.from("profiles").select("frame,ring").eq("id", room.host.id).maybeSingle(),
      ]);
      if (rankResult.error) throw rankResult.error;
      const rows = (rankResult.data ?? []) as Array<{ user_id: string; rnk: number; score: number }>;
      const found = rows.find((row) => row.user_id === room.host.id);
      setHostRank({ rank: found?.rnk ?? null, score: Number(found?.score ?? 0), frame: profileResult.data?.frame ?? null, ring: profileResult.data?.ring ?? null });
    } catch (error) {
      setHostRank({ rank: null, score: 0, frame: null, ring: null });
      toast.error(`Unable to load host rank: ${(error as Error).message || "Unknown error"}`);
    } finally {
      setHostRankLoading(false);
    }
  };
  const openExitMenu = () => setExitMenuOpen(true);
  const minimizeRoom = () => {
    setExitMenuOpen(false);
    if (user?.id) {
      saveMinimizedRoom({
        roomId: room.id,
        roomName: room.title,
        roomAvatar: room.host.avatar,
        roomRoute: `/room/${encodeURIComponent(room.id)}`,
        userId: user.id,
        userRole: isHost ? "host" : "user",
        connectionState: "connected",
        microphoneMuted: false,
      });
    }
    onHome();
  };
  const performExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      if (user?.id) {
        if (isHost) {
          const { error } = await supabase.rpc("leave_room_as_host", { _room_id: room.id, _end_now: false });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("room_members").delete().eq("room_id", room.id).eq("user_id", user.id);
          if (error) throw error;
        }
      }
      setHostExitConfirmOpen(false);
      setExitMenuOpen(false);
      window.location.assign("/");
    } catch (e) { setExiting(false); toast.error(`Couldn't exit room: ${(e as Error).message || "Unknown error"}`); }
  };
  const performEndRoom = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const { error } = await supabase.rpc("leave_room_as_host", { _room_id: room.id, _end_now: true });
      if (error) throw error;
      setHostEndConfirmOpen(false);
      setHostExitConfirmOpen(false);
      setExitMenuOpen(false);
      window.location.assign("/");
    } catch (e) { setExiting(false); toast.error(`Couldn't end room: ${(e as Error).message || "Unknown error"}`); }
  };
  const exitRoom = () => { setExitMenuOpen(false); if (isHost) { setHostExitConfirmOpen(true); return; } void performExit(); };
  const endRoom = () => { setExitMenuOpen(false); setHostEndConfirmOpen(true); };
  const confirmHostExit = () => { void performExit(); };
  const confirmHostEnd = () => { void performEndRoom(); };
  const filteredMembers = members.filter(member => !memberSearch.trim() || member.username.toLowerCase().includes(memberSearch.trim().toLowerCase()));

  return <header data-room-header="true" className="relative z-[60] flex shrink-0 flex-col px-2 pt-0 sm:px-2.5" style={{ pointerEvents: "auto", backgroundColor: "transparent" }}>
    <div className="relative z-[61] flex min-h-[42px] items-center gap-1">
      <div role="button" tabIndex={0} onClick={hostProfileClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") hostProfileClick(); }} className="relative z-[62] flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[color:var(--secondary)]/75 bg-[color:var(--secondary)]/25 p-2 text-left shadow-[0_1px_10px_rgba(0,0,0,.35)] active:opacity-85" aria-label={`Open ${hostName} profile`}>
        {roomDp ? <img src={roomDp} alt="" className="h-8 w-8 shrink-0 rounded-full border-2 border-[color:var(--secondary)] object-cover shadow-[0_1px_8px_rgba(0,0,0,.45)]" /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-[color:var(--secondary)] bg-black/15 text-sm font-black">{hostName.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><div className="truncate text-[14px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.95)]">{roomTitle}</div>{isHost && <button type="button" aria-label="Change room name" onClick={tap(saveRoomTitle)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[color:var(--secondary)]/80 bg-black/15 text-white"><Pencil className="h-3 w-3" /></button>}</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]"><span className="inline-grid h-4 w-4 place-items-center rounded-full border border-[color:var(--secondary)] bg-[color:var(--secondary)]/70 text-[9px] text-white">◆</span><span className="truncate">ID:{roomCode}</span></div></div>
        {isHost && <button type="button" aria-label="Change room DP" onClick={tap(() => fileRef.current?.click())} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color:var(--secondary)]/80 bg-black/15 text-white"><ImagePlus className="h-3.5 w-3.5" /></button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void saveRoomDp(f); }} />
      {!isHost && <button type="button" onClick={tap(onReport)} className={actionClass} aria-label="Report room"><Flag className="h-4 w-4" /></button>}
      <button type="button" onClick={tap(onShare)} className={actionClass} aria-label="Share room"><Share2 className="h-4 w-4" /></button>
      <button type="button" onClick={tap(openExitMenu)} className={actionClass} aria-label="Room exit options" aria-expanded={exitMenuOpen}><Power className="h-4 w-4" /></button>
    </div>
    <div className="relative z-[61] mt-0 flex min-h-[25px] items-center gap-1 border-b border border-[color:var(--secondary)]/80">
      <button type="button" onClick={tap(openHostRank)} className="relative z-[62] flex min-w-0 flex-1 items-center gap-1.5 px-1 py-0.5 text-[10px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)] active:opacity-80" aria-label="Show host rank card" aria-haspopup="dialog"><Trophy className="h-4 w-4 shrink-0 text-[color:var(--secondary)]"/><span className="truncate">{topGifterName ? `${topGifterName} · ${((topGifterCoins ?? 0) / 1000).toFixed(1)}k` : "No ranking yet"}</span><ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/90"/></button>
      <button type="button" onClick={tap(openMembers)} className="relative z-[62] flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--secondary)]/80 bg-[color:var(--secondary)]/25 px-2 py-1 text-[10px] text-white shadow-[0_1px_6px_rgba(0,0,0,.35)] touch-manipulation active:scale-95" aria-label={`Open ${onlineCount} room members`} aria-expanded={membersOpen}><span className="flex -space-x-1.5">{peopleAvatars.map((person) => <span key={person.user_id} className="h-4 w-4 overflow-hidden rounded-full border border-white/70 bg-violet-900">{person.avatar ? <img src={person.avatar} alt="" loading="lazy" className="h-full w-full object-cover"/> : <span className="block h-full w-full bg-white/15"/>}</span>)}</span><Users className="h-3.5 w-3.5"/><span>{onlineCount}</span></button>
    </div>
    {hostRankOpen && <div className="fixed inset-0 z-[2147483020] grid place-items-center bg-black/75 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="host-rank-title" onClick={() => setHostRankOpen(false)}>
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-[28px] border border-amber-300/40 bg-gradient-to-b from-[#32175a] via-[#170a2c] to-[#08030f] p-4 text-white shadow-[0_20px_70px_rgba(0,0,0,.75)]" onClick={e => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        <button type="button" onClick={() => setHostRankOpen(false)} aria-label="Close host rank card" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/30"><X className="h-4 w-4"/></button>
        <div className="mb-4 flex items-center justify-center gap-2"><Crown className="h-5 w-5 fill-amber-300 text-amber-200"/><h2 id="host-rank-title" className="text-xs font-black uppercase tracking-[.22em] text-amber-200">Host Rank Card</h2></div>
        {hostRankLoading ? <div className="flex flex-col items-center py-8"><Loader2 className="h-7 w-7 animate-spin text-amber-300"/><p className="mt-3 text-xs text-white/60">Loading host rank…</p></div> : <div className="relative overflow-hidden rounded-[22px] border border-amber-300/30 bg-gradient-to-br from-amber-500/15 via-violet-900/30 to-black/50 p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl"/>
          <div className="relative flex flex-col items-center">
            <div className="relative mb-3 h-[92px] w-[92px] rounded-full border-2 border-amber-300/80 bg-amber-300/10 p-1 shadow-[0_0_24px_rgba(251,191,36,.2)]">
              {room.host.avatar ? <img src={room.host.avatar} alt="" className="h-full w-full rounded-full object-cover"/> : <div className="grid h-full w-full place-items-center rounded-full bg-white/10 text-2xl font-black">{hostName.charAt(0).toUpperCase()}</div>}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-300 to-yellow-600 px-3 py-0.5 text-[10px] font-black text-black">HOST</div>
            </div>
            <p className="mt-2 max-w-full truncate text-lg font-black">{hostName}</p>
            <p className="mt-1 text-[10px] font-semibold text-white/55">Level {room.host.vip_level ?? 1}{room.host.country ? ` · ${room.host.country}` : ""}</p>
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <div className="rounded-2xl border border-amber-300/25 bg-black/25 p-3 text-center"><Medal className="mx-auto h-5 w-5 text-amber-300"/><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/55">Daily Host Rank</p><p className="mt-1 text-xl font-black text-amber-300">{hostRank?.rank ? `#${hostRank.rank}` : "Unranked"}</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center"><Star className="mx-auto h-5 w-5 text-violet-300"/><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/55">Host Score</p><p className="mt-1 text-xl font-black text-white">{Number(hostRank?.score ?? 0).toLocaleString()}</p></div>
            </div>
            {!hostRank?.rank && <p className="mt-3 text-center text-[10px] leading-relaxed text-white/50">Host is not in the current top 50 daily host rankings.</p>}
          </div>
        </div>}
        <button type="button" onClick={() => setHostRankOpen(false)} className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-white/80 active:scale-[.99]">Close</button>
      </div>
    </div>}
    {incomingInvite && <div className="fixed inset-0 z-[2147483010] flex items-start justify-center bg-black/45 px-4 pt-[calc(92px+env(safe-area-inset-top))] " role="dialog" aria-modal="true" aria-labelledby="seat-invite-title"><div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-black/95 text-white shadow-2xl"><div className="flex items-center gap-3 border-b border-white/10 px-4 py-4"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10">{incomingInvite.inviterAvatar ? <img src={incomingInvite.inviterAvatar} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full w-full place-items-center text-sm font-black">{incomingInvite.inviterName.charAt(0).toUpperCase()}</div>}</div><div className="min-w-0 flex-1"><h2 id="seat-invite-title" className="text-sm font-black">Seat Invitation</h2><p className="mt-0.5 text-xs text-white/70"><span className="font-bold text-white">{incomingInvite.inviterName}</span> ({incomingInvite.role}) is inviting you to join a seat.</p></div><button type="button" disabled={respondingInvite} onClick={() => setIncomingInvite(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 disabled:opacity-40" aria-label="Close invite"><X className="h-4 w-4"/></button></div><div className="px-4 py-3 text-[10px] text-white/50">{incomingInvite.seatIndex != null ? `Seat ${incomingInvite.seatIndex + 1} is reserved for you.` : "A free seat will be assigned when you accept."}</div><div className="flex gap-2 px-4 pb-4"><button type="button" disabled={respondingInvite} onClick={() => void respondToIncomingInvite(false)} className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white disabled:opacity-40">Reject</button><button type="button" disabled={respondingInvite} onClick={() => void respondToIncomingInvite(true)} className="flex-1 rounded-2xl bg-[color:var(--primary)] py-3 text-sm font-black text-white disabled:opacity-50">{respondingInvite ? "Please wait…" : "Accept & Join Seat"}</button></div></div></div>}
    {seatPickerUser && <div className="fixed inset-0 z-[2147483005] flex items-center justify-center bg-black/65 px-4 " role="dialog" aria-modal="true" aria-labelledby="seat-picker-title"><div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-black/95 text-white shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><div><h2 id="seat-picker-title" className="text-sm font-black">Select Seat</h2><p className="mt-1 text-[10px] text-white/55">Invite {seatPickerUser.username} to a specific free seat.</p></div><button type="button" onClick={() => setSeatPickerUser(null)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4"/></button></div><div className="grid grid-cols-2 gap-2 p-4">{room.seats.map((seat) => { const seatNumber = seat.index ?? 0; const occupied = Boolean(seat.user?.id); const busy = invitingUserId === seatPickerUser.id; return <button key={seatNumber} type="button" disabled={occupied || busy || seatNumber < 2 || seatNumber > 20} onClick={() => void inviteToSeat(seatPickerUser.id, seatNumber)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40"><div className="text-xs font-black">Seat {seatNumber}</div><div className="mt-1 text-[9px] text-white/55">{occupied ? `Occupied · ${seat.user?.username ?? "User"}` : "Free · Invite here"}</div></button>; })}</div></div></div>}
    {membersOpen && <div className="fixed inset-0 z-[2147482990]" role="dialog" aria-modal="true" aria-label="Room members"><button type="button" className="absolute inset-0 h-full w-full bg-black/45 " aria-label="Close room members" onClick={() => setMembersOpen(false)} /><div className="absolute left-1/2 top-[calc(96px+env(safe-area-inset-top))] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/20 bg-black/90 text-white shadow-2xl "><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><div className="text-sm font-black">Room Members</div><div className="text-[10px] text-white/55">{onlineCount} online</div></div><button type="button" onClick={() => setMembersOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button></div><div className="border-b border-white/10 px-3 py-2"><div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Search className="h-3.5 w-3.5 text-white/50"/><input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search room users…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35" /></div></div><div className="max-h-[55dvh] overflow-y-auto p-2">{membersLoading ? <div className="px-3 py-8 text-center text-xs text-white/60"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin"/>Loading members…</div> : filteredMembers.length === 0 ? <div className="px-3 py-8 text-center text-xs text-white/60">No room users found.</div> : filteredMembers.map(member => { const seated = room.seats.some(seat => seat.user?.id === member.id); const pending = pendingInvites.has(member.id); const busy = invitingUserId === member.id; return <div key={member.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/10"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">{member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs font-black">{member.username.charAt(0).toUpperCase()}</div>}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate text-xs font-bold">{member.username}</span>{member.host && <span className="rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[7px] font-black">HOST</span>}{member.moderator && !member.host && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-black text-white/70">MOD</span>}</div><div className="mt-0.5 text-[9px] text-white/50">Level {member.level} · {seated ? "On seat" : "In room"}</div></div>{canInviteToSeat && !member.host && <button type="button" disabled={seated || busy} onClick={tap(() => setSeatPickerUser(member))} className="flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--primary)] px-2.5 py-1.5 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin"/> : seated ? "Seated" : pending ? <><UserPlus className="h-3 w-3"/>Invite Again</> : <><UserPlus className="h-3 w-3"/>Invite</>}</button>}</div>; })}</div></div></div>}
    {exitMenuOpen && <div className="fixed inset-0 z-[2147483000]" role="presentation">
      <button type="button" aria-label="Close room options" className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-[2px]" onClick={() => setExitMenuOpen(false)} tabIndex={-1} />
      <section className="absolute right-0 top-0 flex h-[100dvh] w-[150px] max-h-none flex-col overflow-hidden border-l border-white/15 bg-[#090b18]/[0.98] pb-[max(8px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-white shadow-[-8px_0_30px_rgba(0,0,0,.45)]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Exit room and top live rooms">
        
        <div className="grid shrink-0 grid-cols-1 gap-2 px-2 pb-3 pt-2">
          <button type="button" onClick={tap(exitRoom)} disabled={exiting} aria-label={exiting ? "Exiting room" : "Exit room"} title="Exit Room" className="group relative grid h-12 w-full place-items-center rounded-xl border border-rose-300/70 bg-gradient-to-b from-rose-400 via-rose-600 to-rose-900 text-white shadow-[0_4px_0_#4c0519,0_7px_12px_rgba(0,0,0,.45),inset_0_1px_2px_rgba(255,255,255,.5)] transition active:translate-y-[3px] active:shadow-[0_1px_0_#4c0519,0_3px_6px_rgba(0,0,0,.4)] disabled:opacity-50"><LogOut className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,.65)]"/></button>
          <button type="button" onClick={tap(minimizeRoom)} aria-label="Minimize room" title="Minimize" className="group relative grid h-12 w-full place-items-center rounded-xl border border-violet-300/70 bg-gradient-to-b from-violet-400 via-violet-600 to-violet-950 text-white shadow-[0_4px_0_#2e1065,0_7px_12px_rgba(0,0,0,.45),inset_0_1px_2px_rgba(255,255,255,.5)] transition active:translate-y-[3px] active:shadow-[0_1px_0_#2e1065,0_3px_6px_rgba(0,0,0,.4)]"><Minimize2 className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,.65)]"/></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {topRoomsLoading ? <div className="py-5 text-center text-xs text-white/60">Loading live rooms…</div> : topRooms.length === 0 ? <div className="py-5 text-center text-xs text-white/55">No other live voice rooms right now.</div> : <div className="flex flex-col gap-2">
            {topRooms.map((item, index) => <button key={item.id} type="button" onClick={() => { setExitMenuOpen(false); window.location.assign(`/room/${encodeURIComponent(item.id)}`); }} className="group relative aspect-square w-full shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#171a2c] text-left active:scale-[.98]" aria-label={`Join ${item.title}`}>
              {item.cover_url || item.host_avatar ? <img src={item.cover_url || item.host_avatar || ""} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"/> : <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-900/80 via-slate-900 to-fuchsia-900"><Users className="h-7 w-7 text-white/50"/></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/15 to-black/10"/>
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-black text-amber-200">#{index + 1}</span>
              <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-red-600/90 px-1.5 py-0.5 text-[8px] font-bold"><span className="h-1.5 w-1.5 rounded-full bg-white"/>LIVE</span>
              <span className="absolute inset-x-1.5 bottom-1.5 min-w-0"><span className="block truncate text-[10px] font-extrabold leading-tight">{item.title}</span><span className="mt-1 flex items-center gap-1 text-[9px] text-white/75"><Users className="h-3 w-3"/>{item.viewer_count.toLocaleString()}</span></span>
            </button>)}
          </div>}
        </div>
      </section>
    </div>}
    {hostEndConfirmOpen && <div className="fixed inset-0 z-[2147483002] flex items-center justify-center bg-black/70 px-5 " role="dialog" aria-modal="true" aria-labelledby="host-end-title" onClick={() => !exiting && setHostEndConfirmOpen(false)}><div className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-black/95 p-5 text-white shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="host-end-title" className="text-lg font-black">End Room?</h2><p className="mt-1 text-sm leading-5 text-white/65">End this room for everyone. This action cannot be undone.</p></div><button type="button" aria-label="Close" disabled={exiting} onClick={() => setHostEndConfirmOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 disabled:opacity-40"><X className="h-4 w-4" /></button></div><div className="flex gap-2"><button type="button" disabled={exiting} onClick={() => setHostEndConfirmOpen(false)} className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white disabled:opacity-40">Cancel</button><button type="button" disabled={exiting} onClick={confirmHostEnd} className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">{exiting ? "Ending…" : "Yes, End Room"}</button></div></div></div>}
    {hostExitConfirmOpen && <div className="fixed inset-0 z-[2147483001] flex items-center justify-center bg-black/70 px-5 " role="dialog" aria-modal="true" aria-labelledby="host-exit-title" onClick={() => !exiting && setHostExitConfirmOpen(false)}><div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/95 p-5 text-white shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="host-exit-title" className="text-lg font-black">Exit Room?</h2><p className="mt-1 text-sm leading-5 text-white/65">Leave the room temporarily. The room stays live and you can rejoin later; this does not end the room for everyone.</p></div><button type="button" aria-label="Close" disabled={exiting} onClick={() => setHostExitConfirmOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 disabled:opacity-40"><X className="h-4 w-4" /></button></div><div className="flex gap-2"><button type="button" disabled={exiting} onClick={() => setHostExitConfirmOpen(false)} className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white disabled:opacity-40">No</button><button type="button" disabled={exiting} onClick={confirmHostExit} className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">{exiting ? "Exiting…" : "Yes, Exit Room"}</button></div></div></div>}
    {currentEntrance ? <EntrancePlayer event={currentEntrance} onDone={finishEntrance} /> : null}
  </header>;
}
