import { Rocket, Calendar, Megaphone, Home, Gift, Gamepad2, MessageCircle, Grid2x2, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidePanelsProps {
  popularityPct: number;
  announcement: string;
}

export function SidePanels({ popularityPct, announcement }: SidePanelsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/85">
          <Rocket className="h-4 w-4 text-fuchsia-400" />
          Room Popularity
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all"
              style={{ width: `${popularityPct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-white/60">{popularityPct}%</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/85">
          <Calendar className="h-4 w-4 text-violet-400" />
          Events
        </div>
        <p className="text-[11px] text-white/45">No active events</p>
        <p className="text-[11px] text-white/30">Check back later</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
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
  onMore: () => void;
}

export function BottomNav({ micOn, onHome, onGifts, onGame, onMic, onChat, onMore }: BottomNavProps) {
  const items: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <Home className="h-5 w-5" />, label: "Home", onClick: onHome },
    { icon: <Gift className="h-5 w-5" />, label: "Gifts", onClick: onGifts },
    { icon: <Gamepad2 className="h-5 w-5" />, label: "Game", onClick: onGame },
  ];
  const itemsRight: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <MessageCircle className="h-5 w-5" />, label: "Chat", onClick: onChat },
    { icon: <Grid2x2 className="h-5 w-5" />, label: "More", onClick: onMore },
  ];

  return (
    <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
      {items.map((it) => (
        <NavButton key={it.label} {...it} />
      ))}

      <button
        onClick={onMic}
        className={cn(
          "flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full border-2 transition-transform active:scale-90",
          micOn
            ? "border-fuchsia-400 bg-gradient-to-b from-fuchsia-500 to-violet-600 shadow-[0_0_20px_-2px_rgba(232,60,220,0.85)]"
            : "border-white/15 bg-white/10",
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
      className="flex flex-col items-center gap-0.5 px-2 py-1 text-white/60 transition-colors active:scale-90 hover:text-white"
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
