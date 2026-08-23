import { Music, Settings, Users, Lock, UserPlus, Trophy, X, LayoutGrid, Minus, Plus, Pencil, ImagePlus } from "lucide-react";

const MIN_SEATS = 4;
const MAX_SEATS = 20;
const normalizeSeats = (value: number) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.floor(Number(value)) || MIN_SEATS));

export function HostRoomMoreSheet({
  open,
  onClose,
  seatCount,
  onSeats,
  onMusic,
  onSettings,
  onInvite,
  onRanking,
}: {
  open: boolean;
  onClose: () => void;
  seatCount: number;
  onSeats: (next: number) => void | Promise<void>;
  onMusic: () => void;
  onSettings: () => void;
  onInvite: () => void;
  onRanking: () => void;
}) {
  if (!open) return null;
  const selected = normalizeSeats(seatCount);
  const changeSeats = (delta: number) => {
    const next = normalizeSeats(selected + delta);
    if (next !== selected) void onSeats(next);
  };
  const card = "rounded-2xl border border-white/40 bg-black/15 shadow-[0_1px_10px_rgba(0,0,0,.28)]";
  const action = "flex items-center gap-3 rounded-2xl border border-white/45 bg-white/15 p-3 text-left text-white shadow-[0_1px_8px_rgba(0,0,0,.22)] active:scale-[.98] transition-transform";
  return (
    <>
      <button type="button" aria-label="Close host controls" className="fixed inset-0 z-[90] bg-black/50" onClick={onClose} />
      <section className="fixed bottom-0 left-1/2 z-[91] w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t-2 border-[color:var(--secondary)] bg-[color:var(--primary)] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[color:var(--secondary)]" />
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold drop-shadow-[0_1px_3px_rgba(0,0,0,.8)]">Host Controls</h2><p className="text-[11px] text-white/80">Manage your live voice room</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-white/15"><X className="h-4 w-4" /></button></div>
        <div className={`${card} mb-3 p-3`}>
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-[color:var(--secondary)]" /><span className="text-sm font-bold">Room Seats</span></div><span className="text-xs text-white/80">{selected} total</span></div>
          <div className="flex items-center justify-between gap-3"><button type="button" aria-label="Decrease room seats" disabled={selected <= MIN_SEATS} onClick={() => changeSeats(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/45 bg-white/15 disabled:opacity-30"><Minus className="h-5 w-5" /></button><div className="text-2xl font-black tabular-nums">{selected}</div><button type="button" aria-label="Increase room seats" disabled={selected >= MAX_SEATS} onClick={() => changeSeats(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/45 bg-white/15 disabled:opacity-30"><Plus className="h-5 w-5" /></button></div>
          <div className="mt-2 grid grid-cols-5 gap-1"><span className="text-center text-[9px] text-white/65">4</span><span className="text-center text-[9px] text-white/65">8</span><span className="text-center text-[9px] text-white/65">12</span><span className="text-center text-[9px] text-white/65">16</span><span className="text-center text-[9px] text-white/65">20</span></div>
          <p className="mt-2 text-[10px] text-white/70">Host may choose any whole-number capacity from 4 to 20. Seat 1 is always the host.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onMusic} className={action}><Music className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Music</b><small className="text-[10px] text-white/75">Host music player</small></span></button>
          <button type="button" onClick={onSettings} className={action}><Settings className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Room settings</b><small className="text-[10px] text-white/75">Room controls</small></span></button>
          <button type="button" onClick={onInvite} className={action}><UserPlus className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Invite</b><small className="text-[10px] text-white/75">Invite users</small></span></button>
          <button type="button" onClick={onRanking} className={action}><Trophy className="h-5 w-5 text-[color:var(--secondary)]" /><span><b className="block text-xs">Ranking</b><small className="text-[10px] text-white/75">Room ranking</small></span></button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/70"><Users className="h-3 w-3" /><Lock className="h-3 w-3" /> Host-only controls</div>
      </section>
    </>
  );
}
