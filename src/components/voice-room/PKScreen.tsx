import { Swords, Timer, Zap, Trophy, Flame } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface PKScreenProps {
  match: any;
  score: { score_a: number; score_b: number };
  host: any;
  opponent: any;
  endsInSec: number | null;
  onEndMatch?: () => void;
  isHost: boolean;
}

export const PKScreen = ({ 
  match, 
  score, 
  host, 
  opponent, 
  endsInSec, 
  onEndMatch,
  isHost 
}: PKScreenProps) => {
  const scoreA = score?.score_a || 0;
  const scoreB = score?.score_b || 0;
  const total = scoreA + scoreB || 1;
  const pctA = Math.round((scoreA / total) * 100);
  const pctB = 100 - pctA;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full flex-col bg-black">
      {/* PK Header / Timer */}
      <div className="relative z-10 flex h-20 items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-6 py-2 backdrop-blur-md">
          <Timer className="h-4 w-4 text-fuchsia-400" />
          <span className="font-mono text-xl font-black tracking-widest text-white">
            {endsInSec !== null ? formatTime(endsInSec) : "00:00"}
          </span>
          <div className="h-4 w-[1px] bg-white/20" />
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
            <span className="text-xs font-bold text-white/70 uppercase">Battle</span>
          </div>
        </div>
      </div>

      {/* Main VS Area */}
      <div className="relative flex-1 px-2 pb-4">
        <div className="grid h-full grid-cols-2 gap-2">
          {/* Host Side */}
          <div className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-black">
            <div className="absolute inset-0 z-0 bg-blue-500/5 opacity-50" />
            
            {/* Host Content Placeholder - Actual video/audio handled by parent */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
               {host?.avatar ? (
                 <img src={host.avatar} alt="" className="h-32 w-32 rounded-full border-4 border-sky-400/50 object-cover shadow-[0_0_30px_rgba(56,189,248,0.3)]" />
               ) : (
                 <div className="h-32 w-32 rounded-full border-4 border-sky-400/50 bg-sky-900/30 flex items-center justify-center">
                    <span className="text-4xl font-bold text-sky-400">{(host?.username || "?")[0]}</span>
                 </div>
               )}
               <div className="mt-4 rounded-full bg-sky-500/20 px-4 py-1 border border-sky-400/30">
                 <span className="text-sm font-black text-sky-300">{host?.username || "Host"}</span>
               </div>
            </div>

            {/* Score Overlay */}
            <div className="absolute top-4 left-4 z-20">
               <div className="rounded-xl bg-sky-500 px-4 py-1 shadow-lg shadow-sky-500/40">
                 <span className="text-lg font-black text-white">{scoreA.toLocaleString()}</span>
               </div>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500" style={{ width: `${pctA}%` }} />
          </div>

          {/* Opponent Side */}
          <div className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-b from-rose-950/20 to-black">
            <div className="absolute inset-0 z-0 bg-rose-500/5 opacity-50" />
            
            {/* Opponent Content Placeholder */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
               {opponent?.avatar ? (
                 <img src={opponent.avatar} alt="" className="h-32 w-32 rounded-full border-4 border-rose-400/50 object-cover shadow-[0_0_30px_rgba(244,63,94,0.3)]" />
               ) : (
                 <div className="h-32 w-32 rounded-full border-4 border-rose-400/50 bg-rose-900/30 flex items-center justify-center">
                    <span className="text-4xl font-bold text-rose-400">{(opponent?.username || "?")[0]}</span>
                 </div>
               )}
               <div className="mt-4 rounded-full bg-rose-500/20 px-4 py-1 border border-rose-400/30">
                 <span className="text-sm font-black text-rose-300">{opponent?.username || "Opponent"}</span>
               </div>
            </div>

            {/* Score Overlay */}
            <div className="absolute top-4 right-4 z-20">
               <div className="rounded-xl bg-rose-500 px-4 py-1 shadow-lg shadow-rose-500/40">
                 <span className="text-lg font-black text-white">{scoreB.toLocaleString()}</span>
               </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" style={{ width: `${pctB}%` }} />
          </div>

          {/* VS Badge */}
          <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
             <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_40px_rgba(192,38,211,0.5)] outline outline-4 outline-black">
                <span className="text-2xl font-black italic text-white tracking-tighter">VS</span>
             </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="px-4 pb-6">
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500"
            style={{ width: `${pctA}%` }}
          />
          <div 
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-400 to-pink-500 transition-all duration-500"
            style={{ width: `${pctB}%` }}
          />
          
          {/* Center Indicator */}
          <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/40" />
        </div>
        <div className="mt-2 flex justify-between px-2">
           <div className="flex items-center gap-2">
              <Trophy className={cn("h-4 w-4", scoreA >= scoreB ? "text-yellow-400" : "text-white/20")} />
              <span className="text-xs font-black text-sky-400">LEADER</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-xs font-black text-rose-400">CHALLENGER</span>
              <Trophy className={cn("h-4 w-4", scoreB > scoreA ? "text-yellow-400" : "text-white/20")} />
           </div>
        </div>
      </div>
    </div>
  );
};
