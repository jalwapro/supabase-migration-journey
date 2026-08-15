import { Flag, Share2, Power, Trophy, Users, ChevronRight, Heart, Home, Rocket } from "lucide-react";
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
  onHome: () => void;
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
  onHome,
}: RoomHeaderProps) {
  return (
    <div className="flex flex-col gap-2 px-2.5 pt-2.5 sm:px-3">
      <div
        className="flex items-center gap-2 rounded-2xl border border-fuchsia-400/50 bg-gradient-to-r from-[#170a26] via-[#1c0a2e] to-[#170a26] p-2 backdrop-blur-sm"
        style={{ boxShadow: "0 0 18px -6px rgba(232,60,220,0.5), inset 0 0 16px -10px rgba(56,189,248,0.4)" }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-300/60 bg-gradient-to-br from-fuchsia-500 to-violet-700 text-sm font-black italic tracking-tight text-white shadow-[0_0_16px_-2px_rgba(232,60,220,0.85)]">
          J
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-black text-white sm:text-base">{roomName}</span>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 fill-violet-400">
              <path d="M10 0l2.2 1.6 2.7-.4 1 2.5 2.5 1-.4 2.7L20 10l-1.6 2.2.4 2.7-2.5 1-1 2.5-2.7-.4L10 20l-2.2-1.6-2.7.4-1-2.5-2.5-1 .4-2.7L0 10l1.6-2.2-.4-2.7 2.5-1 1-2.5 2.7.4z" />
              <path d="M8.5 13.7 5 10.2l1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z" fill="#0a0114" />
            </svg>
          </div>
          <span className="text-[11px] font-medium text-white/45">ID: {roomId}</span>
        </div>

        {/* decorative winged heart, like the reference */}
        <svg viewBox="0 0 120 60" className="hidden h-7 w-14 shrink-0 opacity-90 sm:block" aria-hidden>
          <path
            d="M60 44c-16-10-26-18-26-28 0-7 5-12 12-12 6 0 10 3 14 8 4-5 8-8 14-8 7 0 12 5 12 12 0 10-10 18-26 28z"
            fill="none"
            stroke="url(#hg)"
            strokeWidth="2.5"
          />
          <path d="M26 20C14 16 4 18 0 24c6 2 14 2 20 0" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
          <path d="M94 20c12-4 22-2 26 4-6 2-14 2-20 0" fill="none" stroke="#e83cdc" strokeWidth="1.5" opacity="0.8" />
          <defs>
            <linearGradient id="hg" x1="0" x2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#e83cdc" />
            </linearGradient>
          </defs>
        </svg>

        <button
          onClick={onHome}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:flex"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
        </button>
        <button
          onClick={onReport}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Report room"
        >
          <Flag className="h-4 w-4" />
        </button>
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Share room"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          onClick={onExit}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-red-300 transition-colors hover:bg-red-500/20"
          aria-label="Exit room"
        >
          <Power className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onRanking}
          className="flex flex-1 items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-transparent px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-[0_0_10px_-4px_rgba(251,191,36,0.6)] transition-colors hover:bg-amber-500/20"
        >
          <Trophy className="h-3.5 w-3.5" />
          No ranking yet
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        </button>
        <button
          onClick={onOnline}
          className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-cyan-500/15"
        >
          <Users className="h-3.5 w-3.5" />
          {onlineCount}
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.9)]" />
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
    <div
      className="relative mx-2.5 flex items-center gap-2 overflow-hidden rounded-full border border-fuchsia-400/40 bg-gradient-to-r from-[#170a26] via-[#1c0a2e] to-[#170a26] py-1.5 pl-1 pr-3 sm:mx-3"
      style={{ boxShadow: "0 0 14px -6px rgba(232,60,220,0.5)" }}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[11px] shadow-[0_0_8px_-1px_rgba(232,60,220,0.8)]">
        📣
      </span>
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#170a26] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#170a26] to-transparent" />
        <div className="flex w-max animate-[ticker_22s_linear_infinite] items-center gap-6 whitespace-nowrap text-xs text-white/70">
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
      </div>
      <Rocket className="h-4 w-4 shrink-0 text-fuchsia-300" />
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
