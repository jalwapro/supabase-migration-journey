import { useEffect, useState } from "react";
import { Crown, BadgeCheck, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type HostCardData = {
  id: string;
  username: string;
  avatar: string | null;
  avatar_frame_url?: string | null;
  frame_url?: string | null;
  is_vip?: boolean;
  is_muted?: boolean;
  is_speaking?: boolean;
};

/** Premium circular Host card used inside Seat No.1 of the room grid. */
export function HostCard({ host, onTap }: { host: HostCardData; onTap?: () => void }) {
  const active = host.is_muted !== true;
  const speaking = host.is_speaking === true && active;
  const [resolvedFrame, setResolvedFrame] = useState<string | null>(host.avatar_frame_url || host.frame_url || null);

  useEffect(() => {
    const direct = host.avatar_frame_url || host.frame_url;
    if (direct) { setResolvedFrame(direct); return; }
    let activeRequest = true;
    void supabase.from("profiles").select("frame").eq("id", host.id).maybeSingle().then(({ data }) => {
      if (activeRequest) setResolvedFrame((data as { frame?: string | null } | null)?.frame ?? null);
    });
    return () => { activeRequest = false; };
  }, [host.id, host.avatar_frame_url, host.frame_url]);

  return (
    <button type="button" onClick={onTap}
      className={cn("relative h-full w-full overflow-visible rounded-full bg-gradient-to-br from-[#5a1c42] via-[#7a2a4f] to-[#28162e] touch-manipulation", speaking && "shadow-[0_0_22px_rgba(232,60,220,.75)]")}
      aria-label={`Host ${host.username}`}>
      <span className={cn("absolute inset-[2%] rounded-full border-[2px] border-[#f6d78a]/70", speaking && "animate-pulse")} />
      <span className="absolute left-[4%] top-[4%] z-40 grid h-[25%] w-[25%] place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[#5b2800] shadow"><Crown className="h-[62%] w-[62%] fill-current" /></span>
      <span className="absolute inset-[4%] overflow-hidden rounded-full border-[3px] border-[#d9a84a] bg-[#1b1020] shadow-lg">
        {host.avatar ? <img src={host.avatar} alt={host.username} className="h-full w-full object-cover" draggable={false} /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-600 to-violet-700 text-xl font-black text-white">{host.username[0]?.toUpperCase()}</span>}
      </span>
      {resolvedFrame && <img src={resolvedFrame} alt="" className="pointer-events-none absolute -inset-[4%] z-30 h-[108%] w-[108%] object-contain drop-shadow-[0_0_8px_rgba(251,191,36,.55)]" draggable={false} />}
      {host.is_vip === true && <BadgeCheck className="absolute right-[5%] top-[5%] z-50 h-[22%] w-[22%] fill-cyan-400 text-white drop-shadow" />}
      <span className={cn("absolute bottom-[4%] right-[5%] z-50 grid h-[24%] w-[24%] items-center justify-center rounded-full border-2 border-[#2b1328] text-white shadow", active ? "bg-emerald-500" : "bg-red-500")}>{active ? <Mic className="h-[55%] w-[55%]" /> : <MicOff className="h-[55%] w-[55%]" />}</span>
    </button>
  );
}
