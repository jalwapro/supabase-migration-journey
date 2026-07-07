import { tierForLevel } from "@/lib/levels";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { w: number; h: number; text: number; lv: number }> = {
  sm: { w: 56, h: 44, text: 9, lv: 7 },
  md: { w: 84, h: 66, text: 13, lv: 9 },
  lg: { w: 132, h: 104, text: 20, lv: 13 },
};

/**
 * Animated ranking badge inspired by the Jalwa level sheet:
 * crown + wings + shield + "JALWA" text, tinted by the tier color.
 * Purely CSS/SVG so it works everywhere (profile card, entrance bar, room chip).
 */
export function LevelBadge({
  level,
  size = "md",
  showLabel = true,
  className = "",
}: {
  level: number;
  size?: Size;
  showLabel?: boolean;
  className?: string;
}) {
  const tier = tierForLevel(level);
  const dim = SIZES[size];
  const c = tier.color;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: dim.w, height: dim.h }}
    >
      {/* soft glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-xl opacity-70"
        style={{ background: `radial-gradient(closest-side, ${c}66, transparent 70%)` }}
      />

      <svg
        viewBox="0 0 120 96"
        width={dim.w}
        height={dim.h}
        className="relative drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
      >
        <defs>
          <linearGradient id={`wing-${tier.key}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c} stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`shield-${tier.key}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor="#0b0616" />
          </linearGradient>
          <radialGradient id={`disc-${tier.key}`} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#1a0b2e" />
            <stop offset="100%" stopColor="#050510" />
          </radialGradient>
        </defs>

        {/* Wings */}
        <g fill={`url(#wing-${tier.key})`} opacity="0.95">
          <path d="M8 46 C 18 30, 34 30, 44 44 L 44 54 C 30 46, 18 50, 8 58 Z" />
          <path d="M112 46 C 102 30, 86 30, 76 44 L 76 54 C 90 46, 102 50, 112 58 Z" />
        </g>

        {/* Outer ring */}
        <circle cx="60" cy="46" r="32" fill={`url(#disc-${tier.key})`} stroke={c} strokeWidth="2.5" />
        <circle cx="60" cy="46" r="32" fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="6" />

        {/* Crown */}
        <g fill="#f5c542" stroke="#7a4a00" strokeWidth="0.5">
          <path d="M46 30 L52 22 L56 28 L60 20 L64 28 L68 22 L74 30 L74 34 L46 34 Z" />
          <rect x="46" y="34" width="28" height="3" rx="1" />
        </g>

        {/* JALWA text */}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', system-ui"
          fontSize="12"
          fontWeight="900"
          fill="#f5c542"
          stroke="#5a2a00"
          strokeWidth="0.4"
          letterSpacing="1"
        >
          JALWA
        </text>

        {/* Shield with level */}
        <g>
          <path
            d="M50 62 L70 62 L68 78 L60 84 L52 78 Z"
            fill={`url(#shield-${tier.key})`}
            stroke={c}
            strokeWidth="1.4"
          />
          <text
            x="60"
            y="76"
            textAnchor="middle"
            fontFamily="Impact, 'Arial Black', system-ui"
            fontSize="10"
            fontWeight="900"
            fill="#ffffff"
          >
            {level}
          </text>
        </g>
      </svg>

      {showLabel && (
        <span
          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[1px] text-[9px] font-black uppercase tracking-widest text-white shadow ring-1 ring-black/40 ${tier.textClass}`}
          style={{
            background: `linear-gradient(90deg, ${c}55, #00000055)`,
            border: `1px solid ${c}80`,
          }}
        >
          {tier.label}
        </span>
      )}
    </div>
  );
}
