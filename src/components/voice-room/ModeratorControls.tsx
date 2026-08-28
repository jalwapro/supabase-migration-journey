import { useEffect, useState } from "react";
import { Shield, Users, Mic, MicOff, UserX, Ban, MessageSquare, Trash2, Lock, Unlock, Flag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Member = { user_id: string; username: string | null; avatar: string | null; is_moderator: boolean; is_muted: boolean; seat_index: number | null };

type Props = { roomId: string; open: boolean; onClose: () => void; };

export function ModeratorControls({ roomId, open, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [seatPermission, setSeatPermission] = useState(false);
  const [lockedSeats, setLockedSeats] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const [{ data: room }, { data: rows }] = await Promise.all([
      supabase.from("live_rooms").select("host_id,moderator_can_manage_seats,locked_seats").eq("id", roomId).maybeSingle(),
      supabase.from("room_members").select("user_id,is_moderator,is_muted,seat_index").eq("room_id", roomId),
    ]);
    if (!room) return;
    const isMod = auth.user.id !== room.host_id && !!(rows ?? []).find(r => r.user_id === auth.user.id)?.is_moderator;
    if (!isMod) return;
    const ids = (rows ?? []).map(r => r.user_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,username,avatar").in("id", ids) : { data: [] };
    const map = new Map((profiles ?? []).map(p => [p.id, p]));
    setMembers((rows ?? []).map(r => ({ ...r, username: map.get(r.user_id)?.username ?? null, avatar: map.get(r.user_id)?.avatar ?? null })));
    setSeatPermission(!!room.moderator_can_manage_seats);
    setLockedSeats(room.locked_seats ?? []);
  };

  useEffect(() => {
    if (!open || !roomId) return;
    void load();
    const channel = supabase.channel(`moderator-controls-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, roomId]);

  const moderate = async (userId: string, action: "mute" | "unmute" | "kick" | "ban") => {
    if (busy) return;
    setBusy(`${action}:${userId}`);
    const { error } = await supabase.rpc("moderate_room_user", { _room_id: roomId, _target_user: userId, _action: action });
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success(action === "kick" ? "User kicked" : action === "ban" ? "User banned" : action === "mute" ? "User muted" : "User unmuted"); await load(); }
  };

  const report = async (userId: string) => {
    const reason = window.prompt("Report this user to the Host")?.trim();
    if (!reason) return;
    const { error } = await supabase.rpc("report_room_user_to_host", { _room_id: roomId, _reported_user: userId, _reason: reason, _details: null });
    if (error) toast.error(error.message); else toast.success("Report sent to Host");
  };

  const toggleSeat = async (index: number) => {
    const locked = lockedSeats.includes(index);
    setBusy(`seat:${index}`);
    const { data, error } = await supabase.rpc("toggle_seat_lock", { _room_id: roomId, _seat_index: index, _locked: !locked });
    setBusy(null);
    if (error) toast.error(error.message); else setLockedSeats(data ?? []);
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm" onClick={onClose}>
    <section className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/15 bg-[#100719] p-4 text-white shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-[color:var(--secondary)]"/><div><h2 className="text-base font-black">Moderator Controls</h2><p className="text-[9px] text-white/45">Limited room moderation</p></div></div><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4"/></button></div>
      <div className="mb-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white/5 p-3"><Users className="mb-1 h-4 w-4"/><div className="text-xs font-bold">Members</div><div className="text-[9px] text-white/45">View and moderate users</div></div><div className="rounded-2xl bg-white/5 p-3"><MessageSquare className="mb-1 h-4 w-4"/><div className="text-xs font-bold">Chat</div><div className="text-[9px] text-white/45">Remove inappropriate messages</div></div></div>
      <div className="space-y-2">{members.filter(m => !m.is_moderator).map(m => <div key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">{m.avatar ? <img src={m.avatar} alt="" className="h-9 w-9 rounded-full object-cover"/> : <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-bold">{(m.username ?? "U")[0]}</div>}<div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{m.username ?? "User"}</div><div className="text-[8px] text-white/40">{m.seat_index == null ? "Viewer" : `Seat ${m.seat_index + 1}`}</div></div><button disabled={busy === `mute:${m.user_id}`} onClick={() => void moderate(m.user_id, m.is_muted ? "unmute" : "mute")} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 disabled:opacity-40" title={m.is_muted ? "Unmute" : "Mute"}>{m.is_muted ? <Mic className="h-3.5 w-3.5"/> : <MicOff className="h-3.5 w-3.5"/>}</button><button disabled={busy === `kick:${m.user_id}`} onClick={() => void moderate(m.user_id, "kick")} className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/20 text-amber-200 disabled:opacity-40" title="Kick"><UserX className="h-3.5 w-3.5"/></button><button disabled={busy === `ban:${m.user_id}`} onClick={() => void moderate(m.user_id, "ban")} className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/20 text-red-200 disabled:opacity-40" title="Ban"><Ban className="h-3.5 w-3.5"/></button><button onClick={() => void report(m.user_id)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10" title="Report to Host"><Flag className="h-3.5 w-3.5"/></button></div>)}{members.filter(m => !m.is_moderator).length === 0 && <div className="py-6 text-center text-xs text-white/40">No normal users in the room.</div>}</div>
      {seatPermission && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3"><div className="mb-2 flex items-center gap-2"><Lock className="h-4 w-4"/><div><div className="text-xs font-bold">Seat Moderation</div><div className="text-[9px] text-white/40">Enabled by Host</div></div></div><div className="grid grid-cols-5 gap-1.5">{Array.from({ length: 19 }, (_, i) => i + 2).map(index => { const locked = lockedSeats.includes(index); return <button key={index} disabled={busy === `seat:${index}`} onClick={() => void toggleSeat(index)} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-white/10 text-[9px] font-bold disabled:opacity-40">{locked ? <Unlock className="h-3 w-3"/> : <Lock className="h-3 w-3"/>}{index}</button>; })}</div></div>}
      <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] text-white/40"><div className="rounded-xl bg-white/5 p-2">Host management: hidden</div><div className="rounded-xl bg-white/5 p-2">Financial controls: hidden</div><div className="rounded-xl bg-white/5 p-2">Host transfer: hidden</div><div className="rounded-xl bg-white/5 p-2">Room close: hidden</div></div>
    </section>
  </div>;
}
