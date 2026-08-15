import { Flag, Share2, Power, Trophy, Users, ChevronRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnouncementItem } from "./types";

interface RoomHeaderProps {
  roomName: string;
  roomId: string;
  onlineCount: number;
  onReport: () => void;
  onShare: () => void;
  onExit: () => void;
  onRanking: () => void;
  onOnline: () => void;
}

export function RoomHeader({
  roomName,
  roomId,
  onlineCount,
  onReport,
  onShare,
  onExit,
  onRanking,
  onOnline,
}: RoomHeaderProps) {
  return (
    <div className="flex flex-col gap-2 px-2.5 pt-2.5 sm:px-3">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[10px] font-black tracking-tight text-white shadow-[0_0_14px_-2px_rgba(232,60,220,0.7)]">
          LOGO
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-bold text-white sm:text-base">{roomName}</span>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 fill-sky-400"><path d="M10 0l2.2 1.6 2.7-.4 1 2.5 2.5 1-.4 2.7L20 10l-1.6 2.2.4 2.7-2.5 1-1 2.5-2.7-.4L10 20l-2.2-1.6-2.7.4-1-2.5-2.5-1 .4-2.7L0 10l1.6-2.2-.4-2.7 2.5-1 1-2.5 2.7.4z"/><path d="M8.5 13.7 5 10.2l1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z" fill="#0a0a0a"/></svg>
            <Heart className="ml-0.5 h-3 w-3 fill-pink-500 text-pink-500" />
          </div>
          <span className="text-[11px] text-white/45">ID: {roomId}</span>
        </div>

        <button
          onClick={onReport}
          className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Report room"
        >
          <Flag className="h-4 w-4" />
        </button>
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Share room"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          onClick={onExit}
          className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="Exit room"
        >
          <Power className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onRanking}
          className="flex flex-1 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/15"
        >
          <Trophy className="h-3.5 w-3.5" />
          No ranking yet
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        </button>
        <button
          onClick={onOnline}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
        >
          <Users className="h-3.5 w-3.5" />
          {onlineCount}
          <span className="text-white/40">Online</span>
        </button>
      </div>
    </div>
  );
}

const KIND_ICON: Record<string, string> = {
  gift: "🎁",
  enter: "➡️",
  leave: "⬅️",
  host: "👑",
  achievement: "🏆",
  system: "📣",
};

interface AnnouncementTickerProps {
  items: AnnouncementItem[];
}

export function AnnouncementTicker({ items }: AnnouncementTickerProps) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className="relative mx-2.5 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] py-1.5 sm:mx-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
      <div className="flex w-max animate-[ticker_22s_linear_infinite] items-center gap-6 whitespace-nowrap px-4 text-xs text-white/70">
        {loop.map((item, idx) => (
          <span key={`${item.id}-${idx}`} className="flex items-center gap-1.5">
            <span>{KIND_ICON[item.kind] ?? "📣"}</span>
            <span className={cn(item.kind === "gift" && "text-fuchsia-300", item.kind === "host" && "text-amber-300")}>
              {item.text}
            </span>
            <span className="text-white/20">|</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
