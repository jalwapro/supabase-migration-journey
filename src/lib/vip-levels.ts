// Jalwa VIP Gifting System — client-side thresholds + tier metadata.
// Mirrors public.vip_level_config seed in db/migrations/0053_vip_gifting_system.sql.
// Level is derived ONLY from lifetime gift coins sent.

export const MAX_VIP_LEVEL = 100;

// Anchor points used to interpolate the full 0..100 curve (log-linear).
const ANCHORS: Array<[number, number]> = [
  [0, 0],
  [1, 1_000_000], [2, 3_000_000], [3, 6_000_000], [4, 10_000_000], [5, 15_000_000],
  [6, 21_000_000], [7, 28_000_000], [8, 36_000_000], [9, 45_000_000], [10, 55_000_000],
  [20, 410_000_000], [30, 1_560_000_000], [40, 3_710_000_000], [50, 7_960_000_000],
  [60, 16_000_000_000], [70, 31_000_000_000], [80, 59_000_000_000],
  [90, 108_000_000_000], [100, 190_000_000_000],
];

function computeThresholds(): number[] {
  const out: number[] = new Array(MAX_VIP_LEVEL + 1);
  for (let lvl = 0; lvl <= MAX_VIP_LEVEL; lvl++) {
    let a = ANCHORS[0], b = ANCHORS[ANCHORS.length - 1];
    for (const p of ANCHORS) if (p[0] <= lvl) a = p;
    for (let i = ANCHORS.length - 1; i >= 0; i--) if (ANCHORS[i][0] >= lvl) b = ANCHORS[i];
    if (a[0] === b[0]) { out[lvl] = a[1]; continue; }
    const la = Math.log(Math.max(a[1], 1));
    const lb = Math.log(Math.max(b[1], 1));
    out[lvl] = Math.round(Math.exp(la + (lb - la) * ((lvl - a[0]) / (b[0] - a[0]))));
  }
  out[0] = 0;
  return out;
}

export const VIP_THRESHOLDS: number[] = computeThresholds();

export type VipTier = {
  key: string;
  label: string;                // "Bronze VIP"
  minLevel: number;
  maxLevel: number;
  gradient: string;             // tailwind gradient stops
  glow: string;                 // css color for shadow
  ringGradient: string;
  textClass: string;
  icon: string;
  color: string;                // hex
};

export const VIP_TIERS: VipTier[] = [
  { key: "rookie",       label: "Rookie",           minLevel: 0,  maxLevel: 0,
    gradient: "from-slate-500 to-slate-700", ringGradient: "from-slate-400 via-slate-300 to-slate-600",
    glow: "color-mix(in oklab,#94a3b8 55%,transparent)", textClass: "text-slate-200", icon: "★", color: "#94a3b8" },
  { key: "bronze",       label: "Bronze VIP",       minLevel: 1,  maxLevel: 10,
    gradient: "from-amber-700 to-orange-600", ringGradient: "from-amber-700 via-orange-500 to-amber-800",
    glow: "color-mix(in oklab,#b45309 65%,transparent)", textClass: "text-amber-400", icon: "🥉", color: "#c2751a" },
  { key: "silver",       label: "Silver VIP",       minLevel: 11, maxLevel: 20,
    gradient: "from-slate-300 to-slate-500", ringGradient: "from-slate-200 via-white to-slate-400",
    glow: "color-mix(in oklab,#cbd5e1 70%,transparent)", textClass: "text-slate-100", icon: "🥈", color: "#d8dee7" },
  { key: "gold",         label: "Gold VIP",         minLevel: 21, maxLevel: 30,
    gradient: "from-amber-400 to-yellow-600", ringGradient: "from-amber-300 via-yellow-400 to-amber-600",
    glow: "color-mix(in oklab,#f59e0b 75%,transparent)", textClass: "text-amber-300", icon: "🥇", color: "#f5b638" },
  { key: "ruby",         label: "Ruby VIP",         minLevel: 31, maxLevel: 40,
    gradient: "from-rose-500 to-red-700", ringGradient: "from-rose-400 via-red-500 to-rose-800",
    glow: "color-mix(in oklab,#ef4444 80%,transparent)", textClass: "text-rose-400", icon: "🔺", color: "#ef4444" },
  { key: "platinum",     label: "Platinum VIP",     minLevel: 41, maxLevel: 50,
    gradient: "from-sky-300 to-slate-500", ringGradient: "from-sky-200 via-slate-100 to-sky-400",
    glow: "color-mix(in oklab,#7dd3fc 80%,transparent)", textClass: "text-sky-200", icon: "◈", color: "#38bdf8" },
  { key: "diamond",      label: "Diamond VIP",      minLevel: 51, maxLevel: 60,
    gradient: "from-cyan-400 to-indigo-500", ringGradient: "from-cyan-300 via-sky-400 to-indigo-500",
    glow: "color-mix(in oklab,#38bdf8 85%,transparent)", textClass: "text-cyan-300", icon: "💎", color: "#a855f7" },
  { key: "master",       label: "Master VIP",       minLevel: 61, maxLevel: 70,
    gradient: "from-fuchsia-500 to-violet-700", ringGradient: "from-fuchsia-400 via-violet-500 to-purple-700",
    glow: "color-mix(in oklab,#a855f7 85%,transparent)", textClass: "text-fuchsia-300", icon: "✦", color: "#22d3ee" },
  { key: "grandmaster",  label: "Grandmaster VIP",  minLevel: 71, maxLevel: 80,
    gradient: "from-purple-500 to-fuchsia-700", ringGradient: "from-purple-400 via-fuchsia-500 to-purple-800",
    glow: "color-mix(in oklab,#a21caf 90%,transparent)", textClass: "text-purple-300", icon: "❖", color: "#fb7185" },
  { key: "legend",       label: "Legend VIP",       minLevel: 81, maxLevel: 90,
    gradient: "from-yellow-400 to-amber-600", ringGradient: "from-yellow-300 via-amber-400 to-yellow-600",
    glow: "color-mix(in oklab,#eab308 90%,transparent)", textClass: "text-yellow-300", icon: "🌟", color: "#eab308" },
  { key: "mythic",       label: "Mythic VIP",       minLevel: 91, maxLevel: 99,
    gradient: "from-teal-400 to-cyan-600", ringGradient: "from-teal-300 via-cyan-400 to-teal-700",
    glow: "color-mix(in oklab,#14b8a6 90%,transparent)", textClass: "text-teal-300", icon: "🧿", color: "#ec4899" },
  { key: "king",         label: "Jalwa King",       minLevel: 100, maxLevel: 100,
    gradient: "from-amber-300 via-rose-500 to-fuchsia-600", ringGradient: "from-amber-300 via-rose-500 to-fuchsia-600",
    glow: "color-mix(in oklab,#f43f5e 95%,transparent)", textClass: "text-amber-300", icon: "👑", color: "#f43f5e" },
];

