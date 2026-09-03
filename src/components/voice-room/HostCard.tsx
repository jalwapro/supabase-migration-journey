import { Crown, BadgeCheck, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

type HostCardData = {
  id: string;
  username: string;
  avatar: string | null;
  is_vip?: boolean;
  is_muted?: boolean;
  is_speaking?: boolean;
};

/** Compact circular Host card used inside Seat No.1 of the master 5-column room grid. */
export function HostCard({ host, onTap }: { host: HostCardData; onTap?: () => void }) {
  const active = host.is_muted !== true;
  const speaking = host.is_speaking === true && active;
  return (
    <button type="button" onClick={onTap}
      className={cn("relative h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-[#5a1c42] via-[#7a2a4f] to-[#28162e] touch-manipulation", speaking && "shadow-[0_0_22px_rgba(232,60,220,.75)]")}
      aria-label={`Host ${host.username}`}>
      <span className={cn("absolute inset-[6%] rounded-full border-2 border-[#f6d78a]/70", speaking && "animate-pulse")} />
      <span className="absolute left-[10%] top-[10%] z-10 grid h-[24%] w-[24%] place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[#5b2800] shadow"><Crown className="h-[62%] w-[62%] fill-current" /></span>
      <span className="absolute inset-[16%] overflow-hidden rounded-full border-[3px] border-[#d9a84a] bg-[#1b1020]">
        {host.avatar ? <img src={host.avatar} alt={host.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-600 to-violet-700 text-lg font-black text-white">{host.username[0]?.toUpperCase()}</span>}
      </span>
      {host.is_vip === true && <BadgeCheck className="absolute right-[9%] top-[10%] h-[22%] w-[22%] fill-cyan-400 text-white drop-shadow" />}
      <span className={cn("absolute bottom-[8%] right-[9%] z-10 grid h-[23%] w-[23%] place-items-center rounded-full border-2 border-[#2b1328] text-white", active ? "bg-emerald-500" : "bg-red-500")}>{active ? <Mic className="h-[55%] w-[55%]" /> : <MicOff className="h-[55%] w-[55%]" />}</span>
    </button>
  );
}
