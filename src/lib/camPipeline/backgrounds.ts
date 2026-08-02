/**
 * Background preset registry. Combined with the segmenter, these drive
 * the background layer under the person mask.
 */

import { R2_BACKGROUNDS } from "@/lib/r2-static";

const { beach, galaxy, neon, palace, sunset, cafe, forest } = R2_BACKGROUNDS;

export type BackgroundKind = "none" | "blur" | "image";

export interface BackgroundPreset {
  id: string;
  label: string;
  emoji: string;
  kind: BackgroundKind;
  url?: string;
  /** Blur radius in pixels when kind === "blur". */
  blur?: number;
}

export const BACKGROUNDS: BackgroundPreset[] = [
  { id: "none", label: "None", emoji: "🚫", kind: "none" },
  { id: "blur-soft", label: "Blur", emoji: "🫧", kind: "blur", blur: 10 },
  { id: "blur-strong", label: "Strong Blur", emoji: "💨", kind: "blur", blur: 22 },
  { id: "beach", label: "Beach", emoji: "🏖️", kind: "image", url: beach },
  { id: "galaxy", label: "Galaxy", emoji: "🌌", kind: "image", url: galaxy },
  { id: "sunset", label: "Sunset", emoji: "🌅", kind: "image", url: sunset },
  { id: "palace", label: "Palace", emoji: "🏰", kind: "image", url: palace },
  { id: "neon", label: "Neon", emoji: "🌃", kind: "image", url: neon },
  { id: "cafe", label: "Cafe", emoji: "☕", kind: "image", url: cafe },
  { id: "forest", label: "Forest", emoji: "🌳", kind: "image", url: forest },
];

export const BG_BY_ID: Record<string, BackgroundPreset> = Object.fromEntries(
  BACKGROUNDS.map((b) => [b.id, b]),
);

const imageCache = new Map<string, HTMLImageElement>();
export function loadBgImage(url: string): HTMLImageElement {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  imageCache.set(url, img);
  return img;
}
