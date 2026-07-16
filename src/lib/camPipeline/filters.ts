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

  // ── Funny ──────────────────────────────────────────────
  { id: "puppy",            label: "Puppy",           emoji: "🐶", category: "funny", filter: "brightness(1.08) saturate(1.15) sepia(0.15) contrast(1.05)" },
  { id: "cat",              label: "Cat",             emoji: "🐱", category: "funny", filter: "brightness(1.1) saturate(1.2) hue-rotate(-8deg) contrast(1.05)" },
  { id: "bunny",            label: "Bunny",           emoji: "🐰", category: "funny", filter: "brightness(1.15) saturate(1.1) contrast(1.02) blur(0.3px)" },
  { id: "panda",            label: "Panda",           emoji: "🐼", category: "funny", filter: "contrast(1.2) saturate(0.85) brightness(1.05)" },
  { id: "monkey",           label: "Monkey",          emoji: "🙈", category: "funny", filter: "brightness(1.05) sepia(0.25) saturate(1.1) contrast(1.08)" },
  { id: "dinosaur",         label: "Dinosaur",        emoji: "🦖", category: "funny", filter: "contrast(1.25) saturate(1.3) hue-rotate(60deg) brightness(0.95)" },
  { id: "alien",            label: "Alien",           emoji: "👽", category: "funny", filter: "hue-rotate(90deg) saturate(1.6) brightness(1.05) contrast(1.15)" },
  { id: "fat-face",         label: "Fat Face",        emoji: "😂", category: "funny", filter: "brightness(1.08) saturate(1.15) contrast(1.05)" },
  { id: "tiny-face",        label: "Tiny Face",       emoji: "🤣", category: "funny", filter: "brightness(1.1) saturate(1.2) contrast(1.08)" },
  { id: "big-eyes",         label: "Big Eyes",        emoji: "👀", category: "funny", filter: "brightness(1.12) contrast(1.15) saturate(1.25)" },

  // ── AR Effects ─────────────────────────────────────────
  { id: "butterfly",        label: "Butterfly",       emoji: "🦋", category: "ar", filter: "brightness(1.1) saturate(1.25) hue-rotate(-10deg) contrast(1.05)" },
  { id: "angel",            label: "Angel Aura",      emoji: "👼", category: "ar", filter: "brightness(1.2) saturate(0.9) contrast(1.05) sepia(0.1)" },
  { id: "devil",            label: "Devil Mode",      emoji: "😈", category: "ar", filter: "contrast(1.3) saturate(1.4) hue-rotate(-15deg) brightness(0.9)" },
  { id: "fire-aura",        label: "Fire Aura",       emoji: "🔥", category: "ar", filter: "saturate(1.5) hue-rotate(-20deg) brightness(1.1) contrast(1.15)" },
  { id: "ice-kingdom",      label: "Ice Kingdom",     emoji: "❄️", category: "ar", filter: "hue-rotate(180deg) saturate(1.2) brightness(1.15) contrast(1.05)" },
  { id: "galaxy",           label: "Galaxy Portal",   emoji: "🌌", category: "ar", filter: "hue-rotate(240deg) saturate(1.4) brightness(0.95) contrast(1.2)" },
  { id: "magic-wizard",     label: "Magic Wizard",    emoji: "✨", category: "ar", filter: "hue-rotate(210deg) saturate(1.3) brightness(1.1) contrast(1.1)" },
  { id: "laser-eyes",       label: "Laser Eyes",      emoji: "⚡", category: "ar", filter: "hue-rotate(190deg) saturate(1.5) brightness(1.15) contrast(1.2)" },
  { id: "neon-rgb",         label: "Neon RGB",        emoji: "🌈", category: "ar", filter: "saturate(1.8) hue-rotate(-25deg) brightness(1.08) contrast(1.15)" },
  { id: "golden-crown",     label: "Golden Crown",    emoji: "👑", category: "ar", filter: "sepia(0.3) saturate(1.4) brightness(1.12) contrast(1.08)" },
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
