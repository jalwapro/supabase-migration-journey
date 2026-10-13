import React from "react";
import { Heart } from "lucide-react";

export interface CpSeatAuraProps {
  cpLevel?: number | null;
  partnerPresentOnStage?: boolean;
  isSpeaking?: boolean;
  children: React.ReactNode;
}

/** Decorative CP aura for an avatar or voice-room seat. */
export const CpSeatAura: React.FC<CpSeatAuraProps> = ({
  cpLevel,
  partnerPresentOnStage = false,
  isSpeaking = false,
  children,
}) => {
  if (cpLevel == null || !Number.isFinite(cpLevel) || cpLevel <= 0) {
    return <>{children}</>;
  }

  const auraGlow =
    cpLevel >= 7
      ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)]"
      : cpLevel >= 4
        ? "border-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.5)]"
        : "border-pink-400 shadow-[0_0_14px_rgba(244,114,182,0.45)]";

  return (
    <div className="relative inline-flex items-center justify-center">
      {(partnerPresentOnStage || isSpeaking) && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1.5 rounded-full ${partnerPresentOnStage ? "animate-pulse" : "animate-ping"} opacity-35 ${cpLevel >= 7 ? "bg-amber-400" : cpLevel >= 4 ? "bg-fuchsia-400" : "bg-pink-500"}`}
        />
      )}

      <div
        className={`relative rounded-full border-2 transition-all duration-300 ${auraGlow} ${partnerPresentOnStage ? "animate-pulse" : ""}`}
      >
        {children}
      </div>

      <span
        title={partnerPresentOnStage ? `CP Lv.${cpLevel} (Couple on stage!)` : `CP Lv.${cpLevel}`}
        aria-label={partnerPresentOnStage ? `CP level ${cpLevel}; both partners on stage` : `CP level ${cpLevel}`}
        className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-white/40 p-0.5 text-white shadow-md ${partnerPresentOnStage ? "scale-110 bg-gradient-to-r from-pink-600 to-rose-600" : "bg-gradient-to-r from-pink-500 to-purple-600"}`}
      >
        <Heart className="h-2.5 w-2.5 fill-current" />
      </span>

      {partnerPresentOnStage && (
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ring-1 ring-white/30">
          CP Sync
        </span>
      )}
    </div>
  );
};

export default CpSeatAura;
