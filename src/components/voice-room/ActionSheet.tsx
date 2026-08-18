import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Heart, Mic, MicOff, UserPlus, LogOut } from "lucide-react";
import type { SeatUser } from "./types";
import { formatCount } from "./types";

interface SeatActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatNumber: number | null;
  user: SeatUser | null;
  isMe: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onFollow: () => void;
  onOpenProfile: () => void;
}

/** Bottom sheet shown when tapping an empty or occupied seat. */
export function SeatActionSheet({ open, onOpenChange, seatNumber, user, isMe, onJoin, onLeave, onToggleMic, onFollow, onOpenProfile }: SeatActionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-[#0b0710] p-0 text-white" data-adaptive="neon" data-live-component="voice.seat-action-sheet" data-live-component-instance="0">
        <SheetHeader className="border-b border-white/10 px-4 py-3" data-live-component="voice.seat-action-sheet.header" data-live-component-instance="0">
          <SheetTitle className="text-sm text-white/85">
            {user ? `Seat ${seatNumber} · ${user.name}` : `Seat ${seatNumber} · Empty`}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1.5 p-3" data-live-component="voice.seat-action-sheet.actions" data-live-component-instance="0">
          {!user && <SheetAction icon={<UserPlus className="h-4 w-4" />} label="Join this seat" onClick={onJoin} />}
          {user && isMe && (
            <>
              <SheetAction icon={user.mic === "off" || user.mic === "muted" ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} label={user.mic === "off" || user.mic === "muted" ? "Turn mic on" : "Turn mic off"} onClick={onToggleMic} />
              <SheetAction icon={<LogOut className="h-4 w-4" />} label="Leave seat" onClick={onLeave} destructive />
            </>
          )}
          {user && !isMe && (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5" data-live-component="voice.seat-action-sheet.user-card" data-live-component-instance="0">
                <img src={user.avatarUrl} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="flex items-center gap-1 text-[11px] text-pink-300"><Heart className="h-3 w-3 fill-current" /> {formatCount(user.popularity)}</p></div>
              </div>
              <SheetAction icon={<UserPlus className="h-4 w-4" />} label="Follow" onClick={onFollow} />
              <SheetAction icon={<Heart className="h-4 w-4" />} label="View profile" onClick={onOpenProfile} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SheetAction({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return <button onClick={onClick} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/[0.06] ${destructive ? "text-red-400" : "text-white/85"}`}>{icon}{label}</button>;
}
