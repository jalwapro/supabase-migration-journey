import { useMemo } from "react";
import { Crown, BadgeCheck, Mic, MicOff, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomParticipant } from "@/types/room";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function HostCard({ host, onTap }: { host: RoomParticipant; onTap?: () => void }) {
  const bars = useMemo(() => Array.from({ length: 26 }, (_, i) => i), []);
  const active = !host.is_muted;

  return (
    <button
      onClick={onTap}
      className="group relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-fuchsia-400/60 bg-gradient-to-b from-[#1a0a2e] via-[#2a0a3d] to-[#0d0616] p-2.5"
      aria-label={`Host ${host.username}`}
      style={{
        boxShadow: active
          ? "0 0 28px -6px rgba(232,60,220,0.6), inset 0 0 24px -14px rgba(232,60,220,0.5)"
          : "0 0 14px -8px rgba(139,92,246,0.4)",
      }}
    >
      <span className="pointer-events-none absolute inset-1.5 rounded-[16px] border border-cyan-300/30" />
      <span className="pointer-events-none absolute left-1 top-1 h-3.5 w-3.5 rounded-tl-[14px] border-l-2 border-t-2 border-cyan-300/80" />
      <span className="pointer-events-none absolute right-1 top-1 h-3.5 w-3.5 rounded-tr-[14px] border-r-2 border-t-2 border-cyan-300/80" />
      <span className="pointer-events-none absolute bottom-1 left-1 h-3.5 w-3.5 rounded-bl-[14px] border-b-2 border-l-2 border-fuchsia-300/80" />
      <span className="pointer-events-none absolute bottom-1 right-1 h-3.5 w-3.5 rounded-br-[14px] border-b-2 border-r-2 border-fuchsia-300/80" />

      <span className="relative z-10 rounded-full border border-fuchsia-300/60 bg-black/60 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[2.5px] text-fuchsia-200 shadow-[0_0_10px_-2px_rgba(232,60,220,0.8)]">
        Host
      </span>

      <span className="relative z-10 flex items-center justify-center">
        <span className={cn("absolute -inset-2 rounded-full border border-fuchsia-400/50", active && "animate-pulse")} />
        <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-[3px] ring-fuchsia-400/80 sm:h-[72px] sm:w-[72px]">
          {host.avatar ? (
            <img src={host.avatar} alt={host.username} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-600 to-violet-700 text-lg font-black text-white">
              {host.username[0]?.toUpperCase()}
            </span>
          )}
        </span>
        <span
          className={cn(
            "absolute -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black/60",
            active ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white" : "bg-white/15 text-white/60",
          )}
        >
          {active ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
        </span>
      </span>

      <span className="relative z-10 flex items-center gap-1 text-[13px] font-black tracking-wide text-white drop-shadow-[0_0_6px_rgba(232,60,220,0.6)]">
        {host.username}
        <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        {host.is_vip && <BadgeCheck className="h-3.5 w-3.5 fill-violet-400 text-black" />}
      </span>

      <span className="relative z-10 flex items-center gap-1 text-[11px] font-semibold text-pink-300">
        <Heart className="h-3 w-3 fill-current" />
        {formatCount(host.gift_score)}
      </span>

      <span className="relative z-10 flex h-4 w-full items-center justify-center gap-[2px] overflow-hidden px-2">
        {bars.map((i) => (
          <span
            key={i}
            className={cn(
              "w-[2px] rounded-full",
              active ? (i % 3 === 0 ? "bg-gradient-to-t from-cyan-400 to-cyan-200" : "bg-gradient-to-t from-fuchsia-500 to-violet-300") : "bg-white/15",
            )}
            style={
              active
                ? {
                    height: `${25 + Math.abs(Math.sin(i * 1.3)) * 75}%`,
                    animation: `hostWave 900ms ease-in-out ${(i % 7) * 90}ms infinite alternate`,
                  }
                : { height: "18%" }
            }
          />
        ))}
      </span>

      <style>{`
        @keyframes hostWave {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </button>
  );
}
