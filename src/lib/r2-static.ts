/**
 * Static assets served from Cloudflare R2 — the single storage provider for
 * every binary in the app. Nothing ships from the local bundle.
 */
const R2_BASE = "https://pub-788f85351d2748f4911a8c6d85d011af.r2.dev/static";

export const r2Static = (path: string) => `${R2_BASE}/${path.replace(/^\//, "")}`;

export const JALWA_LOGO = r2Static("jalwa-logo.png");

export const R2_BACKGROUNDS = {
  beach: r2Static("backgrounds/beach.jpg"),
  cafe: r2Static("backgrounds/cafe.jpg"),
  forest: r2Static("backgrounds/forest.jpg"),
  galaxy: r2Static("backgrounds/galaxy.jpg"),
  neon: r2Static("backgrounds/neon.jpg"),
  palace: r2Static("backgrounds/palace.jpg"),
  sunset: r2Static("backgrounds/sunset.jpg"),
} as const;
