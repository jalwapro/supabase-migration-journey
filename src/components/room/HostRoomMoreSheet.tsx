import { Music, Settings, Users, Lock, UserPlus, Trophy, X, LayoutGrid, Minus, Plus, Megaphone, Share2, Shield, Flag, Gift, BarChart3, DoorOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MIN_SEATS = 4;
const MAX_SEATS = 20;

type Props = {
  open: boolean; onClose: () => void; seatCount: number; onSeats: (next: number) => void | Promise<void>; onMusic: () => void; onSettings: () => void; onInvite: () => void; onRanking: () => void;
  onMembers?: () => void; onAnnouncement?: () => void; onShare?: () => void; onModerators?: () => void; onReports?: () => void; onGiftActivity?: () => void; onStats?: () => void; onEndRoom?: () => void; onSeatManagement?: () => void;
};

type Member = { user_id: string; seat_index: number | null; is_moderator: boolean; is_muted: boolean; username: string | null; avatar: string | null };
type GiftRow = { id: string; sender_username: string | null; receiver_username: string | null; gift_name: string | null; gift_emoji: string | null; coins: number | null; created_at: string };

const normalizeSeats = (v: number) => Number.isFinite(Number(v)) ? Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(Number(v)))) : MIN_SEATS;
const roomIdFromUrl = () => typeof window === "undefined" ? null : window.location.pathname.match(/\/room\/([^/?#]+)/)?.[1] ?? null;

export function HostRoomMoreSheet({ open, onClose, seatCount, onSeats, onMusic, onSettings, onInvite, onRanking, onMembers, onAnnouncement, onShare, onModerators, onReports, onGiftActivity, onStats, onEndRoom, onSeatManagement }: Props) {
  const selected = normalizeSeats(seatCount);
  const roomId = roomIdFromUrl();
  const [panel, setPanel] = useState<"members" | "ranking" | "announcement" | "moderators" | "reports" | "gifts" | "stats" | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!open) setPanel(null);
  }, [open]);

  const loadMembers = async () => {
    if (!roomId) return;
    setLoading(true);
    const { data, error } = await supabase.from("room_members").select("user_id,seat_index,is_moderator,is_muted").eq("room_id", roomId).order("seat_index", { ascending: true, nullsFirst: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as Array<{ user_id: string; seat_index: number | null; is_moderator: boolean; is_muted: boolean }>;
    const ids = rows.map(r => r.user_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,username,avatar").in("id", ids) : { data: [] };
    const map = new Map(((profiles ?? []) as Array<{ id: string; username: string | null; avatar: string | null }>).map(p => [p.id, p]));
    setMembers(rows.map(r => ({ ...r, username: map.get(r.user_id)?.username ?? null, avatar: map.get(r.user_id)?.avatar ?? null })));
    setLoading(false);
  };

  const loadGifts = async () => {
    if (!roomId) return;
    setLoading(true);
    const { data, error } = await supabase.from("gift_sends").select("id,sender_username,receiver_username,gift_name,gift_emoji,coins,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50);
    if (error) { toast.error(error.message); setLoading(false); return; }
    setGifts((data ?? []) as GiftRow[]);
    setLoading(false);
  };

  const openPanel = async (next: NonNullable<typeof panel>) => {
    if (next === "members" || next === "moderators") await loadMembers();
    if (next === "gifts" || next === "stats" || next === "ranking") await loadGifts();
    setPanel(next);
  };

  const shareRoom = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "JALWA Voice Room", text: "Join my Voice Room", url });
      else { await navigator.clipboard.writeText(url); toast.success("Room link copied"); }
    } catch { /* user cancelled native share */ }
    onShare?.();
  };

  const publishAnnouncement = async () => {
    if (!roomId) return;
    const text = announcement.trim() || window.prompt("Room announcement")?.trim() || "";
    if (!text) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Sign in required"); return; }
    const { error } = await supabase.from("room_messages").insert({ room_id: roomId, user_id: auth.user.id, kind: "system", text, message: text, username: auth.user.user_metadata?.username ?? "Host" });
    if (error) toast.error(error.message); else { toast.success("Announcement sent"); setAnnouncement(""); setPanel(null); }
    onAnnouncement?.();
  };

  const submitReport = async () => {
    if (!roomId) return;
    const reason = window.prompt("Report this room")?.trim();
    if (!reason) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Sign in required"); return; }
    const { data: room } = await supabase.from("live_rooms").select("host_id").eq("id", roomId).maybeSingle();
    const { error } = await supabase.rpc("submit_user_report", { _reported_user: room?.host_id ?? null, _room_id: roomId, _reason: reason, _details: null });
    if (error) toast.error(error.message); else toast.success("Report submitted");
    onReports?.();
  };

  const toggleModerator = async (member: Member) => {
    if (!roomId) return;
    const { error } = await supabase.from("room_members").update({ is_moderator: !member.is_moderator }).eq("room_id", roomId).eq("user_id", member.user_id);
    if (error) toast.error(error.message); else { toast.success(member.is_moderator ? "Moderator removed" : "Moderator added"); await loadMembers(); }
    onModerators?.();
  };

  const endRoom = async () => {
    if (onEndRoom) { onEndRoom(); return; }
    if (!roomId) return;
    if (!window.confirm("End this room for everyone?")) return;
    const { error } = await supabase.rpc("end_room", { _room_id: roomId });
    if (error) toast.error(error.message); else { toast.success("Room ended"); onClose(); }
  };

  const stats = useMemo(() => {
    const total = gifts.reduce((sum, g) => sum + Number(g.coins ?? 0), 0);
    const senders = new Set(gifts.map(g => g.sender_username).filter(Boolean)).size;
    return { total, senders, gifts: gifts.length };
  }, [gifts]);

  if (!open) return null;
  const change = (d: number) => { const n = normalizeSeats(selected + d); if (n !== selected) void onSeats(n); };
  const item = "flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 text-left text-white active:scale-[.98]";

  return <>
    <button type="button" aria-label="Close host more" className="fixed inset-0 z-[90] bg-black/45" onClick={onClose}/>
    <section className="fixed bottom-0 left-1/2 z-[91] w-[calc(100%-16px)] max-w-[430px] max-h-[70vh] -translate-x-1/2 overflow-y-auto rounded-t-2xl border border-white/20 bg-[color:var(--primary)] p-3 pb-[calc(10px+env(safe-area-inset-bottom))] text-white shadow-2xl">
      <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-[color:var(--secondary)]"/>
      <div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Host More</h2><p className="text-[9px] text-white/65">Real room controls</p></div><button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10" aria-label="Close"><X className="h-3.5 w-3.5"/></button></div>
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5"><LayoutGrid className="h-4 w-4 text-[color:var(--secondary)]"/><span className="text-[10px] font-bold">Seats</span><button type="button" disabled={selected<=MIN_SEATS} onClick={()=>change(-1)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-white/10 disabled:opacity-30" aria-label="Decrease seats"><Minus className="h-3 w-3"/></button><span className="w-8 text-center text-sm font-black">{selected}</span><button type="button" disabled={selected>=MAX_SEATS} onClick={()=>change(1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 disabled:opacity-30" aria-label="Increase seats"><Plus className="h-3 w-3"/></button></div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={()=>onMembers ? (onClose(), onMembers()) : void openPanel("members")} className={item}><Users className="h-4 w-4"/><span className="text-[10px] font-bold">Members</span></button>
        <button type="button" onClick={()=>onRanking ? (onClose(), onRanking()) : void openPanel("ranking")} className={item}><Trophy className="h-4 w-4"/><span className="text-[10px] font-bold">Rankings</span></button>
        <button type="button" onClick={()=>void openPanel("announcement")} className={item}><Megaphone className="h-4 w-4"/><span className="text-[10px] font-bold">Announcement</span></button>
        <button type="button" onClick={()=>void shareRoom()} className={item}><Share2 className="h-4 w-4"/><span className="text-[10px] font-bold">Share Room</span></button>
        <button type="button" onClick={()=>{onClose();onSettings();}} className={item}><Settings className="h-4 w-4"/><span className="text-[10px] font-bold">Room Settings</span></button>
        <button type="button" onClick={()=>void openPanel("moderators")} className={item}><Shield className="h-4 w-4"/><span className="text-[10px] font-bold">Moderators</span></button>
        <button type="button" onClick={()=>void submitReport()} className={item}><Flag className="h-4 w-4"/><span className="text-[10px] font-bold">Reports</span></button>
        <button type="button" onClick={()=>void openPanel("gifts")} className={item}><Gift className="h-4 w-4"/><span className="text-[10px] font-bold">Gift Activity</span></button>
        <button type="button" onClick={()=>void openPanel("stats")} className={item}><BarChart3 className="h-4 w-4"/><span className="text-[10px] font-bold">Room Stats</span></button>
        <button type="button" onClick={()=>onSeatManagement ? (onClose(), onSeatManagement()) : toast.info("Use the seat controls above to change capacity") } className={item}><LayoutGrid className="h-4 w-4"/><span className="text-[10px] font-bold">Seat Management</span></button>
        <button type="button" onClick={()=>{onClose();onMusic();}} className={item}><Music className="h-4 w-4"/><span className="text-[10px] font-bold">Music</span></button>
        <button type="button" onClick={()=>{onClose();onInvite();}} className={item}><UserPlus className="h-4 w-4"/><span className="text-[10px] font-bold">Invite</span></button>
        <button type="button" onClick={()=>void endRoom()} className="col-span-2 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-[10px] font-bold text-white"><DoorOpen className="h-4 w-4"/>End Room</button>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1 text-[8px] text-white/50"><Lock className="h-2.5 w-2.5"/> Host-only controls</div>
    </section>

    {panel && <div className="fixed inset-0 z-[100] grid place-items-end bg-black/60" onClick={()=>setPanel(null)}><div className="w-[calc(100%-16px)] max-w-[430px] max-h-[58vh] overflow-y-auto rounded-t-2xl border border-white/20 bg-[#17082a] p-3 pb-[calc(12px+env(safe-area-inset-bottom))] text-white" onClick={e=>e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between"><b className="text-sm">{panel === "members" ? "Members" : panel === "ranking" ? "Rankings" : panel === "announcement" ? "Announcement" : panel === "moderators" ? "Moderators" : panel === "gifts" ? "Gift Activity" : panel === "stats" ? "Room Stats" : "Reports"}</b><button onClick={()=>setPanel(null)} className="grid h-7 w-7 place-items-center rounded-full bg-white/10"><X className="h-3.5 w-3.5"/></button></div>
      {loading && <p className="py-4 text-center text-xs text-white/60">Loading…</p>}
      {panel === "members" || panel === "moderators" ? <div className="space-y-1.5">{members.map(m=><div key={m.user_id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">{m.avatar ? <img src={m.avatar} alt="" className="h-8 w-8 rounded-full object-cover"/> : <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold">{(m.username ?? "U")[0]}</div>}<div className="min-w-0 flex-1"><b className="block truncate text-[11px]">{m.username ?? "User"}</b><span className="text-[9px] text-white/50">{m.seat_index == null ? "Viewer" : `Seat ${m.seat_index + 1}`}{m.is_moderator ? " · Moderator" : ""}</span></div>{panel === "moderators" && <button onClick={()=>void toggleModerator(m)} className="rounded-lg bg-white/10 px-2 py-1 text-[9px] font-bold">{m.is_moderator ? "Remove" : "Make"}</button>}</div>)}{!loading && members.length===0 && <p className="py-4 text-center text-xs text-white/50">No members.</p>}</div> : null}
      {panel === "announcement" && <div><textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)} placeholder="Write room announcement…" className="min-h-24 w-full rounded-xl border border-white/10 bg-white/5 p-2 text-xs outline-none"/><button onClick={()=>void publishAnnouncement()} className="mt-2 w-full rounded-xl bg-[color:var(--secondary)] py-2.5 text-xs font-black">Publish Announcement</button></div>}
      {panel === "gifts" && <div className="space-y-1.5">{gifts.map(g=><div key={g.id} className="rounded-xl bg-white/5 p-2 text-[10px]"><b>{g.gift_emoji ?? "🎁"} {g.gift_name ?? "Gift"}</b><div className="text-white/60">{g.sender_username ?? "User"} → {g.receiver_username ?? "User"} · {Number(g.coins ?? 0).toLocaleString()} coins</div></div>)}{!loading && gifts.length===0 && <p className="py-4 text-center text-xs text-white/50">No gifts yet.</p>}</div>}
      {panel === "stats" && <div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/5 p-3 text-center"><b className="block text-sm">{stats.gifts}</b><span className="text-[9px] text-white/50">Gifts</span></div><div className="rounded-xl bg-white/5 p-3 text-center"><b className="block text-sm">{stats.total.toLocaleString()}</b><span className="text-[9px] text-white/50">Coins</span></div><div className="rounded-xl bg-white/5 p-3 text-center"><b className="block text-sm">{stats.senders}</b><span className="text-[9px] text-white/50">Gifters</span></div></div>}
      {panel === "ranking" && <div className="space-y-1.5">{Array.from(gifts.reduce((m,g)=>{const k=g.sender_username ?? "User";m.set(k,(m.get(k)??0)+Number(g.coins??0));return m;},new Map<string,number>()).entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,coins],i)=><div key={name} className="flex items-center justify-between rounded-xl bg-white/5 p-2 text-[10px]"><span>#{i+1} {name}</span><b>{coins.toLocaleString()} coins</b></div>)}</div>}
    </div></div>}
  </>;
}