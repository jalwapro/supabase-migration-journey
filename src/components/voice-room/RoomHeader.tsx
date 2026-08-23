import { Flag, Share2, Power, Trophy, Users, ChevronRight } from "lucide-react";
import type { RoomState } from "@/types/room";

interface RoomHeaderProps { room: RoomState; roomCode: string; onlineCount: number; topGifterName?: string | null; topGifterCoins?: number; onHostTap?: () => void; onReport: () => void; onShare: () => void; onExit: () => void; onHome: () => void; onRanking: () => void; }

export function RoomHeader({ room, roomCode, onlineCount, topGifterName, topGifterCoins, onHostTap, onReport, onShare, onExit, onHome, onRanking }: RoomHeaderProps) {
  const tap = (handler: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); handler(); };
  const hostName = room.host.username || "Host";
  const actionClass = "relative z-[62] grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.055] text-white/85 shadow-[inset_0_1px_rgba(255,255,255,.08)] touch-manipulation active:scale-95";
  return <header className="relative z-[60] flex shrink-0 flex-col px-2 pt-[calc(.2rem+env(safe-area-inset-top))] sm:px-2.5" style={{ pointerEvents: "auto" }}>
    <div className="relative z-[61] flex min-h-[50px] items-center gap-1.5">
      <button type="button" onClick={onHostTap ? tap(onHostTap) : tap(onHome)} className="relative z-[62] flex min-w-0 max-w-[58%] flex-1 items-center gap-1.5 rounded-[16px] border border-white/10 bg-[linear-gradient(135deg,rgba(27,45,76,.96),rgba(19,29,52,.96))] p-1.5 text-left shadow-[inset_0_1px_rgba(255,255,255,.06)] active:opacity-85" aria-label={`Open ${hostName} profile`}>
        {room.host.avatar ? <img src={room.host.avatar} alt="" className="h-9 w-9 shrink-0 rounded-[11px] border border-cyan-100/30 object-cover" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-cyan-100/30 bg-white/10 text-xs font-black">{hostName.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0"><div className="truncate text-[12px] font-bold text-white">{room.title}</div><div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/55"><span className="inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-500/20 text-[8px] text-amber-300">◆</span><span className="truncate">ID:{roomCode}</span></div></div>
      </button>
      <div className="flex-1" />
      <button type="button" onClick={tap(onReport)} className={actionClass} aria-label="Report room"><Flag className="h-4 w-4" /></button>
      <button type="button" onClick={tap(onShare)} className={actionClass} aria-label="Share room"><Share2 className="h-4 w-4" /></button>
      <button type="button" onClick={tap(onExit)} className={actionClass} aria-label="Exit room"><Power className="h-4 w-4" /></button>
    </div>
    <div className="relative z-[61] mt-0 flex min-h-[30px] items-center gap-1.5 border-b border-dashed border-orange-300/30">
      <button type="button" onClick={tap(onRanking)} className="relative z-[62] flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-amber-200 active:opacity-80"><Trophy className="h-4 w-4 shrink-0 text-amber-300"/><span className="truncate">{topGifterName ? `${topGifterName} · ${((topGifterCoins ?? 0) / 1000).toFixed(1)}k` : "No ranking yet"}</span><ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/35"/></button>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/25 bg-white/[.06] px-2 py-1 text-[10px] text-white/90"><Users className="h-3.5 w-3.5"/><span>{onlineCount}</span></div>
    </div>
  </header>;
}
