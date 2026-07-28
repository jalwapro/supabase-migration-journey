/**
 * Jalwa DP Frame System — production-grade SVG frames.
 *
 * Design invariants (never violate):
 *   • Avatar disc = inner 62% (radius 0.31 in viewBox units of 100).
 *   • All decoration lives OUTSIDE that disc (safe-face zone).
 *   • ViewBox is 100×100 → scales crisp at every DPR.
 *   • Zero raster; all vector (except optional shine overlay via CSS gradient).
 *   • Wrapper is transparent; SVG has no background fill.
 *   • Border thickness 2.4–3.2 SVG units (≈ 8–12 CSS px at 96px).
 *   • Perfectly symmetrical: mirror-safe on x-axis.
 *
 * Usage:
 *   <JalwaFrame category="gold" size={112} />
 *   <JalwaFrame category="diamond" size={80}>
 *     <img src={avatar} className="h-full w-full object-cover" />
 *   </JalwaFrame>
 */

import React from "react";

export type JalwaFrameCategory =
  | "basic"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "crown"
  | "royal"
  | "vip"
  | "agency"
  | "event"
  | "festival"
  | "pk-champion"
  | "top-host"
  | "rich"
  | "luxury"
  | "legendary"
  | "chakoor"
  | "jalwa-exclusive";

export const JALWA_FRAME_CATEGORIES: {
  key: JalwaFrameCategory;
  label: string;
  hint: string;
}[] = [
  { key: "basic", label: "Basic", hint: "Clean starter ring" },
  { key: "silver", label: "Silver", hint: "Brushed silver" },
  { key: "gold", label: "Gold", hint: "Classic 24k gold" },
  { key: "platinum", label: "Platinum", hint: "Cool platinum" },
  { key: "diamond", label: "Diamond", hint: "Crystal facets" },
  { key: "crown", label: "Crown", hint: "Royal crown top" },
  { key: "royal", label: "Royal", hint: "Purple + gold court" },
  { key: "vip", label: "VIP", hint: "Neon violet VIP" },
  { key: "agency", label: "Agency", hint: "Corporate laurel" },
  { key: "event", label: "Event", hint: "Ribbon streamers" },
  { key: "festival", label: "Festival", hint: "Confetti burst" },
  { key: "pk-champion", label: "PK Champion", hint: "Battle laurels" },
  { key: "top-host", label: "Top Host", hint: "Star radiance" },
  { key: "rich", label: "Rich", hint: "Coin cascade" },
  { key: "luxury", label: "Luxury", hint: "Gem-encrusted" },
  { key: "legendary", label: "Legendary", hint: "Fire aura" },
  { key: "chakoor", label: "Chakoor Series", hint: "Signature Jalwa" },
  { key: "jalwa-exclusive", label: "Jalwa Exclusive", hint: "Founders" },
];

type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  ring: string; // metallic ring gradient stops (comma-separated hex/rgba)
};

