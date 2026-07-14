/**
 * Filter presets — pure canvas 2D `ctx.filter` strings.
 * Zero ML models, GPU-accelerated on all Chromium browsers (Android + iOS 15+).
 */

export interface FilterPreset {
  id: string;
  label: string;
  emoji: string;
  /** Canvas 2D filter string applied to source video. */
  filter: string;
}

export const FILTERS: FilterPreset[] = [
  { id: "none",    label: "Original", emoji: "🚫", filter: "none" },
  { id: "warm",    label: "Warm",     emoji: "🔥", filter: "saturate(1.3) sepia(0.15) brightness(1.05) contrast(1.05)" },
  { id: "cool",    label: "Cool",     emoji: "❄️", filter: "saturate(1.15) hue-rotate(-12deg) brightness(1.05) contrast(1.05)" },
  { id: "vivid",   label: "Vivid",    emoji: "🌈", filter: "saturate(1.6) contrast(1.15) brightness(1.05)" },
  { id: "vintage", label: "Vintage",  emoji: "📼", filter: "sepia(0.4) saturate(0.9) contrast(1.05) brightness(0.98)" },
  { id: "sepia",   label: "Sepia",    emoji: "🏺", filter: "sepia(0.85) saturate(1.1) brightness(1.02)" },
  { id: "bw",      label: "B&W",      emoji: "⚫", filter: "grayscale(1) contrast(1.15) brightness(1.05)" },
  { id: "dream",   label: "Dreamy",   emoji: "☁️", filter: "brightness(1.12) saturate(1.1) contrast(0.92) blur(0.6px)" },
  { id: "neon",    label: "Neon",     emoji: "💜", filter: "saturate(1.8) hue-rotate(20deg) contrast(1.2) brightness(1.05)" },
  { id: "peach",   label: "Peach",    emoji: "🍑", filter: "sepia(0.25) saturate(1.4) hue-rotate(-8deg) brightness(1.08)" },
  { id: "cinema",  label: "Cinema",   emoji: "🎬", filter: "contrast(1.25) saturate(0.85) brightness(0.95) sepia(0.1)" },
  { id: "pop",     label: "Pop",      emoji: "🍭", filter: "saturate(1.9) contrast(1.1) hue-rotate(-6deg) brightness(1.06)" },
];

export const FILTER_BY_ID: Record<string, FilterPreset> = Object.fromEntries(
  FILTERS.map((f) => [f.id, f]),
);

export function buildFilterString(filterId: string, beautyOn: boolean, beautyIntensity: number): string {
  const preset = FILTER_BY_ID[filterId] ?? FILTER_BY_ID.none;
  const base = preset.filter === "none" ? "" : preset.filter;
  if (!beautyOn) return base || "none";
  const b = Math.max(0, Math.min(1, beautyIntensity));
  const beauty = `blur(${(0.4 + b * 1.6).toFixed(2)}px) brightness(${(1 + b * 0.08).toFixed(2)}) saturate(${(1 + b * 0.15).toFixed(2)}) contrast(${(1 + b * 0.04).toFixed(2)})`;
  return base ? `${base} ${beauty}` : beauty;
}
