import { Music, Settings, Users, Lock, UserPlus, Trophy, X, LayoutGrid, Minus, Plus, Megaphone, Share2, Shield, Flag, Gift, BarChart3, DoorOpen } from "lucide-react";

const MIN_SEATS = 4;
const MAX_SEATS = 20;

type Props = {
  open: boolean; onClose: () => void; seatCount: number; onSeats: (next: number) => void | Promise<void>; onMusic: () => void; onSettings: () => void; onInvite: () => void; onRanking: () => void;
  onMembers?: () => void; onAnnouncement?: () => void; onShare?: () => void; onModerators?: () => void; onReports?: () => void; onGiftActivity?: () => void; onStats?: () => void; onEndRoom?: () => void; onSeatManagement?: () => void;
};
const normalizeSeats = (v: number) => Number.isFinite(Number(v)) ? Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(Number(v)))) : MIN_SEATS;
export function HostRoomMoreSheet({ open, onClose, seatCount, onSeats, onMusic, onSettings, onInvite, onRanking, onMembers, onAnnouncement, onShare, onModerators, onReports, onGiftActivity, onStats, onEndRoom, onSeatManagement }: Props) {
  if (!open) return null;
  const selected = normalizeSeats(seatCount);
  const change = (d: number) => { const n = normalizeSeats(selected + d); if (n !== selected) void onSeats(n); };
  const run = (fn?: () => void) => { if (fn) fn(); };
  const item = "flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 text-left text-white active:scale-[.98]";
  return <>
    <button type="button" aria-label="Close host more" className="fixed inset-0 z-[90] bg-black/45" onClick={onClose}/>
    <section className="fixed bottom-0 left-1/2 z-[91] w-[calc(100%-16px)] max-w-[430px] -translate-x-1/2 rounded-t-2xl border border-white/20 bg-[color:var(--primary)] p-3 pb-[calc(10px+env(safe-area-inset-bottom))] text-white shadow-2xl">
      <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-[color:var(--secondary)]"/>
      <div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Host More</h2><p className="text-[9px] text-white/65">Room management</p></div><button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10" aria-label="Close"><X className="h-3.5 w-3.5"/></button></div>
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5"><LayoutGrid className="h-4 w-4 text-[color:var(--secondary)]"/><span className="text-[10px] font-bold">Seats</span><button type="button" disabled={selected<=MIN_SEATS} onClick={()=>change(-1)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-white/10 disabled:opacity-30" aria-label="Decrease seats"><Minus className="h-3 w-3"/></button><span className="w-8 text-center text-sm font-black">{selected}</span><button type="button" disabled={selected>=MAX_SEATS} onClick={()=>change(1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 disabled:opacity-30" aria-label="Increase seats"><Plus className="h-3 w-3"/></button></div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={()=>run(onMembers)} className={item}><Users className="h-4 w-4"/><span className="text-[10px] font-bold">Members</span></button>
        <button type="button" onClick={onRanking} className={item}><Trophy className="h-4 w-4"/><span className="text-[10px] font-bold">Rankings</span></button>
        <button type="button" onClick={()=>run(onAnnouncement)} className={item}><Megaphone className="h-4 w-4"/><span className="text-[10px] font-bold">Announcement</span></button>
        <button type="button" onClick={()=>run(onShare)} className={item}><Share2 className="h-4 w-4"/><span className="text-[10px] font-bold">Share Room</span></button>
        <button type="button" onClick={onSettings} className={item}><Settings className="h-4 w-4"/><span className="text-[10px] font-bold">Room Settings</span></button>
        <button type="button" onClick={()=>run(onModerators)} className={item}><Shield className="h-4 w-4"/><span className="text-[10px] font-bold">Moderators</span></button>
        <button type="button" onClick={()=>run(onReports)} className={item}><Flag className="h-4 w-4"/><span className="text-[10px] font-bold">Reports</span></button>
        <button type="button" onClick={()=>run(onGiftActivity)} className={item}><Gift className="h-4 w-4"/><span className="text-[10px] font-bold">Gift Activity</span></button>
        <button type="button" onClick={()=>run(onStats)} className={item}><BarChart3 className="h-4 w-4"/><span className="text-[10px] font-bold">Room Stats</span></button>
        <button type="button" onClick={()=>run(onSeatManagement)} className={item}><LayoutGrid className="h-4 w-4"/><span className="text-[10px] font-bold">Seat Management</span></button>
        <button type="button" onClick={onMusic} className={item}><Music className="h-4 w-4"/><span className="text-[10px] font-bold">Music</span></button>
        <button type="button" onClick={onInvite} className={item}><UserPlus className="h-4 w-4"/><span className="text-[10px] font-bold">Invite</span></button>
        <button type="button" onClick={()=>run(onEndRoom)} className="col-span-2 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-[10px] font-bold text-white"><DoorOpen className="h-4 w-4"/>End Room</button>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1 text-[8px] text-white/50"><Lock className="h-2.5 w-2.5"/> Host-only controls</div>
    </section>
  </>;
}