import React, { useState } from "react";
import { Heart, Sparkles, Crown } from "lucide-react";

export interface CpSeatAuraProps {
  cpLevel?: number | null;
  partnerPresentOnStage?: boolean;
  isSpeaking?: boolean;
  children: React.ReactNode;
}

export const CpSeatAura: React.FC<CpSeatAuraProps> = ({
  cpLevel,
  partnerPresentOnStage = false,
  isSpeaking = false,
  children,
}) => {
  const [tapBurst, setTapBurst] = useState(false);

  if (cpLevel == null || !Number.isFinite(cpLevel) || cpLevel <= 0) {
    return <>{children}</>;
  }

  const lvl = Math.floor(cpLevel);

  const tierConfig = (() => {
    if (lvl >= 10) {
      return {
        name: "Celestial Sovereign",
        border: "border-amber-300",
        shadow: partnerPresentOnStage
          ? "shadow-[0_0_24px_rgba(251,191,36,0.9),0_0_40px_rgba(236,72,153,0.6)]"
          : "shadow-[0_0_18px_rgba(251,191,36,0.7)]",
        badgeBg: "bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600",
        badgeText: "text-amber-100",
        ringColor: "ring-amber-400/80",
        hasWings: true,
      };
    }
    if (lvl >= 7) {
      return {
        name: "Golden Rose",
        border: "border-amber-400",
        shadow: partnerPresentOnStage
          ? "shadow-[0_0_20px_rgba(245,158,11,0.8),0_0_30px_rgba(244,63,94,0.5)]"
          : "shadow-[0_0_15px_rgba(245,158,11,0.6)]",
        badgeBg: "bg-gradient-to-r from-amber-500 to-rose-500",
        badgeText: "text-amber-50",
        ringColor: "ring-amber-400/70",
        hasWings: false,
      };
    }
    if (lvl >= 4) {
      return {
        name: "Violet Royalty",
        border: "border-fuchsia-400",
        shadow: partnerPresentOnStage
          ? "shadow-[0_0_18px_rgba(217,70,239,0.8),0_0_25px_rgba(236,72,153,0.5)]"
          : "shadow-[0_0_14px_rgba(217,70,239,0.55)]",
        badgeBg: "bg-gradient-to-r from-fuchsia-500 to-pink-600",
        badgeText: "text-white",
        ringColor: "ring-fuchsia-400/60",
        hasWings: false,
      };
    }
    return {
      name: "Rose Blossom",
      border: "border-pink-400",
      shadow: partnerPresentOnStage
        ? "shadow-[0_0_16px_rgba(244,114,182,0.8),0_0_22px_rgba(236,72,153,0.5)]"
        : "shadow-[0_0_12px_rgba(244,114,182,0.5)]",
      badgeBg: "bg-gradient-to-r from-pink-500 to-rose-500",
      badgeText: "text-white",
      ringColor: "ring-pink-400/50",
      hasWings: false,
    };
  })();

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTapBurst(true);
    setTimeout(() => setTapBurst(false), 800);
  };

  return (
    <div
      onClick={handleTap}
      className="relative inline-flex items-center justify-center cursor-pointer select-none group"
    >
      {tapBurst && (
        <span className="pointer-events-none absolute -inset-6 z-50 flex items-center justify-center animate-ping opacity-80">
          <Heart className="h-8 w-8 fill-pink-500 text-pink-400 drop-shadow-[0_0_12px_rgba(244,63,94,1)]" />
        </span>
      )}

      {partnerPresentOnStage && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2.5 rounded-full animate-ping opacity-30 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 blur-xs"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1.5 rounded-full animate-pulse opacity-50 bg-gradient-to-tr from-pink-500 via-amber-300 to-rose-500 blur-[2px]"
          />
        </>
      )}

      {isSpeaking && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-full animate-pulse opacity-75 bg-rose-400 blur-xs"
        />
      )}

      <div
        className={`relative rounded-full border-2 transition-all duration-300 ${tierConfig.border} ${tierConfig.shadow} ${
          partnerPresentOnStage ? "ring-2 " + tierConfig.ringColor + " ring-offset-1 ring-offset-black/60" : ""
        }`}
      >
        {children}
      </div>

      {partnerPresentOnStage && tierConfig.hasWings && (
        <span className="pointer-events-none absolute -top-3 z-30 flex items-center justify-center filter drop-shadow-[0_2px_6px_rgba(251,191,36,0.9)] animate-bounce">
          <Crown className="h-4 w-4 fill-amber-300 text-amber-100" />
        </span>
      )}

      {partnerPresentOnStage && (
        <span className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 whitespace-nowrap rounded-full bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 px-1.5 py-0.2 text-[8px] font-black text-white shadow-lg ring-1 ring-white/50 animate-[pulse_1.5s_ease-in-out_infinite]">
          <Sparkles className="h-2 w-2 text-amber-200 fill-amber-200" />
          CP SYNC
        </span>
      )}

      <span
        title={partnerPresentOnStage ? `CP Lv.${lvl} (Couple on Stage!)` : `CP Lv.${lvl}`}
        className={`absolute -bottom-1 -right-1 z-30 flex items-center gap-0.5 rounded-full border border-white/60 px-1 py-0.2 shadow-lg transition-transform group-hover:scale-110 ${tierConfig.badgeBg}`}
      >
        <Heart className="h-2 w-2 fill-white text-white drop-shadow-xs" />
        <span className={`text-[8px] font-black leading-none ${tierConfig.badgeText}`}>
          {lvl}
        </span>
      </span>
    </div>
  );
};

export default CpSeatAura;