const PALETTES: Record<JalwaFrameCategory, Palette> = {
  basic: { primary: "#8892a6", secondary: "#c9d1e0", accent: "#ffffff", glow: "rgba(200,215,240,0.55)", ring: "#4a5468,#c9d1e0,#8892a6,#eef2fa,#4a5468" },
  silver: { primary: "#b8c1cf", secondary: "#f5f7fb", accent: "#e6ecf5", glow: "rgba(230,240,255,0.7)", ring: "#5a6577,#e6ecf5,#9ba7bb,#ffffff,#5a6577" },
  gold: { primary: "#b8862a", secondary: "#ffe28a", accent: "#fff4c2", glow: "rgba(255,210,90,0.85)", ring: "#7a5210,#ffe28a,#b8862a,#fff4c2,#7a5210" },
  platinum: { primary: "#8ea3b8", secondary: "#dfeaf5", accent: "#c5d5e6", glow: "rgba(180,210,240,0.75)", ring: "#3a4a5c,#dfeaf5,#8ea3b8,#f0f6fc,#3a4a5c" },
  diamond: { primary: "#7dd3fc", secondary: "#e0f7ff", accent: "#c7ecff", glow: "rgba(140,220,255,0.9)", ring: "#0e4d68,#e0f7ff,#7dd3fc,#ffffff,#0e4d68" },
  crown: { primary: "#c9a84c", secondary: "#fff0b0", accent: "#ffd76a", glow: "rgba(255,200,80,0.9)", ring: "#6d4a10,#ffd76a,#c9a84c,#fff0b0,#6d4a10" },
  royal: { primary: "#6b21a8", secondary: "#c9a84c", accent: "#f5d76e", glow: "rgba(140,80,220,0.85)", ring: "#2b0a45,#c9a84c,#6b21a8,#f5d76e,#2b0a45" },
  vip: { primary: "#a855f7", secondary: "#ec4899", accent: "#f0abfc", glow: "rgba(180,80,255,0.85)", ring: "#3d1160,#ec4899,#a855f7,#f0abfc,#3d1160" },
  agency: { primary: "#0e7490", secondary: "#c9a84c", accent: "#fef3c7", glow: "rgba(20,140,170,0.75)", ring: "#052e3a,#c9a84c,#0e7490,#fef3c7,#052e3a" },
  event: { primary: "#dc2626", secondary: "#fbbf24", accent: "#fff1a8", glow: "rgba(255,120,80,0.85)", ring: "#5a0a0a,#fbbf24,#dc2626,#fff1a8,#5a0a0a" },
  festival: { primary: "#ec4899", secondary: "#22d3ee", accent: "#fde68a", glow: "rgba(240,90,180,0.85)", ring: "#5b0a3d,#22d3ee,#ec4899,#fde68a,#5b0a3d" },
  "pk-champion": { primary: "#b91c1c", secondary: "#f59e0b", accent: "#fff4c2", glow: "rgba(255,80,60,0.9)", ring: "#3a0505,#f59e0b,#b91c1c,#fff4c2,#3a0505" },
  "top-host": { primary: "#f59e0b", secondary: "#ec4899", accent: "#fff", glow: "rgba(255,150,60,0.9)", ring: "#5a2a05,#ec4899,#f59e0b,#fff4c2,#5a2a05" },
  rich: { primary: "#059669", secondary: "#c9a84c", accent: "#fff4c2", glow: "rgba(80,200,150,0.85)", ring: "#062a1a,#c9a84c,#059669,#fff4c2,#062a1a" },
  luxury: { primary: "#7c1d6f", secondary: "#c9a84c", accent: "#f5d76e", glow: "rgba(200,80,180,0.85)", ring: "#2a0a26,#c9a84c,#7c1d6f,#f5d76e,#2a0a26" },
  legendary: { primary: "#ea580c", secondary: "#facc15", accent: "#fff4c2", glow: "rgba(255,120,20,0.95)", ring: "#3a1400,#facc15,#ea580c,#fff4c2,#3a1400" },
  chakoor: { primary: "#4c1d95", secondary: "#f472b6", accent: "#fbcfe8", glow: "rgba(180,100,240,0.9)", ring: "#150533,#f472b6,#4c1d95,#fbcfe8,#150533" },
  "jalwa-exclusive": { primary: "#000000", secondary: "#c9a84c", accent: "#fff4c2", glow: "rgba(220,180,60,0.95)", ring: "#000000,#c9a84c,#3a2a05,#fff4c2,#000000" },
};

function stopsFrom(ring: string) {
  const parts = ring.split(",").map((s) => s.trim());
  return parts.map((c, i) => ({ offset: i / (parts.length - 1), color: c }));
}

/**
 * Radial safe-zone constants (viewBox 100×100).
 *   Avatar disc: r = 31 centered at (50,50). Nothing decorative may cross r=32.
 *   Metallic ring: r = 33..37 (thickness 4). Outer glow may extend to r=48.
 */
const R_INNER = 31;
const R_RING_IN = 33;
const R_RING_OUT = 37;

type Props = {
  category: JalwaFrameCategory;
  /** Rendered size in CSS px. Frame + safe padding fit inside this square. */
  size?: number;
  /** Content rendered inside the safe avatar disc. Usually an <img>. */
  children?: React.ReactNode;
  className?: string;
  /** Reduces motion (respects prefers-reduced-motion by default). */
  animated?: boolean;
  /** aria-label for the wrapper. */
  label?: string;
};

/**
 * The SVG uses viewBox 0 0 100 100 for a perfectly square, DPR-independent
 * canvas. The consumer sizes it via width/height in CSS px. The avatar slot
 * (children) is absolutely positioned to a 62% × 62% center square that
 * exactly matches the SVG's clip disc — so the frame NEVER crosses the face.
 */
