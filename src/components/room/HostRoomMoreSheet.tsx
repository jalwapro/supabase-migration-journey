import { Music, Settings, Users, Lock, UserPlus, Trophy, X, LayoutGrid, Minus, Plus, Megaphone, Share2, Shield, Flag, Gift, BarChart3, DoorOpen } from "lucide-react";

const MIN_SEATS = 4;
const MAX_SEATS = 20;

type Props = {
  open: boolean;
  onClose: () => void;
  seatCount: number;
  onSeats: (next: number) => void | Promise<void>;
  onMusic: () => void;
  onSettings: () => void;
  onInvite: () => void;
  onRanking: () => void;
  onMembers?: () => void;
  onAnnouncement?: () => void;
  onShare?: () => void;
  onModerators?: () => void;
  onReports?: () => void;
  onGiftActivity?: () => void;
  onStats?: () => void;
  onEndRoom?: () => void;
  onSeatManagement?: () => void;
};

const normalizeSeats = (value: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_SEATS;
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(numeric)));
};

export function HostRoomMoreSheet({ open, onClose, seatCount, onSeats, onMusic, onSettings, onInvite, onRanking, onMembers, onAnnouncement, onShare, onModerators, onReports, onGiftActivity, onStats, onEndRoom, onSeatManagement }: Props) {
  if (!open) return null;
  const selected = normalizeSeats(seatCount);
  const changeSeats = (delta: number) => { const next = normalizeSeats(selected + delta); if (next !== selected) void onSeats(next); };
  const setSeatsFromInput = (value: string) => { if (value === "") return; const next = normalizeSeats(Number(value)); if (next !== selected) void onSeats(next); };
  const card = "rounded-2xl border border-white/40 bg-black/15 shadow-[0_1px_10px_rgba(0,0,0,.28)]";
  const action = "flex items-center gap-3 rounded-2xl border border-white/45 bg-white/15 p-3 text-left text-white shadow-[0_1px_8px_rgba(0,0,0,.22)] active:scale-[.98] transition-transform";
  const run = (handler?: () => void) => { if (handler) handler(); };
  return (<>
    <button type="button" aria-label="Close host controls" className="fixed inset-0 z-[90] bg-black/50" onClick={onClose} />
    <section className="fixed bottom-0 left-1/2 z-[91] w-full max-w-[480px] max-h-[88vh] -translate-x-1/2 overflow-y-auto rounded-t-3xl border-t-2 border-[color:var(--secondary)] bg-[color:var(--primary)] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-white shadow-2xl">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[color:var(--secondary)]" />
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Host More</h2><p className="text-[11px] text-white/80">Complete room management</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-white/15" aria-label="Close host controls"><X className="h-4 w-4" /></button></div>
      <div className={`${card} mb-3 p-3`}><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-[color:var(--secondary)]" /><span className="text-sm font-bold">Room Seats</span></div><span className="text-xs text-white/80">{selected} total</span></div>
        <div className="flex items-center justify-between gap-3"><button type="button" aria-label="Decrease room seat count" disabled={selected <= MIN_SEATS} onClick={() => changeSeats(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/45 bg-white/15 disabled:opacity-30"><Minus className="h-5 w-5" /></button><label className="flex flex-col items-center gap-0.5"><span className="sr-only">Room seat count</span><input aria-label="Room seat count" type="number" inputMode="numeric" min={MIN_SEATS} max={MAX_SEATS} step={1} value={selected} onChange={event => setSeatsFromInput(event.target.value)} className="w-20 bg-transparent text-center text-2xl font-black tabular-nums text-white outline-none" /><span className="text-[9px] text-white/60">Choose 4–20 seats</span></label><button type="button" aria-label="Increase room seat count" disabled={selected >= MAX_SEATS} onClick={() => changeSeats(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/45 bg-white/15 disabled:opacity-30"><Plus className="h-5 w-5" /></button></div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-white/70"><span>Minimum: {MIN_SEATS}</span><span>•</span><span>Maximum: {MAX_SEATS}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => run(onMembers)} className={action}><Users className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Members</b><small className="text-[10px] text-white/75">Room members</small></span></button>
        <button type="button" onClick={onRanking} className={action}><Trophy className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Rankings</b><small className="text-[10px] text-white/75">Room / host / gifts</small></span></button>
        <button type="button" onClick={() => run(onAnnouncement)} className={action}><Megaphone className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Announcement</b><small className="text-[10px] text-white/75">Room announcement</small></span></button>
        <button type="button" onClick={() => run(onShare)} className={action}><Share2 className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Share Room</b><small className="text-[10px] text-white/75">Invite & share</small></span></button>
        <button type="button" onClick={onSettings} className={action}><Settings className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Room Settings</b><small className="text-[10px] text-white/75">Room controls</small></span></button>
        <button type="button" onClick={() => run(onModerators)} className={action}><Shield className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Moderators</b><small className="text-[10px] text-white/75">Manage moderators</small></span></button>
        <button type="button" onClick={() => run(onReports)} className={action}><Flag className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Reports</b><small className="text-[10px] text-white/75">Room reports</small></span></button>
        <button type="button" onClick={() => run(onGiftActivity)} className={action}><Gift className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Gift Activity</b><small className="text-[10px] text-white/75">Gift history</small></span></button>
        <button type="button" onClick={() => run(onStats)} className={action}><BarChart3 className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Room Stats</b><small className="text-[10px] text-white/75">Contribution stats</small></span></button>
        <button type="button" onClick={() => run(onSeatManagement)} className={`${action} col-span-2`}><LayoutGrid className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Seat Management</b><small className="text-[10px] text-white/75">Open, lock, unlock, invite or remove users</small></span></button>
        <button type="button" onClick={() => run(onEndRoom)} className={`${action} col-span-2 border-red-300/60 bg-red-500/20`}><DoorOpen className="h-5 w-5 text-red-200" /><span><b className="block text-xs">End Room</b><small className="text-[10px] text-white/75">End this room for everyone</small></span></button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/70"><Users className="h-3 w-3" /><Lock className="h-3 w-3" /> Host-only controls</div>
    </section>
  </>);
}