export function vipTierForLevel(level: number): VipTier {
  const l = Math.max(0, Math.min(MAX_VIP_LEVEL, Math.floor(level || 0)));
  return VIP_TIERS.find((t) => l >= t.minLevel && l <= t.maxLevel) ?? VIP_TIERS[0];
}

export function vipTitleForLevel(level: number): string {
  return `${vipTierForLevel(level).label} Lv${level}`;
}

export type VipProgress = {
  level: number;
  tier: VipTier;
  totalGifted: number;
  currentLevelStart: number;
  nextLevelAt: number;         // 0 if maxed
  remaining: number;
  percent: number;             // 0..100
  isMax: boolean;
};

export function vipProgressFor(totalGifted: number, storedLevel?: number | null): VipProgress {
  const total = Math.max(0, Math.floor(totalGifted || 0));
  // largest level whose threshold <= total
  let level = 0;
  for (let i = VIP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= VIP_THRESHOLDS[i]) { level = i; break; }
  }
  // never decrease
  if (typeof storedLevel === "number") level = Math.max(level, storedLevel);
  const isMax = level >= MAX_VIP_LEVEL;
  const currentLevelStart = VIP_THRESHOLDS[level] ?? 0;
  const nextLevelAt = isMax ? 0 : VIP_THRESHOLDS[level + 1];
  const span = isMax ? 1 : Math.max(1, nextLevelAt - currentLevelStart);
  const into = Math.max(0, total - currentLevelStart);
  const percent = isMax ? 100 : Math.min(100, Math.round((into / span) * 100));
  const remaining = isMax ? 0 : Math.max(0, nextLevelAt - total);
  return {
    level,
    tier: vipTierForLevel(level),
    totalGifted: total,
    currentLevelStart,
    nextLevelAt,
    remaining,
    percent,
    isMax,
  };
}

export function formatCoins(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 2) + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2) + "M";
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

// Milestone rewards mirror seed in vip_level_config.
export const MILESTONE_REWARDS: Record<number, { coins: number; bundle: string }> = {
  10:  { coins: 5000,   bundle: "Bronze Bundle" },
  20:  { coins: 10000,  bundle: "Silver Bundle" },
  30:  { coins: 15000,  bundle: "Gold Bundle" },
  40:  { coins: 20000,  bundle: "Ruby Bundle" },
  50:  { coins: 30000,  bundle: "Diamond Bundle" },
  60:  { coins: 40000,  bundle: "Royal Bundle" },
  70:  { coins: 50000,  bundle: "Grandmaster Bundle" },
  80:  { coins: 60000,  bundle: "Legend Bundle" },
  90:  { coins: 80000,  bundle: "Mythic Bundle" },
  100: { coins: 100000, bundle: "Jalwa King Bundle" },
};
