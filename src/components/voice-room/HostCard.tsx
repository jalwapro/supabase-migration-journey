import { Crown, BadgeCheck, Mic, MicOff, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HostInfo } from "./types";
import { formatCount } from "./types";

interface HostCardProps { host: HostInfo; onTap: () => void; }
const BARS = Array.from({ length: 32 }, (_, i) => i);

export function HostCard({ host, onTap }: HostCardProps) {
  const active = host.mic === "speaking" || host.mic === "on";
  return (
    <button data-host-card data-jalwa-live-component="voice.host" data-jalwa-live-instance="0" data-jalwa-live-source="HostCard" onClick={onTap} className="group relative flex h-full w-full flex-col items-center justify-between gap-1.5 rounded-[26px] border-2 border-fuchsia-400/60 bg-gradient-to-b from-[#1a0a2e] via-[#2a0a3d] to-[#0d0616] p-2.5 backdrop-blur-sm transition-transform active:scale-[0.98] sm:p-3" aria-label={`Host ${host.name}`} style={{ boxShadow: active ? "0 0 32px -6px rgba(232,60,220,0.6), 0 0 60px -20px rgba(56,189,248,0.45), inset 0 0 30px -14px rgba(232,60,220,0.5)" : "0 0 16px -8px rgba(139,92,246,0.4)" }}>
      <span className="pointer-events-none absolute inset-1.5 rounded-[20px] border border-cyan-300/30" />
      <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-tl-[18px] border-l-2 border-t-2 border-cyan-300/80" />
      <span className="pointer-events-none absolute right-1 top-1 h-4 w-4 rounded-tr-[18px] border-r-2 border-t-2 border-cyan-300/80" />
      <span className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 rounded-bl-[18px] border-b-2 border-l-2 border-fuchsia-300/80" />
      <span className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 rounded-br-[18px] border-b-2 border-r-2 border-fuchsia-300/80" />
      <span className="relative z-10 rounded-full border border-fuchsia-300/60 bg-black/60 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[3px] text-fuchsia-200 shadow-[0_0_10px_-2px_rgba(232,60,220,0.8)]">Host</span>
      <span className="relative z-10 flex items-center justify-center"><span className={cn("absolute -inset-2.5 rounded-full border border-fuchsia-400/50", active && "animate-pulse")} /><span className={cn("absolute -inset-5 rounded-full border border-cyan-400/25", active && "animate-[ping_2.6s_ease-in-out_infinite]")} /><span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full ring-[3px] ring-fuchsia-400/80 sm:h-[92px] sm:w-[92px]"><img src={host.avatarUrl} alt={host.name} className="h-full w-full object-cover" draggable={false} /></span><span className={cn("absolute -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black/60", active ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-[0_0_10px_-1px_rgba(232,60,220,0.9)]" : "bg-white/15 text-white/60")}>{active ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}</span></span>
      <span className="relative z-10 flex items-center gap-1 text-sm font-black tracking-wide text-white drop-shadow-[0_0_6px_rgba(232,60,220,0.6)] sm:text-base">{host.name}<Crown className="h-4 w-4 fill-amber-400 text-amber-400" />{host.verified && <BadgeCheck className="h-4 w-4 fill-violet-400 text-black" />}</span>
      <span className="relative z-10 flex items-center gap-1 text-xs font-semibold text-pink-300"><Heart className="h-3.5 w-3.5 fill-current" />{formatCount(host.popularity)}</span>
      <span data-waveform data-jalwa-live-component="voice.waveform" data-jalwa-live-source="HostCard" className="relative z-10 flex h-5 w-full items-center justify-center gap-[2px] overflow-hidden px-2">{BARS.map((i) => <span key={i} className={cn("w-[2px] rounded-full", active ? i % 3 === 0 ? "bg-gradient-to-t from-cyan-400 to-cyan-200" : "bg-gradient-to-t from-fuchsia-500 to-violet-300" : "bg-white/15")} style={active ? { height: `${30 + Math.abs(Math.sin(i * 1.3)) * 70}%`, animation: `voiceWave 900ms ease-in-out ${(i % 7) * 90}ms infinite alternate` } : { height: "20%" }} />)}</span>
      <style>{`@keyframes voiceWave { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>
    </button>
  );
}