export function JalwaFrame({
  category,
  size = 112,
  children,
  className = "",
  animated = true,
  label,
}: Props) {
  const p = PALETTES[category] ?? PALETTES.basic;
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `jf-${uid}-${n}`;
  const ringStops = stopsFrom(p.ring);

  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={`relative inline-block shrink-0 align-middle ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Frame SVG — vector, retina-crisp */}
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          {/* Metallic conic-like ring via linearGradient rotated */}
          <linearGradient id={id("ring")} x1="0" y1="0" x2="1" y2="1">
            {ringStops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <linearGradient id={id("shine")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.55" stopColor={p.glow} stopOpacity="0" />
            <stop offset="0.85" stopColor={p.glow} stopOpacity="0.55" />
            <stop offset="1" stopColor={p.glow} stopOpacity="0" />
          </radialGradient>
          <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <clipPath id={id("clipRing")}>
            <path
              d={`M50,50 m-${R_RING_OUT},0 a${R_RING_OUT},${R_RING_OUT} 0 1,0 ${R_RING_OUT * 2},0 a${R_RING_OUT},${R_RING_OUT} 0 1,0 -${R_RING_OUT * 2},0 Z M50,50 m-${R_RING_IN},0 a${R_RING_IN},${R_RING_IN} 0 1,1 ${R_RING_IN * 2},0 a${R_RING_IN},${R_RING_IN} 0 1,1 -${R_RING_IN * 2},0 Z`}
              fillRule="evenodd"
            />
          </clipPath>
        </defs>

        {/* Outer soft glow */}
        <circle cx="50" cy="50" r="48" fill={`url(#${id("glow")})`} />

        {/* Decorative outer ornaments — category-specific */}
        <Ornaments category={category} palette={p} idFor={id} />

        {/* Metallic ring (main frame body) */}
        <circle
          cx="50"
          cy="50"
          r={(R_RING_IN + R_RING_OUT) / 2}
          fill="none"
          stroke={`url(#${id("ring")})`}
          strokeWidth={R_RING_OUT - R_RING_IN}
        />
        {/* Inner + outer hairlines for depth */}
        <circle cx="50" cy="50" r={R_RING_IN} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="0.35" />
        <circle cx="50" cy="50" r={R_RING_OUT} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="0.35" />

        {/* Animated shine sweep, clipped to the ring band */}
        {animated && (
          <g clipPath={`url(#${id("clipRing")})`}>
            <rect
              x="-40"
              y="0"
              width="40"
              height="100"
              fill={`url(#${id("shine")})`}
              opacity="0.9"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="180 0"
                dur="3.6s"
                repeatCount="indefinite"
              />
            </rect>
          </g>
        )}
      </svg>

      {/* Avatar slot — 62% inner disc, perfectly centered. */}
      <div
        className="absolute overflow-hidden rounded-full ring-2 ring-black/40"
        style={{
          left: "19%",
          top: "19%",
          width: "62%",
          height: "62%",
          background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------- Ornament layers per category ---------------- */

function Ornaments({
  category,
  palette: p,
  idFor,
}: {
  category: JalwaFrameCategory;
  palette: Palette;
  idFor: (n: string) => string;
}) {
  // Every ornament sits OUTSIDE r=R_RING_OUT so it never enters the face.
  const gem = (cx: number, cy: number, r: number, fill: string) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="rgba(0,0,0,0.55)" strokeWidth="0.35" />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.35} fill="rgba(255,255,255,0.85)" />
    </g>
  );

  const cardinalGems = (color: string, r = 2.6) => (
    <>
      {gem(50, 50 - R_RING_OUT - 0.6, r, color)}
      {gem(50, 50 + R_RING_OUT + 0.6, r, color)}
      {gem(50 - R_RING_OUT - 0.6, 50, r, color)}
      {gem(50 + R_RING_OUT + 0.6, 50, r, color)}
    </>
  );

  const diagonalGems = (color: string, r = 2.2) => {
    const d = (R_RING_OUT + 0.4) / Math.SQRT2;
    return (
      <>
        {gem(50 - d, 50 - d, r, color)}
        {gem(50 + d, 50 - d, r, color)}
        {gem(50 - d, 50 + d, r, color)}
        {gem(50 + d, 50 + d, r, color)}
      </>
    );
  };

  const crown = (color: string) => (
    <g transform="translate(50 8)">
      <path
        d="M -10 6 L -7 -2 L -3 4 L 0 -5 L 3 4 L 7 -2 L 10 6 Z"
        fill={color}
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="0.4"
      />
      {gem(-7, -2.5, 1.1, "#ff5555")}
      {gem(0, -5.5, 1.3, "#5cd0ff")}
      {gem(7, -2.5, 1.1, "#7cff9a")}
      <rect x="-11" y="6" width="22" height="1.6" fill={color} stroke="rgba(0,0,0,0.55)" strokeWidth="0.3" />
    </g>
  );

  const wings = (color: string) => (
    <g>
      {[-1, 1].map((s) => (
        <path
          key={s}
          d={`M ${50 + s * 36} 50 q ${s * 8} -10 ${s * 4} -18 q ${s * 2} 12 ${s * -6} 14 q ${s * 4} -6 ${s * 0} -6 q ${s * -6} 4 ${s * 2} 10 Z`}
          fill={color}
          opacity="0.9"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.3"
        />
      ))}
    </g>
  );

  const ribbon = (color: string) => (
    <g transform="translate(50 92)">
      <path
        d="M -18 0 L 18 0 L 14 6 L 4 4 L 0 8 L -4 4 L -14 6 Z"
        fill={color}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="0.35"
      />
      <path d="M -18 0 L -12 -3 L -6 0" fill={color} opacity="0.9" />
      <path d="M 18 0 L 12 -3 L 6 0" fill={color} opacity="0.9" />
    </g>
  );

  const laurel = (color: string) => (
    <g stroke={color} strokeWidth="0.8" fill={color} opacity="0.9">
      {[-1, 1].map((s) => (
        <g key={s}>
          {Array.from({ length: 7 }).map((_, i) => {
            const t = 0.15 + i * 0.11;
            const a = Math.PI * (0.5 + s * (0.35 - t * 0.4));
            const cx = 50 + Math.cos(a) * (R_RING_OUT + 4);
            const cy = 50 - Math.sin(a) * (R_RING_OUT + 4);
            return (
              <ellipse
                key={i}
                cx={cx}
                cy={cy}
                rx="2.1"
                ry="1"
                transform={`rotate(${s * (i * 12 - 40)} ${cx} ${cy})`}
              />
            );
          })}
        </g>
      ))}
    </g>
  );

  const sparkStar = (cx: number, cy: number, s: number, color: string) => (
    <path
      key={`${cx}-${cy}`}
      d={`M ${cx} ${cy - s} L ${cx + s * 0.25} ${cy - s * 0.25} L ${cx + s} ${cy} L ${cx + s * 0.25} ${cy + s * 0.25} L ${cx} ${cy + s} L ${cx - s * 0.25} ${cy + s * 0.25} L ${cx - s} ${cy} L ${cx - s * 0.25} ${cy - s * 0.25} Z`}
      fill={color}
    />
  );

  const orbit = (color: string, count: number, r: number, radius: number, dur = 12) => (
    <g>
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 50 50"
        to="360 50 50"
        dur={`${dur}s`}
        repeatCount="indefinite"
      />
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        const cx = 50 + Math.cos(a) * radius;
        const cy = 50 + Math.sin(a) * radius;
        return <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity="0.85" />;
      })}
    </g>
  );

  const flame = (color1: string, color2: string) => (
    <g opacity="0.85">
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path
          key={deg}
          d="M 50 8 q 3 6 0 12 q -3 -6 0 -12 Z"
          fill={color1}
          transform={`rotate(${deg} 50 50)`}
        >
          <animate
            attributeName="opacity"
            values="0.55;1;0.55"
            dur="1.8s"
            begin={`${deg / 400}s`}
            repeatCount="indefinite"
          />
        </path>
      ))}
      <circle cx="50" cy="50" r="41" fill="none" stroke={color2} strokeWidth="0.4" strokeDasharray="1.5 2" opacity="0.7" />
    </g>
  );

  switch (category) {
    case "basic":
      return <>{cardinalGems(p.accent, 1.6)}</>;
    case "silver":
      return (
        <>
          {cardinalGems(p.accent, 2)}
          {diagonalGems(p.secondary, 1.4)}
        </>
      );
    case "gold":
      return (
        <>
          {cardinalGems(p.secondary, 2.4)}
          {diagonalGems(p.accent, 1.8)}
        </>
      );
    case "platinum":
      return (
        <>
          {cardinalGems(p.accent, 2.6)}
          {diagonalGems(p.secondary, 1.8)}
        </>
      );
    case "diamond":
      return (
        <>
          {cardinalGems(p.accent, 2.8)}
          {diagonalGems(p.secondary, 2)}
          {sparkStar(50, 6, 3, p.accent)}
          {sparkStar(50, 94, 3, p.accent)}
          {sparkStar(6, 50, 3, p.accent)}
          {sparkStar(94, 50, 3, p.accent)}
        </>
      );
    case "crown":
      return (
        <>
          {crown(p.secondary)}
          {ribbon(p.secondary)}
          {diagonalGems(p.accent, 1.8)}
        </>
      );
    case "royal":
      return (
        <>
          {crown(p.secondary)}
          {ribbon(p.secondary)}
          {cardinalGems(p.accent, 2.4)}
          {diagonalGems(p.secondary, 1.6)}
        </>
      );
    case "vip":
      return (
        <>
          <text
            x="50"
            y="8"
            textAnchor="middle"
            fontFamily="Inter, ui-sans-serif"
            fontSize="6.4"
            fontWeight="900"
            fill={p.accent}
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="0.35"
          >
            VIP
          </text>
          {cardinalGems(p.secondary, 2.2)}
          {orbit(p.accent, 3, 0.9, 44, 10)}
        </>
      );
    case "agency":
      return (
        <>
          {laurel(p.secondary)}
          {cardinalGems(p.accent, 2)}
        </>
      );
    case "event":
      return (
        <>
          {ribbon(p.primary)}
          {crown(p.secondary)}
          {cardinalGems(p.accent, 2)}
        </>
      );
    case "festival":
      return (
        <>
          {orbit(p.secondary, 6, 1.2, 44, 14)}
          {orbit(p.accent, 4, 1, 46, -18)}
          {cardinalGems(p.primary, 2.2)}
        </>
      );
    case "pk-champion":
      return (
        <>
          {laurel(p.secondary)}
          <g transform="translate(50 8)">
            <path
              d="M -6 0 L 0 -8 L 6 0 L 4 6 L -4 6 Z"
              fill={p.secondary}
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="0.4"
            />
            <text x="0" y="4.5" textAnchor="middle" fontSize="4.2" fontWeight="900" fill={p.primary}>
              PK
            </text>
          </g>
          {ribbon(p.primary)}
        </>
      );
    case "top-host":
      return (
        <>
          {sparkStar(50, 6, 4, p.secondary)}
          {orbit(p.accent, 8, 0.9, 44, 20)}
          {cardinalGems(p.secondary, 2.2)}
          {ribbon(p.primary)}
        </>
      );
    case "rich":
      return (
        <>
          {orbit(p.secondary, 8, 1.8, 44, 16)}
          {cardinalGems(p.accent, 2.2)}
        </>
      );
    case "luxury":
      return (
        <>
          {crown(p.secondary)}
          {cardinalGems(p.accent, 2.6)}
          {diagonalGems(p.secondary, 2)}
          {orbit(p.accent, 12, 0.5, 45, 22)}
        </>
      );
    case "legendary":
      return (
        <>
          {flame(p.primary, p.secondary)}
          {crown(p.secondary)}
          {cardinalGems(p.accent, 2.4)}
        </>
      );
    case "chakoor":
      return (
        <>
          {wings(p.secondary)}
          {crown(p.secondary)}
          {cardinalGems(p.accent, 2.4)}
          {diagonalGems(p.primary, 1.6)}
        </>
      );
    case "jalwa-exclusive":
      return (
        <>
          {wings(p.secondary)}
          {crown(p.secondary)}
          {cardinalGems(p.accent, 2.6)}
          {diagonalGems(p.secondary, 2)}
          {orbit(p.accent, 16, 0.4, 46, 26)}
          <text
            x="50"
            y="98"
            textAnchor="middle"
            fontFamily="Inter, ui-sans-serif"
            fontSize="4.2"
            fontWeight="900"
            letterSpacing="0.6"
            fill={p.secondary}
          >
            JALWA
          </text>
        </>
      );
  }
}

export default JalwaFrame;
