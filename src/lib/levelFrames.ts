// Auto-unlock DP frames by VIP level.
// 10 series × 10 levels each — mirrors the Jalwa Level 1–100 DP Frame Collection.
export type LevelFrameSeries = {
  minLevel: number;
  maxLevel: number;
  series: string;
  label: string;
  url: string;
};

const A = (path: string) =>
  `https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app${path}`;

export const LEVEL_FRAME_SERIES: LevelFrameSeries[] = [
  { minLevel: 1,  maxLevel: 10,  series: "Celestial",       label: "Bronze to Gold",
    url: A("/__l5e/assets-v1/7ad6870c-e5aa-41b1-976c-c42e4d9e9cb9/frame-jalwa-celestial.png") },
  { minLevel: 11, maxLevel: 20,  series: "Dragon",          label: "Silver Dragon Power",
    url: A("/__l5e/assets-v1/c63402c5-6fc3-4a69-91d7-2ec36d705a42/frame-jalwa-dragon.png") },
  { minLevel: 21, maxLevel: 30,  series: "Phoenix",         label: "Phoenix Fire Rebirth",
    url: A("/__l5e/assets-v1/da785a22-626a-4be0-a19a-14e30119dcfc/frame-jalwa-phoenix.png") },
  { minLevel: 31, maxLevel: 40,  series: "Lion King",       label: "Royal Lion Strength",
    url: A("/__l5e/assets-v1/842e4787-9afa-419b-a443-80551d2b0c7f/frame-jalwa-lion.png") },
  { minLevel: 41, maxLevel: 50,  series: "Ocean King",      label: "Sapphire Ocean Power",
    url: A("/__l5e/assets-v1/77bdeb20-1485-4fcd-8a17-73b87d2ba46f/frame-jalwa-ocean.png") },
  { minLevel: 51, maxLevel: 60,  series: "Galaxy",          label: "Cosmic Galaxy Energy",
    url: A("/__l5e/assets-v1/b17e3a01-7814-4204-a083-afeb8b4b2b30/frame-jalwa-galaxy.png") },
  { minLevel: 61, maxLevel: 70,  series: "Diamond Emperor", label: "Pure Diamond Dominance",
    url: A("/__l5e/assets-v1/56f76fc2-ec67-42b2-9e55-35bba58ce59c/frame-jalwa-diamond.png") },
  { minLevel: 71, maxLevel: 80,  series: "Royal Palace",    label: "Royal Palace Luxury",
    url: A("/__l5e/assets-v1/c030c804-c4ff-4d59-b21a-5828122b5f71/frame-jalwa-palace.png") },
  { minLevel: 81, maxLevel: 90,  series: "Legend King",     label: "Legendary King Power",
    url: A("/__l5e/assets-v1/0c508985-d369-41e2-a097-38dd814f697b/frame-jalwa-legend.png") },
  { minLevel: 91, maxLevel: 100, series: "CEO Emperor",     label: "Black & Gold Emperor",
    url: A("/__l5e/assets-v1/930b55a4-747b-40d4-8e2a-3da42391554f/frame-jalwa-ceo.png") },
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
