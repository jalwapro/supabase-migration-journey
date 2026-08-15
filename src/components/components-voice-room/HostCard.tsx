import { Crown, BadgeCheck, Mic, MicOff, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HostInfo } from "./types";
import { formatCount } from "./types";

interface HostCardProps {
  host: HostInfo;
  onTap: () => void;
}

const BARS = Array.from({ length: 28 }, (_, i) => i);

export function HostCard({ host, onTap }: HostCardProps) {
  const active = host.mic === "speaking" || host.mic === "on";

  return (
    <button
      onClick={onTap}
      className="group relative flex h-full w-full flex-col items-center justify-between gap-2 rounded-3xl border border-fuchsia-400/25 bg-gradient-to-b from-fuchsia-950/40 via-violet-950/30 to-black/40 p-2.5 backdrop-blur-sm transition-transform active:scale-[0.98] sm:p-3"
      aria-label={`Host ${host.name}`}
    >
      {/* ambient glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-700",
          active ? "opacity-100" : "opacity-40",
        )}
        style={{
          boxShadow: active
            ? "0 0 30px -6px rgba(232,60,220,0.55), 0 0 60px -20px rgba(139,92,246,0.5)"
            : "0 0 14px -8px rgba(139,92,246,0.35)",
        }}
      />

      <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-fuchsia-200">
        Host
      </span>

      <span className="relative flex items-center justify-center">
        <span
          className={cn(
            "absolute -inset-2 rounded-full border border-fuchsia-400/40",
            active && "animate-pulse",
          )}
        />
        <span
          className={cn(
            "absolute -inset-4 rounded-full border border-violet-400/20",
            active && "animate-[ping_2.4s_ease-in-out_infinite]",
          )}
        />
        <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full ring-4 ring-fuchsia-400/60 sm:h-24 sm:w-24">
          <img src={host.avatarUrl} alt={host.name} className="h-full w-full object-cover" draggable={false} />
        </span>
        <span
          className={cn(
            "absolute -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black/60",
            active ? "bg-fuchsia-500 text-white" : "bg-white/15 text-white/60",
          )}
        >
          {active ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
        </span>
      </span>

      <span className="flex items-center gap-1 text-sm font-bold text-white sm:text-base">
        {host.name}
        <Crown className="h-4 w-4 fill-amber-400 text-amber-400" />
        {host.verified && <BadgeCheck className="h-4 w-4 fill-sky-400 text-black" />}
      </span>

      <span className="flex items-center gap-1 text-xs font-semibold text-pink-300">
        <Heart className="h-3.5 w-3.5 fill-current" />
        {formatCount(host.popularity)}
      </span>

      {/* audio waveform */}
      <span className="flex h-5 w-full items-center justify-center gap-[2px] overflow-hidden px-2">
        {BARS.map((i) => (
          <span
            key={i}
            className={cn(
              "w-[2px] rounded-full",
              active ? "bg-gradient-to-t from-fuchsia-500 to-violet-300" : "bg-white/15",
            )}
            style={
              active
                ? {
                    height: `${30 + Math.abs(Math.sin(i * 1.3)) * 70}%`,
                    animation: `voiceWave 900ms ease-in-out ${(i % 7) * 90}ms infinite alternate`,
                  }
                : { height: "20%" }
            }
          />
        ))}
      </span>

      <style>{`
        @keyframes voiceWave {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </button>
  );
}
