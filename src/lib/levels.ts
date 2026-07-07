// Level tier system — used for avatar frames, badges, and entrance bars.
// 20 tiers modeled after the Jalwa badge sheet (Rookie → Eternal).

export type LevelTier = {
  key: string;
  label: string;
  minLevel: number;
  maxLevel: number;
  // Tailwind gradient stops used for rings, badges, chips.
  ringGradient: string;
  // CSS color expression used for glow shadow.
  glow: string;
  // Gradient used behind small chips.
  badgeGradient: string;
  // Emoji/symbol shown on compact chips.
  icon: string;
  // Hex color used to tint the big JALWA level badge (SVG shield/wings).
  color: string;
  // Solid text color used on labels (Tailwind text-* class).
  textClass: string;
};

export const LEVEL_TIERS: LevelTier[] = [
  {
    key: "rookie", label: "Rookie", minLevel: 0, maxLevel: 4,
    ringGradient: "from-slate-400 via-slate-300 to-slate-600",
    glow: "color-mix(in oklab, #94a3b8 55%, transparent)",
    badgeGradient: "from-slate-500 to-slate-700",
    icon: "★", color: "#94a3b8", textClass: "text-slate-200",
  },
  {
    key: "bronze", label: "Bronze", minLevel: 5, maxLevel: 9,
    ringGradient: "from-amber-700 via-orange-500 to-amber-800",
    glow: "color-mix(in oklab, #b45309 65%, transparent)",
    badgeGradient: "from-amber-700 to-orange-600",
    icon: "🥉", color: "#c2751a", textClass: "text-amber-400",
  },
  {
    key: "silver", label: "Silver", minLevel: 10, maxLevel: 14,
    ringGradient: "from-slate-200 via-white to-slate-400",
    glow: "color-mix(in oklab, #cbd5e1 70%, transparent)",
    badgeGradient: "from-slate-300 to-slate-500",
    icon: "🥈", color: "#d8dee7", textClass: "text-slate-100",
  },
  {
    key: "gold", label: "Gold", minLevel: 15, maxLevel: 19,
    ringGradient: "from-amber-300 via-yellow-400 to-amber-600",
    glow: "color-mix(in oklab, #f59e0b 70%, transparent)",
    badgeGradient: "from-amber-400 to-yellow-600",
    icon: "🥇", color: "#f5b638", textClass: "text-amber-300",
  },
  {
    key: "platinum", label: "Platinum", minLevel: 20, maxLevel: 24,
    ringGradient: "from-sky-200 via-slate-100 to-sky-400",
    glow: "color-mix(in oklab, #7dd3fc 70%, transparent)",
    badgeGradient: "from-sky-300 to-slate-400",
    icon: "◈", color: "#bfe4f5", textClass: "text-sky-200",
  },
  {
    key: "diamond", label: "Diamond", minLevel: 25, maxLevel: 29,
    ringGradient: "from-cyan-300 via-sky-400 to-indigo-500",
    glow: "color-mix(in oklab, #38bdf8 75%, transparent)",
    badgeGradient: "from-cyan-400 to-indigo-500",
    icon: "💎", color: "#38bdf8", textClass: "text-cyan-300",
  },
  {
    key: "emerald", label: "Emerald", minLevel: 30, maxLevel: 34,
    ringGradient: "from-emerald-300 via-emerald-500 to-green-700",
    glow: "color-mix(in oklab, #10b981 75%, transparent)",
    badgeGradient: "from-emerald-400 to-green-600",
    icon: "🟢", color: "#10b981", textClass: "text-emerald-300",
  },
  {
    key: "ruby", label: "Ruby", minLevel: 35, maxLevel: 39,
    ringGradient: "from-rose-400 via-red-500 to-rose-800",
    glow: "color-mix(in oklab, #ef4444 75%, transparent)",
    badgeGradient: "from-rose-500 to-red-700",
    icon: "🔺", color: "#ef4444", textClass: "text-rose-400",
  },
  {
    key: "sapphire", label: "Sapphire", minLevel: 40, maxLevel: 44,
    ringGradient: "from-blue-400 via-indigo-500 to-blue-800",
    glow: "color-mix(in oklab, #3b82f6 80%, transparent)",
    badgeGradient: "from-blue-500 to-indigo-700",
    icon: "🔷", color: "#3b82f6", textClass: "text-blue-300",
  },
  {
    key: "master", label: "Master", minLevel: 45, maxLevel: 49,
    ringGradient: "from-fuchsia-400 via-violet-500 to-purple-700",
    glow: "color-mix(in oklab, #a855f7 75%, transparent)",
    badgeGradient: "from-fuchsia-500 to-violet-700",
    icon: "✦", color: "#c084fc", textClass: "text-fuchsia-300",
  },
  {
    key: "grandmaster", label: "Grandmaster", minLevel: 50, maxLevel: 54,
    ringGradient: "from-purple-400 via-fuchsia-500 to-purple-800",
    glow: "color-mix(in oklab, #a21caf 80%, transparent)",
    badgeGradient: "from-purple-500 to-fuchsia-700",
    icon: "❖", color: "#a855f7", textClass: "text-purple-300",
  },
  {
    key: "elite", label: "Elite", minLevel: 55, maxLevel: 59,
    ringGradient: "from-rose-500 via-red-600 to-rose-900",
    glow: "color-mix(in oklab, #dc2626 80%, transparent)",
    badgeGradient: "from-rose-600 to-red-800",
    icon: "⚔️", color: "#dc2626", textClass: "text-rose-400",
  },
  {
    key: "champion", label: "Champion", minLevel: 60, maxLevel: 64,
    ringGradient: "from-amber-400 via-orange-500 to-amber-700",
    glow: "color-mix(in oklab, #ea580c 80%, transparent)",
    badgeGradient: "from-amber-500 to-orange-700",
    icon: "🏆", color: "#f97316", textClass: "text-orange-300",
  },
  {
    key: "legend", label: "Legend", minLevel: 65, maxLevel: 69,
    ringGradient: "from-yellow-300 via-amber-400 to-yellow-600",
    glow: "color-mix(in oklab, #eab308 85%, transparent)",
    badgeGradient: "from-yellow-400 to-amber-600",
    icon: "🌟", color: "#eab308", textClass: "text-yellow-300",
  },
  {
    key: "legendary", label: "Legendary", minLevel: 70, maxLevel: 74,
    ringGradient: "from-pink-400 via-rose-500 to-pink-800",
    glow: "color-mix(in oklab, #ec4899 80%, transparent)",
    badgeGradient: "from-pink-500 to-rose-700",
    icon: "💫", color: "#ec4899", textClass: "text-pink-300",
  },
  {
    key: "mythic", label: "Mythic", minLevel: 75, maxLevel: 79,
    ringGradient: "from-teal-300 via-cyan-400 to-teal-700",
    glow: "color-mix(in oklab, #14b8a6 85%, transparent)",
    badgeGradient: "from-teal-400 to-cyan-600",
    icon: "🧿", color: "#14b8a6", textClass: "text-teal-300",
  },
  {
    key: "divine", label: "Divine", minLevel: 80, maxLevel: 84,
    ringGradient: "from-slate-100 via-white to-slate-300",
    glow: "color-mix(in oklab, #f8fafc 85%, transparent)",
    badgeGradient: "from-slate-100 to-slate-400",
    icon: "☀️", color: "#f8fafc", textClass: "text-white",
  },
  {
    key: "supreme", label: "Supreme", minLevel: 85, maxLevel: 89,
    ringGradient: "from-sky-300 via-blue-500 to-indigo-700",
    glow: "color-mix(in oklab, #0ea5e9 85%, transparent)",
    badgeGradient: "from-sky-400 to-indigo-700",
    icon: "⚡", color: "#0ea5e9", textClass: "text-sky-300",
  },
  {
    key: "celestial", label: "Celestial", minLevel: 90, maxLevel: 94,
    ringGradient: "from-violet-400 via-purple-500 to-violet-800",
    glow: "color-mix(in oklab, #8b5cf6 90%, transparent)",
    badgeGradient: "from-violet-500 to-purple-800",
    icon: "🌌", color: "#8b5cf6", textClass: "text-violet-300",
  },
  {
    key: "eternal", label: "Eternal", minLevel: 95, maxLevel: 9999,
    ringGradient: "from-amber-300 via-rose-500 to-fuchsia-600",
    glow: "color-mix(in oklab, #f43f5e 95%, transparent)",
    badgeGradient: "from-amber-400 via-rose-500 to-fuchsia-600",
    icon: "🔥", color: "#f43f5e", textClass: "text-amber-300",
  },
];

export function tierForLevel(level: number): LevelTier {
  const lvl = Math.max(0, Math.floor(level || 0));
  return (
    LEVEL_TIERS.find((t) => lvl >= t.minLevel && lvl <= t.maxLevel) ??
    LEVEL_TIERS[0]
  );
}

// XP needed to reach the next level (simple curve).
export function xpForNextLevel(level: number): number {
  return 100 * (Math.max(0, Math.floor(level)) + 1);
}

export function levelProgress(level: number, xp: number) {
  const need = xpForNextLevel(level);
  const have = Math.max(0, Math.min(need, xp));
  return { have, need, pct: Math.round((have / need) * 100) };
}
