import React, { useEffect, useState } from "react";
import { Heart, Sparkles, Crown, Flame } from "lucide-react";

export interface StageCouplePartner {
  seatIndex: number;
  userId: string;
  username: string;
  avatar: string | null;
  cpLevel: number;
}

export interface CpStageConnectionOverlayProps {
  couple: {
    partnerA: StageCouplePartner;
    partnerB: StageCouplePartner;
    intimacyScore?: number;
    daysTogether?: number;
  } | null;
  /** Grid capacity (typically 4, 8, 10, 15, or 20) */
  capacity?: number;
}

/**
 * World-Class Stage Link Overlay for Voice Room.
 * When a CP couple is seated on mic stage:
 * - If adjacent: Creates a shared "Royal Couple Sofa" golden bracket with twin wings.
 * - If separated: Draws a glowing neon romantic laser beam with traveling hearts between the seats.
 * - Interactive heart tap sends a flying kiss across the seats.
 */
export const CpStageConnectionOverlay: React.FC<CpStageConnectionOverlayProps> = ({
  couple,
  capacity = 10,
}) => {
  const [kissActive, setKissActive] = useState(false);

  if (!couple) return null;

  const { partnerA, partnerB, intimacyScore = 0, daysTogether = 1 } = couple;

  // Compute seat grid coordinates (grid is 5 columns)
  const getCoordinates = (seatIdx: number) => {
    // 5-column grid: column = (seatIdx - 1) % 5, row = Math.floor((seatIdx - 1) / 5)
    const col = (seatIdx - 1) % 5;
    const row = Math.floor((seatIdx - 1) / 5);
    // Approximate centers in percentages
    const x = col * 20 + 10; // 10%, 30%, 50%, 70%, 90%
    const y = row * 84 + 34; // approximate Y in pixels
    return { x, y, row, col };
  };

  const posA = getCoordinates(partnerA.seatIndex);
  const posB = getCoordinates(partnerB.seatIndex);

  const isAdjacent = posA.row === posB.row && Math.abs(posA.col - posB.col) === 1;
  const avgLevel = Math.max(partnerA.cpLevel, partnerB.cpLevel);

  const triggerKiss = () => {
    setKissActive(true);
    setTimeout(() => setKissActive(false), 1600);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {/* ADJACENT SEATS: ROYAL COUPLE SOFA / SHARED FRAME */}
      {isAdjacent ? (
        <div
          style={{
            left: `${Math.min(posA.x, posB.x) - 8}%`,
            width: "36%",
            top: `${posA.y - 30}px`,
            height: "76px",
          }}
          className="absolute pointer-events-auto flex items-start justify-center transition-all duration-500"
        >
          {/* Glowing Golden Bracket Border */}
          <div className="absolute inset-0 rounded-[28px] border-2 border-amber-400/90 bg-gradient-to-r from-pink-500/15 via-purple-500/20 to-rose-500/15 shadow-[0_0_25px_rgba(251,191,36,0.55),inset_0_0_15px_rgba(244,63,94,0.3)] backdrop-blur-2xs ring-1 ring-white/30" />

          {/* Top Royal Crown Banner */}
          <button
            type="button"
            onClick={triggerKiss}
            className="group relative -top-3.5 z-30 flex items-center gap-1 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-500 via-rose-600 to-purple-600 px-2.5 py-0.5 text-[9px] font-black text-white shadow-xl transition-transform active:scale-90 hover:scale-105 cursor-pointer"
          >
            <Crown className="h-3 w-3 fill-amber-300 text-amber-200 animate-bounce" />
            <span className="tracking-wider uppercase drop-shadow-sm">Royal Couple</span>
            <Heart className="h-2.5 w-2.5 fill-rose-300 text-rose-200 animate-pulse" />
          </button>

          {/* Bottom Shared Days Plaque */}
          <div className="absolute -bottom-2 z-30 flex items-center gap-1 rounded-full border border-white/30 bg-slate-950/80 px-2 py-0.5 text-[8px] font-bold text-pink-200 shadow-md">
            <Flame className="h-2 w-2 text-rose-400 fill-rose-400" />
            <span>Day {daysTogether}</span>
            <span className="text-white/40">•</span>
            <span>Lv.{avgLevel}</span>
          </div>
        </div>
      ) : (
        /* SEPARATED SEATS: ROMANTIC LASER BEAM & TRAVELING HEARTS */
        <svg className="absolute inset-0 h-full w-full pointer-events-none overflow-visible">
          <defs>
            <linearGradient id="cpBeamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#fb7185" stopOpacity="1" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
            </linearGradient>
            <filter id="cpGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Glowing Animated Bezier Beam */}
          <path
            d={`M ${posA.x}% ${posA.y} Q ${(posA.x + posB.x) / 2}% ${Math.min(posA.y, posB.y) - 20} ${posB.x}% ${posB.y}`}
            fill="none"
            stroke="url(#cpBeamGradient)"
            strokeWidth="3"
            strokeDasharray="6 4"
            filter="url(#cpGlow)"
            className="animate-[dash_1.5s_linear_infinite]"
          />

          {/* Center Connection Heart Badge */}
          <foreignObject
            x={`${(posA.x + posB.x) / 2 - 4}%`}
            y={Math.min(posA.y, posB.y) - 28}
            width="40"
            height="30"
            className="overflow-visible"
          >
            <button
              type="button"
              onClick={triggerKiss}
              className="pointer-events-auto flex items-center justify-center h-6 w-6 rounded-full border border-white/60 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg active:scale-90 hover:scale-110 cursor-pointer animate-pulse"
              title="Click to send Flying Kiss!"
            >
              <Heart className="h-3 w-3 fill-white text-white" />
            </button>
          </foreignObject>
        </svg>
      )}

      {/* FLYING KISS BURST OVERLAY */}
      {kissActive && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div className="relative flex flex-col items-center animate-[bounce_0.6s_ease-in-out_infinite]">
            <div className="flex items-center gap-1.5 rounded-full border-2 border-white/80 bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 px-4 py-1.5 shadow-[0_0_30px_rgba(244,63,94,0.9)]">
              <Sparkles className="h-4 w-4 text-amber-200 fill-amber-200 animate-spin" />
              <span className="text-xs font-black uppercase tracking-wider text-white drop-shadow">
                {partnerA.username} 💕 {partnerB.username}
              </span>
              <Heart className="h-4 w-4 fill-rose-300 text-rose-200 animate-ping" />
            </div>
            <span className="text-[10px] font-bold text-amber-300 drop-shadow mt-1">
              Love Sync Active! +10 Intimacy
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CpStageConnectionOverlay;
