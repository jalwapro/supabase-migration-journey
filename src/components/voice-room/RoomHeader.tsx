import { Flag, Share2, Power, Trophy, Users, ChevronRight } from "lucide-react";
import type { RoomState } from "@/types/room";

interface RoomHeaderProps { room: RoomState; roomCode: string; onlineCount: number; topGifterName?: string | null; topGifterCoins?: number; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; }

export function RoomHeader({ room, roomCode, onlineCount, topGifterName, topGifterCoins, onHostTap, onReport, onShare, onExit, onHome, onRanking }: RoomHeaderProps) {
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); handler(); };
  const hostName = room.host.username || "Host";
  const actionClass = "relative z-[62] grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/55 bg-white/10 text-white shadow-[0_1px_8px_rgba(0,0,0,.25)] touch-manipulation active:scale-95";
  return <header className="relative z-[60] flex shrink-0 flex-col px-2 pt-[calc(.2rem+env(safe-area-inset-top))] sm:px-2.5" style={{ pointerEvents: "auto" }}>
    <div className="relative z-[61] flex min-h-[56px] items-center gap-1.5">
      <button type="button" onClick={onHostTap ? tap(onHostTap) : tap(onHome)} className="relative z-[62] flex min-w-0 flex-1 items-center gap-2 rounded-[18px] border border-white/55 bg-white/10 p-2 text-left shadow-[0_1px_8px_rgba(0,0,0,.25)] active:opacity-85" aria-label={`Open ${hostName} profile`}>
        {room.host.avatar ? <img src={room.host.avatar} alt="" className="h-11 w-11 shrink-0 rounded-[12px] border border-white/65 object-cover shadow-[0_1px_6px_rgba(0,0,0,.35)]" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-white/65 bg-white/15 text-sm font-black">{hostName.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">{room.title}</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/75 drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]"><span className="inline-grid h-4 w-4 place-items-center rounded-full border border-white/30 bg-amber-500/30 text-[9px] text-amber-200">◆</span><span className="truncate">ID:{roomCode}</span></div></div>
      </button>
      <button type="button" onClick={tap(onReport)} className={actionClass} aria-label="Report room"><Flag className="h-4 w-4" /></button>
      <button type="button" onClick={tap(onShare)} className={actionClass} aria-label="Share room"><Share2 className="h-4 w-4" /></button>
      <button type="button" onClick={tap(onExit)} className={actionClass} aria-label="Exit room"><Power className="h-4 w-4" /></button>
    </div>
    <div className="relative z-[61] mt-0 flex min-h-[30px] items-center gap-1.5 border-b border-dashed border-white/55">
      <button type="button" onClick={tap(onRanking)} className="relative z-[62] flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-amber-200 drop-shadow-[0_1px_3px_rgba(0,0,0,.9)] active:opacity-80"><Trophy className="h-4 w-4 shrink-0 text-amber-300"/><span className="truncate">{topGifterName ? `${topGifterName} · ${((topGifterCoins ?? 0) / 1000).toFixed(1)}k` : "No ranking yet"}</span><ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/70"/></button>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/55 bg-white/10 px-2 py-1 text-[10px] text-white shadow-[0_1px_6px_rgba(0,0,0,.25)]"><Users className="h-3.5 w-3.5"/><span>{onlineCount}</span></div>
    </div>
  </header>;
}
