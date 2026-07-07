// Level tier system — used for avatar frames, badges, and progress.

export type LevelTier = {
  key: "novice" | "bronze" | "silver" | "gold" | "diamond" | "royal" | "legend";
  label: string;
  minLevel: number;
  maxLevel: number;
  // Tailwind classes used to build a gradient ring around avatars.
  ringGradient: string; // e.g. "from-slate-400 to-slate-600"
  glow: string;         // box-shadow color-mix expression
  badgeGradient: string;
  icon: string;         // small emoji/symbol shown on the frame
};

export const LEVEL_TIERS: LevelTier[] = [
  {
    key: "novice",
    label: "Novice",
    minLevel: 0,
    maxLevel: 4,
    ringGradient: "from-slate-400 via-slate-300 to-slate-500",
    glow: "color-mix(in oklab, #94a3b8 55%, transparent)",
    badgeGradient: "from-slate-500 to-slate-700",
    icon: "★",
  },
  {
    key: "bronze",
    label: "Bronze",
    minLevel: 5,
    maxLevel: 9,
    ringGradient: "from-amber-700 via-orange-500 to-amber-800",
    glow: "color-mix(in oklab, #b45309 55%, transparent)",
    badgeGradient: "from-amber-700 to-orange-600",
    icon: "🥉",
  },
  {
    key: "silver",
    label: "Silver",
    minLevel: 10,
    maxLevel: 19,
    ringGradient: "from-slate-200 via-white to-slate-400",
    glow: "color-mix(in oklab, #cbd5e1 65%, transparent)",
    badgeGradient: "from-slate-300 to-slate-500",
    icon: "🥈",
  },
  {
    key: "gold",
    label: "Gold",
    minLevel: 20,
    maxLevel: 34,
    ringGradient: "from-amber-300 via-yellow-400 to-amber-600",
    glow: "color-mix(in oklab, #f59e0b 65%, transparent)",
    badgeGradient: "from-amber-400 to-yellow-600",
    icon: "🥇",
  },
  {
    key: "diamond",
    label: "Diamond",
    minLevel: 35,
    maxLevel: 54,
    ringGradient: "from-cyan-300 via-sky-400 to-indigo-500",
    glow: "color-mix(in oklab, #38bdf8 70%, transparent)",
    badgeGradient: "from-cyan-400 to-indigo-500",
    icon: "💎",
  },
  {
    key: "royal",
    label: "Royal",
    minLevel: 55,
    maxLevel: 79,
    ringGradient: "from-fuchsia-500 via-violet-500 to-purple-700",
    glow: "color-mix(in oklab, #a855f7 70%, transparent)",
    badgeGradient: "from-fuchsia-500 to-violet-700",
    icon: "👑",
  },
  {
    key: "legend",
    label: "Legend",
    minLevel: 80,
    maxLevel: 9999,
    ringGradient: "from-rose-500 via-amber-400 to-fuchsia-600",
    glow: "color-mix(in oklab, #f43f5e 75%, transparent)",
    badgeGradient: "from-rose-500 via-amber-400 to-fuchsia-600",
    icon: "🔥",
  },
];

export function tierForLevel(level: number): LevelTier {
  const lvl = Math.max(0, Math.floor(level || 0));
  return (
    LEVEL_TIERS.find((t) => lvl >= t.minLevel && lvl <= t.maxLevel) ??
    LEVEL_TIERS[0]
  );
}

// XP needed to reach the next level (simple curve: 100 * (level+1)).
export function xpForNextLevel(level: number): number {
  return 100 * (Math.max(0, Math.floor(level)) + 1);
}

export function levelProgress(level: number, xp: number) {
  const need = xpForNextLevel(level);
  const have = Math.max(0, Math.min(need, xp));
  return { have, need, pct: Math.round((have / need) * 100) };
}
