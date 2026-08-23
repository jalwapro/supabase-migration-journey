import { Flag, Share2, Power, Trophy, Users, ChevronRight, Pencil, ImagePlus, Minimize2, LogOut, X, Search, UserPlus, Loader2, Check } from "lucide-react";
import type { RoomState } from "@/types/room";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToUserFolder } from "@/lib/uploads";
import { useRoomEntrances } from "@/hooks/useRoomEntrances";
import { EntrancePlayer } from "@/components/room/EntrancePlayer";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RoomHeaderProps { room: RoomState; roomCode: string; onlineCount: number; topGifterName?: string | null; topGifterCoins?: number; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; isHost?: boolean; }

type RoomMemberPreview = { id: string; username: string; avatar: string | null; level: number; host?: boolean; moderator?: boolean };
type IncomingSeatInvite = { id: string; fromUser: string; inviterName: string; inviterAvatar: string | null; role: "Host" | "Moderator"; seatIndex: number | null };

export function RoomHeader({ room, roomCode, onlineCount, topGifterName, topGifterCoins, onHostTap, onReport, onShare, onExit, onHome, onRanking, isHost: isHostProp = false }: RoomHeaderProps) {
  const { user } = useAuth();
  const isHost = isHostProp || user?.id === room.host.id;
  const { current: currentEntrance, done: finishEntrance } = useRoomEntrances(room.id, user?.id ?? null);
  const [roomTitle, setRoomTitle] = useState(room.title);
  const [roomDp, setRoomDp] = useState<string | null>(room.host.avatar);
  const [exitMenuOpen, setExitMenuOpen] = useState(false);
  const [hostExitConfirmOpen, setHostExitConfirmOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<RoomMemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [pendingInvites, setPendingInvites] = useState<Set<string>>(new Set());
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<IncomingSeatInvite | null>(null);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [exiting, setExiting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setRoomTitle(room.title), [room.title]);
  useEffect(() => setRoomDp(room.host.avatar), [room.host.avatar]);
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); handler(); };
  const hostName = room.host.username || "Host";
  const actionClass = "relative z-[62] grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/80 bg-[color:var(--secondary)]/30 text-white shadow-[0_1px_8px_rgba(0,0,0,.35)] touch-manipulation active:scale-95";
  const hostProfileClick = () => onHostTap ? onHostTap() : onHome();
  const canInviteToSeat = isHost || user?.id === room.host.id;

  const showIncomingInvite = async (invite: { id: string; from_user: string; seat_index: number | null }) => {
    if (!user?.id || invite.from_user === user.id) return;
    const { data: inviter } = await supabase.from("profiles").select("username,avatar").eq("id", invite.from_user).maybeSingle();
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
    const loadPending = async () => {
      const { data } = await supabase.from("seat_invites").select("id,from_user,seat_index").eq("room_id", room.id).eq("to_user", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1);
      if (active && data?.[0]) await showIncomingInvite(data[0] as { id: string; from_user: string; seat_index: number | null });
    };
    void loadPending();
    const channel = supabase.channel(`voice-seat-invites-${room.id}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "seat_invites", filter: `room_id=eq.${room.id}` }, payload => {
        const row = payload.new as { id: string; from_user: string; to_user: string; seat_index: number | null; status: string };
        if (row.to_user === user.id && row.status === "pending") void showIncomingInvite(row);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seat_invites", filter: `room_id=eq.${room.id}` }, payload => {
        const row = payload.new as { id: string; to_user: string; status: string };
        if (row.to_user === user.id && row.id === incomingInvite?.id && row.status !== "pending") setIncomingInvite(null);
      });
    void channel.subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [room.id, user?.id]);

  const respondToIncomingInvite = async (accept: boolean) => {
    if (!incomingInvite || respondingInvite) return;
    setRespondingInvite(true);
    try {
      if (accept) {
        const { error } = await supabase.rpc("accept_seat_invite", { _invite_id: incomingInvite.id });
        if (error) throw error;
        toast.success("Seat invite accepted");
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
      if (room.host.id) { ids.add(room.host.id); seeded.push({ id: room.host.id, username: room.host.username || "Host", avatar: room.host.avatar, level: room.host.vip_level ?? 0, host: true }); }
      room.seats.forEach((seat) => { if (seat.user?.id && !ids.has(seat.user.id)) { ids.add(seat.user.id); seeded.push({ id: seat.user.id, username: seat.user.username || "User", avatar: seat.user.avatar, level: seat.user.vip_level ?? 0 }); } });
      const { data, error } = await supabase.from("room_members").select("user_id,is_moderator").eq("room_id", room.id).limit(100);
      if (error) throw error;
      const memberIds = (data ?? []).map((row: { user_id: string }) => row.user_id).filter(Boolean);
      memberIds.forEach(id => ids.add(id));
      const missingIds = memberIds.filter(id => !seeded.some(m => m.id === id));
      const moderators = new Set((data ?? []).filter((row: { is_moderator?: boolean }) => row.is_moderator).map((row: { user_id: string }) => row.user_id));
      seeded.forEach(m => { if (moderators.has(m.id)) m.moderator = true; });
      if (missingIds.length) {
        const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,avatar,vip_level").in("id", missingIds).limit(100);
        if (profileError) throw profileError;
        (profiles ?? []).forEach((p: { id: string; username: string | null; avatar: string | null; vip_level?: number | null }) => seeded.push({ id: p.id, username: p.username || "User", avatar: p.avatar, level: p.vip_level ?? 0, moderator: moderators.has(p.id) }));
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

  const inviteToSeat = async (memberId: string) => {
    if (!user?.id || !canInviteToSeat || invitingUserId) return;
    if (memberId === room.host.id) return;
    if (room.seats.some((seat) => seat.user?.id === memberId)) { toast.info("User is already on a seat"); return; }
    setInvitingUserId(memberId);
    try {
      const { error: cancelError } = await supabase.from("seat_invites").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("room_id", room.id).eq("to_user", memberId).eq("status", "pending");
      if (cancelError) throw cancelError;
      const { error } = await supabase.from("seat_invites").insert({ room_id: room.id, from_user: user.id, to_user: memberId, seat_index: null, status: "pending" });
      if (error) throw error;
      setPendingInvites(prev => { const next = new Set(prev); next.delete(memberId); return next; });
      const target = members.find(m => m.id === memberId);
      toast.success(`Seat invite sent again to ${target?.username ?? "user"}`);
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
  const openExitMenu = () => setExitMenuOpen(true);
  const minimizeRoom = () => { setExitMenuOpen(false); onHome(); };
  const performExit = async () => {
    if (exiting) return;
    setExiting(true);
    try { if (user?.id) { if (isHost) { const { error } = await supabase.rpc("end_room", { _room_id: room.id }); if (error) throw error; } else { const { error } = await supabase.from("room_members").delete().eq("room_id", room.id).eq("user_id", user.id); if (error) throw error; } } setHostExitConfirmOpen(false); setExitMenuOpen(false); window.location.assign("/"); }
    catch (e) { setExiting(false); toast.error(`Couldn't exit room: ${(e as Error).message || "Unknown error"}`); }
  };
  const exitRoom = () => { setExitMenuOpen(false); if (isHost) { setHostExitConfirmOpen(true); return; } void performExit(); };
  const confirmHostExit = () => { void performExit(); };
  const filteredMembers = members.filter(member => !memberSearch.trim() || member.username.toLowerCase().includes(memberSearch.trim().toLowerCase()));

  return <header className="relative z-[60] flex shrink-0 flex-col px-2 pt-[calc(.2rem+env(safe-area-inset-top))] sm:px-2.5" style={{ pointerEvents: "auto", backgroundColor: "var(--primary)" }}>
    <div className="relative z-[61] flex min-h-[56px] items-center gap-1.5">
      <div role="button" tabIndex={0} onClick={hostProfileClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") hostProfileClick(); }} className="relative z-[62] flex min-w-0 flex-1 items-center gap-2 rounded-[18px] border-2 border-[color:var(--secondary)]/75 bg-[color:var(--secondary)]/25 p-2 text-left shadow-[0_1px_10px_rgba(0,0,0,.35)] active:opacity-85" aria-label={`Open ${hostName} profile`}>
        {roomDp ? <img src={roomDp} alt="" className="h-11 w-11 shrink-0 rounded-[12px] border-2 border-[color:var(--secondary)] object-cover shadow-[0_1px_8px_rgba(0,0,0,.45)]" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border-2 border-[color:var(--secondary)] bg-black/15 text-sm font-black">{hostName.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><div className="truncate text-[14px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.95)]">{roomTitle}</div>{isHost && <button type="button" aria-label="Change room name" onClick={tap(saveRoomTitle)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[color:var(--secondary)]/80 bg-black/15 text-white"><Pencil className="h-3 w-3" /></button>}</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]"><span className="inline-grid h-4 w-4 place-items-center rounded-full border border-[color:var(--secondary)] bg-[color:var(--secondary)]/70 text-[9px] text-white">◆</span><span className="truncate">ID:{roomCode}</span></div></div>
        {isHost && <button type="button" aria-label="Change room DP" onClick={tap(() => fileRef.current?.click())} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color:var(--secondary)]/80 bg-black/15 text-white"><ImagePlus className="h-3.5 w-3.5" /></button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void saveRoomDp(f); }} />
      {!isHost && <button type="button" onClick={tap(onReport)} className={actionClass} aria-label="Report room"><Flag className="h-4 w-4" /></button>}
      <button type="button" onClick={tap(onShare)} className={actionClass} aria-label="Share room"><Share2 className="h-4 w-4" /></button>
      <button type="button" onClick={tap(openExitMenu)} className={actionClass} aria-label="Room exit options" aria-expanded={exitMenuOpen}><Power className="h-4 w-4" /></button>
    </div>
    <div className="relative z-[61] mt-0 flex min-h-[30px] items-center gap-1.5 border-b-2 border-[color:var(--secondary)]/80">
      <button type="button" onClick={tap(onRanking)} className="relative z-[62] flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)] active:opacity-80"><Trophy className="h-4 w-4 shrink-0 text-[color:var(--secondary)]"/><span className="truncate">{topGifterName ? `${topGifterName} · ${((topGifterCoins ?? 0) / 1000).toFixed(1)}k` : "No ranking yet"}</span><ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/90"/></button>
      <button type="button" onClick={tap(openMembers)} className="relative z-[62] flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--secondary)]/80 bg-[color:var(--secondary)]/25 px-2 py-1 text-[10px] text-white shadow-[0_1px_6px_rgba(0,0,0,.35)] touch-manipulation active:scale-95" aria-label={`Open ${onlineCount} room members`} aria-expanded={membersOpen}><Users className="h-3.5 w-3.5"/><span>{onlineCount}</span></button>
    </div>
    {incomingInvite && <div className="fixed inset-0 z-[2147483010] flex items-start justify-center bg-black/45 px-4 pt-[calc(92px+env(safe-area-inset-top))] backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="seat-invite-title"><div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-black/95 text-white shadow-2xl"><div className="flex items-center gap-3 border-b border-white/10 px-4 py-4"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10">{incomingInvite.inviterAvatar ? <img src={incomingInvite.inviterAvatar} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full w-full place-items-center text-sm font-black">{incomingInvite.inviterName.charAt(0).toUpperCase()}</div>}</div><div className="min-w-0 flex-1"><h2 id="seat-invite-title" className="text-sm font-black">Seat Invitation</h2><p className="mt-0.5 text-xs text-white/70"><span className="font-bold text-white">{incomingInvite.inviterName}</span> ({incomingInvite.role}) is inviting you to join a seat.</p></div><button type="button" disabled={respondingInvite} onClick={() => setIncomingInvite(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 disabled:opacity-40" aria-label="Close invite"><X className="h-4 w-4"/></button></div><div className="px-4 py-3 text-[10px] text-white/50">{incomingInvite.seatIndex != null ? `Seat ${incomingInvite.seatIndex + 1} is reserved for you.` : "A free seat will be assigned when you accept."}</div><div className="flex gap-2 px-4 pb-4"><button type="button" disabled={respondingInvite} onClick={() => void respondToIncomingInvite(false)} className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white disabled:opacity-40">Reject</button><button type="button" disabled={respondingInvite} onClick={() => void respondToIncomingInvite(true)} className="flex-1 rounded-2xl bg-[color:var(--primary)] py-3 text-sm font-black text-white disabled:opacity-50">{respondingInvite ? "Please wait…" : "Accept & Join Seat"}</button></div></div></div>}
    {membersOpen && <div className="fixed inset-0 z-[2147482990]" role="dialog" aria-modal="true" aria-label="Room members"><button type="button" className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-[1px]" aria-label="Close room members" onClick={() => setMembersOpen(false)} /><div className="absolute left-1/2 top-[calc(96px+env(safe-area-inset-top))] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/20 bg-black/90 text-white shadow-2xl backdrop-blur-xl"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><div className="text-sm font-black">Room Members</div><div className="text-[10px] text-white/55">{onlineCount} online</div></div><button type="button" onClick={() => setMembersOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button></div><div className="border-b border-white/10 px-3 py-2"><div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Search className="h-3.5 w-3.5 text-white/50"/><input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search room users…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35" /></div></div><div className="max-h-[55dvh] overflow-y-auto p-2">{membersLoading ? <div className="px-3 py-8 text-center text-xs text-white/60"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin"/>Loading members…</div> : filteredMembers.length === 0 ? <div className="px-3 py-8 text-center text-xs text-white/60">No room users found.</div> : filteredMembers.map(member => { const seated = room.seats.some(seat => seat.user?.id === member.id); const pending = pendingInvites.has(member.id); const busy = invitingUserId === member.id; return <div key={member.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/10"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">{member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs font-black">{member.username.charAt(0).toUpperCase()}</div>}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate text-xs font-bold">{member.username}</span>{member.host && <span className="rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[7px] font-black">HOST</span>}{member.moderator && !member.host && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-black text-white/70">MOD</span>}</div><div className="mt-0.5 text-[9px] text-white/50">Level {member.level} · {seated ? "On seat" : "In room"}</div></div>{canInviteToSeat && !member.host && <button type="button" disabled={seated || busy} onClick={tap(() => void inviteToSeat(member.id))} className="flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--primary)] px-2.5 py-1.5 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin"/> : seated ? "Seated" : pending ? <><UserPlus className="h-3 w-3"/>Invite Again</> : <><UserPlus className="h-3 w-3"/>Invite</>}</button>}</div>; })}</div></div></div>}
    {exitMenuOpen && <div className="fixed inset-0 z-[2147483000]" role="presentation"><button type="button" aria-label="Close room options" className="absolute inset-0 h-full w-full cursor-default bg-transparent" onClick={() => setExitMenuOpen(false)} tabIndex={-1} /><div className="absolute right-2 top-[calc(58px+env(safe-area-inset-top))] w-[190px] overflow-hidden rounded-2xl border border-white/30 bg-black/90 p-1.5 shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()} role="menu" aria-label="Room options"><button type="button" onClick={tap(minimizeRoom)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white hover:bg-white/10" role="menuitem"><Minimize2 className="h-4 w-4 text-white/80"/><span>Minimize Room</span></button><button type="button" onClick={tap(exitRoom)} disabled={exiting} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50" role="menuitem"><LogOut className="h-4 w-4"/><span>{exiting ? "Exiting…" : "Exit Room"}</span></button></div></div>}
    {hostExitConfirmOpen && <div className="fixed inset-0 z-[2147483001] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="host-exit-title" onClick={() => !exiting && setHostExitConfirmOpen(false)}><div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/95 p-5 text-white shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="host-exit-title" className="text-lg font-black">Exit Room?</h2><p className="mt-1 text-sm leading-5 text-white/65">Are you sure you want to exit this room?</p></div><button type="button" aria-label="Close" disabled={exiting} onClick={() => setHostExitConfirmOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 disabled:opacity-40"><X className="h-4 w-4"/></button></div><div className="flex gap-2"><button type="button" disabled={exiting} onClick={() => setHostExitConfirmOpen(false)} className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white disabled:opacity-40">No</button><button type="button" disabled={exiting} onClick={confirmHostExit} className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">{exiting ? "Exiting…" : "Yes, Exit Room"}</button></div></div></div>}
    {currentEntrance ? <EntrancePlayer event={currentEntrance} onDone={finishEntrance} /> : null}
  </header>;
}
