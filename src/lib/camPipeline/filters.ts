/**
 * Filter presets — pure canvas 2D `ctx.filter` strings.
 * Zero ML models, GPU-accelerated on all Chromium browsers (Android + iOS 15+).
 *
 * NOTE: The "AI prompt" descriptions provided by product are creative briefs;
 * we approximate each look with canvas filter primitives (brightness/contrast/
 * saturate/sepia/hue-rotate/blur). No real ML inference runs.
 */

export type FilterCategory = "beauty" | "makeup" | "funny" | "ar";

export interface FilterPreset {
  id: string;
  label: string;
  emoji: string;
  category: FilterCategory;
  /** Canvas 2D filter string applied to source video. */
  filter: string;
}

export const FILTERS: FilterPreset[] = [
  // ── Beauty ──────────────────────────────────────────────
  { id: "none",             label: "Original",        emoji: "🚫", category: "beauty", filter: "none" },
  { id: "natural-beauty",   label: "Natural Beauty",  emoji: "🌿", category: "beauty", filter: "brightness(1.06) contrast(1.04) saturate(1.08) blur(0.3px)" },
  { id: "glass-skin",       label: "Glass Skin",      emoji: "💎", category: "beauty", filter: "brightness(1.1) contrast(1.05) saturate(1.12) hue-rotate(-4deg) blur(0.5px)" },
  { id: "luxury-glow",      label: "Luxury Glow",     emoji: "✨", category: "beauty", filter: "brightness(1.12) saturate(1.25) sepia(0.12) contrast(1.06)" },
  { id: "studio-portrait",  label: "Studio Portrait", emoji: "📸", category: "beauty", filter: "brightness(1.08) contrast(1.15) saturate(1.05)" },
  { id: "hollywood",        label: "Hollywood",       emoji: "🎬", category: "beauty", filter: "contrast(1.2) saturate(1.15) brightness(1.05) sepia(0.08)" },
  { id: "bright-eyes",      label: "Bright Eyes",     emoji: "👁", category: "beauty", filter: "brightness(1.1) contrast(1.12) saturate(1.1)" },
  { id: "white-tone",       label: "Soft White",      emoji: "🤍", category: "beauty", filter: "brightness(1.15) saturate(0.95) contrast(1.02)" },
  { id: "baby-face",        label: "Baby Face",       emoji: "👶", category: "beauty", filter: "brightness(1.1) saturate(1.1) contrast(0.98) blur(0.5px)" },
  { id: "smooth-skin",      label: "Smooth Skin",     emoji: "🌸", category: "beauty", filter: "brightness(1.06) saturate(1.05) blur(0.7px) contrast(1.02)" },
  { id: "portrait-hdr",     label: "Portrait HDR",    emoji: "📷", category: "beauty", filter: "contrast(1.25) saturate(1.2) brightness(1.05)" },

  // ── Makeup ──────────────────────────────────────────────
  { id: "soft-makeup",      label: "Soft Makeup",     emoji: "💄", category: "makeup", filter: "brightness(1.08) saturate(1.2) contrast(1.05) hue-rotate(-3deg)" },
  { id: "bridal",           label: "Bridal",          emoji: "👰", category: "makeup", filter: "brightness(1.12) saturate(1.15) sepia(0.1) contrast(1.06)" },
  { id: "lipstick",         label: "Lipstick",        emoji: "💋", category: "makeup", filter: "saturate(1.3) contrast(1.08) brightness(1.03) hue-rotate(-6deg)" },
  { id: "pink-blush",       label: "Pink Blush",      emoji: "🌸", category: "makeup", filter: "saturate(1.25) brightness(1.08) hue-rotate(-8deg) contrast(1.04)" },
  { id: "smokey-eyes",      label: "Smokey Eyes",     emoji: "👁", category: "makeup", filter: "contrast(1.2) saturate(1.1) brightness(0.98)" },
  { id: "eyelashes",        label: "Eyelashes",       emoji: "✨", category: "makeup", filter: "contrast(1.12) brightness(1.05) saturate(1.1)" },
  { id: "contour",          label: "Contour",         emoji: "🌹", category: "makeup", filter: "contrast(1.18) saturate(1.15) brightness(1.02) sepia(0.05)" },
  { id: "celebrity",        label: "Celebrity",       emoji: "⭐", category: "makeup", filter: "contrast(1.22) saturate(1.2) brightness(1.06) sepia(0.06)" },
  { id: "influencer",       label: "Influencer",      emoji: "👑", category: "makeup", filter: "brightness(1.1) saturate(1.3) sepia(0.15) contrast(1.08)" },
  { id: "perfect-selfie",   label: "Perfect Selfie",  emoji: "📱", category: "makeup", filter: "brightness(1.1) contrast(1.12) saturate(1.15)" },
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
