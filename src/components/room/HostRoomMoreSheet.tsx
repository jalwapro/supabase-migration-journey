import { Music, Settings, Users, Lock, Unlock, UserPlus, Trophy, X, Minus, Plus } from "lucide-react";

export function HostRoomMoreSheet({
  open,
  onClose,
  seatCount,
  minSeats = 2,
  maxSeats = 20,
  onSeats,
  onMusic,
  onSettings,
  onInvite,
  onRanking,
}: {
  open: boolean;
  onClose: () => void;
  seatCount: number;
  minSeats?: number;
  maxSeats?: number;
  onSeats: (next: number) => void | Promise<void>;
  onMusic: () => void;
  onSettings: () => void;
  onInvite: () => void;
  onRanking: () => void;
}) {
  if (!open) return null;
  const changeSeats = (delta: number) => {
    const next = Math.max(minSeats, Math.min(maxSeats, seatCount + delta));
    if (next !== seatCount) void onSeats(next);
  };
  return (
    <>
      <button type="button" aria-label="Close host controls" className="fixed inset-0 z-[90] bg-black/60" onClick={onClose} />
      <section className="fixed bottom-0 left-1/2 z-[91] w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-white/10 bg-[#100b18] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Host Controls</h2><p className="text-[11px] text-white/50">Manage your live voice room</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button></div>
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-fuchsia-400" /><span className="text-sm font-bold">Voice seats</span></div><span className="text-xs text-white/50">{seatCount} seats</span></div>
          <div className="flex items-center justify-between gap-3"><button type="button" disabled={seatCount <= minSeats} onClick={() => changeSeats(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/10 disabled:opacity-30"><Minus className="h-5 w-5" /></button><div className="text-2xl font-black">{seatCount}</div><button type="button" disabled={seatCount >= maxSeats} onClick={() => changeSeats(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/10 disabled:opacity-30"><Plus className="h-5 w-5" /></button></div>
          <p className="mt-2 text-[10px] text-white/40">Changes are saved to the live room and reflected in the seat grid.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onMusic} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><Music className="h-5 w-5 text-fuchsia-400" /><span><b className="block text-xs">Music</b><small className="text-[10px] text-white/45">Host music player</small></span></button>
          <button type="button" onClick={onSettings} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><Settings className="h-5 w-5 text-violet-400" /><span><b className="block text-xs">Room settings</b><small className="text-[10px] text-white/45">Room controls</small></span></button>
          <button type="button" onClick={onInvite} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><UserPlus className="h-5 w-5 text-cyan-400" /><span><b className="block text-xs">Invite</b><small className="text-[10px] text-white/45">Invite users</small></span></button>
          <button type="button" onClick={onRanking} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><Trophy className="h-5 w-5 text-amber-400" /><span><b className="block text-xs">Ranking</b><small className="text-[10px] text-white/45">Room ranking</small></span></button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/35"><Lock className="h-3 w-3" /> Host-only controls</div>
      </section>
    </>
  );
}
