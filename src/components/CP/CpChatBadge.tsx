import React from "react";
import { Heart, Sparkles } from "lucide-react";

export interface CpChatBadgeProps {
  level?: number | null;
  levelName?: string | null;
  partnerName?: string | null;
  ringIcon?: string | null;
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

/** Compact CP level badge for room chat usernames. */
export const CpChatBadge: React.FC<CpChatBadgeProps> = ({
  level,
  levelName,
  partnerName,
  ringIcon,
  size = "sm",
  onClick,
  className = "",
}) => {
  if (level == null || !Number.isFinite(level) || level <= 0) return null;

  const badgeGradient =
    level >= 7
      ? "from-amber-400 via-rose-400 to-pink-500 text-amber-950 shadow-amber-500/30"
      : level >= 4
        ? "from-purple-500 via-pink-500 to-rose-500 text-white shadow-pink-500/25"
        : "from-pink-500 to-rose-400 text-white shadow-rose-500/20";
  const isSmall = size === "sm";
  const title = partnerName
    ? `CP Lv.${level} with ${partnerName}`
    : `CP Lv.${level}${levelName ? ` · ${levelName}` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 rounded-full border border-white/20 bg-gradient-to-r ${badgeGradient} font-black leading-none shadow-sm transition-transform active:scale-95 ${isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"} ${onClick ? "cursor-pointer hover:brightness-110" : "cursor-default"} ${className}`}
    >
      {ringIcon ? (
        <img
          src={ringIcon}
          alt=""
          loading="lazy"
          className={isSmall ? "h-3 w-3 object-contain" : "h-3.5 w-3.5 object-contain"}
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      ) : (
        <Heart className={`${isSmall ? "h-2.5 w-2.5" : "h-3 w-3"} fill-current`} />
      )}
      <span className="tracking-tighter">CP {level}</span>
      {level >= 5 && <Sparkles className={`${isSmall ? "h-2 w-2" : "h-2.5 w-2.5"} fill-current`} />}
    </button>
  );
};

export default CpChatBadge;
