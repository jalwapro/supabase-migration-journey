/**
 * King / Queen / Wazeer royal frame badge for top-3 gifters.
 * Pure SVG + CSS — no assets required. Wraps an avatar with a crowned,
 * winged/elegant frame and a labeled ribbon.
 */

type Rank = 1 | 2 | 3;
type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 56, md: 80, lg: 112 };

const TIERS: Record<Rank, {
  label: string;
  ring: string;      // frame ring gradient
  crown: string;     // crown fill
  crownStroke: string;
  ribbon: string;    // ribbon gradient
  glow: string;
  wings: boolean;
  accent: string;
}> = {
  1: {
    label: "King",
    ring: "linear-gradient(135deg,#f8d247 0%,#c9962b 50%,#f8d247 100%)",
    crown: "#f9d34a",
    crownStroke: "#8a5a10",
    ribbon: "linear-gradient(180deg,#f2b32b,#8a5a10)",
    glow: "0 0 22px rgba(249,211,74,.65)",
    wings: true,
    accent: "#f9d34a",
  },
  2: {
    label: "Queen",
    ring: "linear-gradient(135deg,#ff8ad4 0%,#c33aa8 50%,#ff8ad4 100%)",
    crown: "#ff7ed0",
    crownStroke: "#7a1e63",
    ribbon: "linear-gradient(180deg,#ff5fbf,#7a1e63)",
    glow: "0 0 22px rgba(255,126,208,.65)",
    wings: true,
    accent: "#ff7ed0",
  },
  3: {
    label: "Wazeer",
    ring: "linear-gradient(135deg,#e6f1ff 0%,#8fa8c8 50%,#e6f1ff 100%)",
    crown: "#d9e6f5",
    crownStroke: "#2b4d80",
    ribbon: "linear-gradient(180deg,#4c7fc9,#1e355e)",
    glow: "0 0 20px rgba(180,210,255,.6)",
    wings: false,
    accent: "#cfe0f7",
  },
};

export function RoyalBadge({
  rank,
  src,
  name,
  size = "md",
  showLabel = true,
  className = "",
}: {
  rank: Rank;
  src?: string | null;
  name?: string | null;
  size?: Size;
  showLabel?: boolean;
  className?: string;
}) {
  const t = TIERS[rank];
  const px = SIZE_PX[size];
  const initial = (name ?? "?").slice(0, 1).toUpperCase();

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Wings for King & Queen */}
      {t.wings && (
        <svg
          viewBox="0 0 200 100"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: px * 1.85, height: px * 0.95, filter: `drop-shadow(${t.glow})` }}
          aria-hidden
        >
          <defs>
            <linearGradient id={`wg-${rank}`} x1="0" x2="1">
              <stop offset="0%" stopColor={t.accent} stopOpacity=".95" />
              <stop offset="100%" stopColor={t.accent} stopOpacity=".55" />
            </linearGradient>
          </defs>
          {/* Left wing */}
          <path
            d="M100 50 C 70 30, 40 32, 12 48 C 40 52, 60 58, 82 66 C 60 60, 42 62, 22 72 C 50 72, 72 68, 96 62 Z"
            fill={`url(#wg-${rank})`}
            stroke={t.crownStroke}
            strokeOpacity=".35"
            strokeWidth="1"
          />
          {/* Right wing (mirror) */}
          <path
            d="M100 50 C 130 30, 160 32, 188 48 C 160 52, 140 58, 118 66 C 140 60, 158 62, 178 72 C 150 72, 128 68, 104 62 Z"
            fill={`url(#wg-${rank})`}
            stroke={t.crownStroke}
            strokeOpacity=".35"
            strokeWidth="1"
          />
        </svg>
      )}

      {/* Ring frame */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: t.ring,
          boxShadow: t.glow,
          maskImage: "radial-gradient(circle, transparent 62%, black 64%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 62%, black 64%)",
        }}
      />

      {/* Avatar disc */}
      <div className="absolute inset-[9%] overflow-hidden rounded-full bg-card ring-2 ring-black/40">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[color:var(--primary)]/70 to-[color:var(--secondary)]/70 text-white">
            <span className="text-lg font-black">{initial}</span>
          </div>
        )}
      </div>

      {/* Crown on top */}
      <svg
        viewBox="0 0 100 60"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          width: px * 0.7,
          height: px * 0.42,
          top: -px * 0.28,
          filter: `drop-shadow(0 2px 4px rgba(0,0,0,.55))`,
        }}
        aria-hidden
      >
        <path
          d="M10 50 L18 20 L34 40 L50 10 L66 40 L82 20 L90 50 Z"
          fill={t.crown}
          stroke={t.crownStroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <rect x="10" y="48" width="80" height="8" rx="2" fill={t.crown} stroke={t.crownStroke} strokeWidth="2" />
        <circle cx="50" cy="12" r="3.5" fill="#fff" stroke={t.crownStroke} strokeWidth="1.5" />
        <circle cx="18" cy="22" r="2.5" fill="#fff" stroke={t.crownStroke} strokeWidth="1" />
        <circle cx="82" cy="22" r="2.5" fill="#fff" stroke={t.crownStroke} strokeWidth="1" />
      </svg>

      {/* Ribbon label */}
      {showLabel && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md px-2.5 py-[3px] text-[10px] font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-black/40"
          style={{
            background: t.ribbon,
            bottom: -px * 0.12,
          }}
        >
          {t.label}
        </div>
      )}
    </div>
  );
}
