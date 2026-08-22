import { Flag, Share2, Power, Trophy, Users, ChevronRight } from "lucide-react";
import type { RoomState } from "@/types/room";

interface RoomHeaderProps {
  room: RoomState;
  roomCode: string;
  onlineCount: number;
  topGifterName?: string | null;
  topGifterCoins?: number;
  onReport: () => void;
  onShare: () => void;
  onExit: () => void;
  onHome: () => void;
  onRanking: () => void;
}

export function RoomHeader({ room, roomCode, onlineCount, topGifterName, topGifterCoins, onReport, onShare, onExit, onHome, onRanking }: RoomHeaderProps) {
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  };

  return (
    <header className="relative z-[60] flex shrink-0 touch-manipulation flex-col gap-2 px-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] sm:px-3" style={{ pointerEvents: "auto" }}>
      <div className="relative z-[61] flex items-center gap-2 rounded-2xl border border-fuchsia-400/50 bg-gradient-to-r from-[#170a26] via-[#1c0a2e] to-[#170a26] p-2 backdrop-blur-sm" style={{ boxShadow: "0 0 18px -6px rgba(232,60,220,0.5), inset 0 0 16px -10px rgba(56,189,248,0.4)" }}>
        <button type="button" onClick={tap(onHome)} className="relative z-[62] flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-fuchsia-300/60 bg-gradient-to-br from-fuchsia-500 to-violet-700 text-sm font-black italic tracking-tight text-white shadow-[0_0_16px_-2px_rgba(232,60,220,0.85)] active:scale-95" aria-label="Home">J</button>
        <div className="min-w-0 flex-1 pointer-events-none"><div className="flex items-center gap-1"><span className="truncate text-sm font-black text-white sm:text-base">{room.title}</span><svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 fill-violet-400"><path d="M10 0l2.2 1.6 2.7-.4 1 2.5 2.5 1-.4 2.7L20 10l-1.6 2.2.4 2.7-2.5 1-1 2.5-2.7-.4L10 20l-2.2-1.6-2.7.4-1-2.5-2.5-1 .4-2.7L0 10l1.6-2.2-.4-2.7 2.5-1 1-2.5 2.7.4z"/><path d="M8.5 13.7 5 10.2l1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z" fill="#0a0114"/></svg></div><span className="text-[11px] font-medium text-white/45">ID: {roomCode}</span></div>
        <button type="button" onClick={tap(onReport)} className="relative z-[62] flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 active:scale-95" aria-label="Report room"><Flag className="h-4 w-4" /></button>
        <button type="button" onClick={tap(onShare)} className="relative z-[62] flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 active:scale-95" aria-label="Share room"><Share2 className="h-4 w-4" /></button>
        <button type="button" onClick={tap(onExit)} className="relative z-[62] flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 active:scale-95" aria-label="Exit room"><Power className="h-4 w-4" /></button>
      </div>
      <div className="relative z-[61] flex items-center justify-between gap-2">
        <button type="button" onClick={tap(onRanking)} className="relative z-[62] flex flex-1 touch-manipulation items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-transparent px-3 py-2 text-xs font-semibold text-amber-200 active:scale-[0.98]"><Trophy className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{topGifterName ? `${topGifterName} (${((topGifterCoins ?? 0) / 1000).toFixed(1)}k 💎)` : "No ranking yet"}</span><ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0"/></button>
        <div className="pointer-events-none flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-3 py-2 text-xs font-semibold text-white/80"><Users className="h-3.5 w-3.5"/>{onlineCount}<span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/><span className="text-white/40">Online</span></div>
      </div>
    </header>
  );
}
