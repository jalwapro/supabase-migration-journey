// Auto-unlock DP frames by VIP level.
// 10 series × 10 levels each — mirrors the Jalwa Level 1–100 DP Frame Collection.
// The level system decides which frame the user's avatar wears when they have
// not explicitly equipped one from the shop.

export type LevelFrameSeries = {
  minLevel: number;
  maxLevel: number;
  series: string;
  label: string;
  url: string;
};

const A = (path: string) =>
  `https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app${path}`;

// Ordered low → high so `find` picks the correct band.
export const LEVEL_FRAME_SERIES: LevelFrameSeries[] = [
  {
    minLevel: 1, maxLevel: 10, series: "Celestial",
    label: "Bronze to Gold",
    url: A("/__l5e/assets-v1/ebf3c2aa-28da-4234-b5da-aa85e261837d/frame-aura-gold.png"),
  },
  {
    minLevel: 11, maxLevel: 20, series: "Dragon",
    label: "Silver Dragon Power",
    url: A("/__l5e/assets-v1/1d2e83a4-d5be-410c-bdaf-23e941a68cfa/frame-dragon.png"),
  },
  {
    minLevel: 21, maxLevel: 30, series: "Phoenix",
    label: "Phoenix Fire Rebirth",
    url: A("/__l5e/assets-v1/53603aee-0862-4a66-bf9a-9a6ed93b20f5/frame-phoenix.png"),
  },
  {
    minLevel: 31, maxLevel: 40, series: "Lion King",
    label: "Royal Lion Strength",
    url: "/animations/frames/webm/lion-ruby.webm",
  },
  {
    minLevel: 41, maxLevel: 50, series: "Ocean King",
    label: "Sapphire Ocean Power",
    url: "/animations/frames/webm/sapphire-crown.webm",
  },
  {
    minLevel: 51, maxLevel: 60, series: "Galaxy",
    label: "Cosmic Galaxy Energy",
    url: A("/__l5e/assets-v1/35877668-ccbe-4d68-aa21-d075367d752f/frame-galaxy.png"),
  },
  {
    minLevel: 61, maxLevel: 70, series: "Diamond Emperor",
    label: "Pure Diamond Dominance",
    url: A("/__l5e/assets-v1/e5af42d5-c006-4f9b-8eb0-b7de41bbd172/frame-diamond.png"),
  },
  {
    minLevel: 71, maxLevel: 80, series: "Royal Palace",
    label: "Royal Palace Luxury",
    url: A("/__l5e/assets-v1/6ab72c1a-c1da-41cc-b6cc-872b24528d98/frame-king.png"),
  },
  {
    minLevel: 81, maxLevel: 90, series: "Legend King",
    label: "Legendary King Power",
    url: A("/__l5e/assets-v1/b17696dc-8ded-49e8-af08-95eabcd23b9e/frame-phoenix-gold.webm"),
  },
  {
    minLevel: 91, maxLevel: 100, series: "CEO Emperor",
    label: "Black & Gold Emperor",
    url: A("/__l5e/assets-v1/832baf19-ff34-4d30-9368-bd766eecc513/ceo-jalwa-v4-visible-alpha.png"),
  },
];

export function frameForLevel(level: number | null | undefined): string | null {
  const lvl = Math.floor(level ?? 0);
  if (lvl < 1) return null;
  const band = LEVEL_FRAME_SERIES.find((b) => lvl >= b.minLevel && lvl <= b.maxLevel);
  return band?.url ?? null;
}

export function seriesForLevel(level: number | null | undefined): LevelFrameSeries | null {
  const lvl = Math.floor(level ?? 0);
  if (lvl < 1) return null;
  return LEVEL_FRAME_SERIES.find((b) => lvl >= b.minLevel && lvl <= b.maxLevel) ?? null;
}
