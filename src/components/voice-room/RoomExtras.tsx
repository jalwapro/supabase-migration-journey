import { useState } from "react";
import { Rocket, Flame, Calendar, Megaphone, Home, Gift, Gamepad2, MessageCircle, User, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventBanner } from "./types";

interface SidePanelsProps {
  popularityPct: number;
  announcement: string;
  banners: EventBanner[];
}

export function SidePanels({ popularityPct, announcement, banners }: SidePanelsProps) {
  const [bannerIdx, setBannerIdx] = useState(0);

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-b from-[#1a0a2e] to-[#0d0616] p-3"
        style={{ boxShadow: "0 0 14px -6px rgba(232,60,220,0.5)" }}
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/90">
          <Rocket className="h-4 w-4 text-fuchsia-400" />
          Popularity
          <Flame className="ml-auto h-4 w-4 text-orange-400" />
        </div>
        <div className="rounded-full border border-fuchsia-400/30 bg-black/40 px-3 py-1 text-center text-[11px] font-black text-fuchsia-200">
          {popularityPct}%
        </div>
      </div>

      {banners.length > 0 && (
        <button
          onClick={() => setBannerIdx((i) => (i + 1) % banners.length)}
          className="relative overflow-hidden rounded-2xl border border-violet-400/40"
          style={{ boxShadow: "0 0 14px -6px rgba(139,92,246,0.5)" }}
        >
          {banners[bannerIdx].badge && (
            <span className="absolute right-2 top-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
              {banners[bannerIdx].badge}
            </span>
          )}
          <img
            src={banners[bannerIdx].imageUrl}
            alt=""
            className="h-24 w-full object-cover"
            style={{ background: "linear-gradient(135deg,#2d0b4d,#4a0e4e)" }}
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 py-2">
            <p className="text-[12px] font-black text-white">{banners[bannerIdx].title}</p>
          </div>
          {banners.length > 1 && (
            <div className="absolute bottom-1.5 right-2 flex gap-1">
              {banners.map((_, i) => (
                <span key={i} className={cn("h-1 w-1 rounded-full", i === bannerIdx ? "bg-fuchsia-400" : "bg-white/30")} />
              ))}
            </div>
          )}
        </button>
      )}

      <div className="rounded-2xl border border-violet-400/25 bg-white/[0.03] p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/85">
          <Calendar className="h-4 w-4 text-violet-400" />
          Events
        </div>
        <p className="text-[11px] text-white/45">No active events</p>
        <p className="text-[11px] text-white/30">Check back later</p>
      </div>

      <div className="rounded-2xl border border-amber-400/25 bg-white/[0.03] p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/85">
          <Megaphone className="h-4 w-4 text-amber-400" />
          Room Announcement
        </div>
        <p className="text-[11px] text-white/45">{announcement || "No announcement yet"}</p>
      </div>
    </div>
  );
}

interface BottomNavProps {
  micOn: boolean;
  onHome: () => void;
  onGifts: () => void;
  onGame: () => void;
  onMic: () => void;
  onChat: () => void;
  onProfile: () => void;
}

const OCTAGON = { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" } as const;

export function BottomNav({ micOn, onHome, onGifts, onGame, onMic, onChat, onProfile }: BottomNavProps) {
  const items: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <Home className="h-5 w-5" />, label: "Home", onClick: onHome },
    { icon: <Gift className="h-5 w-5" />, label: "Gifts", onClick: onGifts },
    { icon: <Gamepad2 className="h-5 w-5" />, label: "Game", onClick: onGame },
  ];
  const itemsRight: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <MessageCircle className="h-5 w-5" />, label: "Chat", onClick: onChat },
    { icon: <User className="h-5 w-5" />, label: "Profile", onClick: onProfile },
  ];

  return (
    <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-fuchsia-400/20 bg-black/80 px-3 py-2 backdrop-blur-md">
      {items.map((it) => (
        <NavButton key={it.label} {...it} />
      ))}

      <button
        onClick={onMic}
        style={OCTAGON}
        className={cn(
          "flex h-14 w-14 -translate-y-3 items-center justify-center border-2 transition-transform active:scale-90",
          micOn
            ? "border-fuchsia-400 bg-gradient-to-b from-fuchsia-500 to-violet-700 shadow-[0_0_22px_-2px_rgba(232,60,220,0.9)]"
            : "border-white/20 bg-white/10",
        )}
        aria-label="Toggle microphone"
      >
        {micOn ? <Mic className="h-6 w-6 text-white" /> : <MicOff className="h-6 w-6 text-white/60" />}
      </button>

      {itemsRight.map((it) => (
        <NavButton key={it.label} {...it} />
      ))}
    </div>
  );
}

function NavButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-2 py-1 text-white/60 transition-colors active:scale-90 hover:text-fuchsia-300"
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
