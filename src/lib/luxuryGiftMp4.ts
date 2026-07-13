// Luxury gift MP4 clips are served from the app's own /public/gifts/ folder,
// so they deploy alongside the site on Vercel (or any static host) without
// needing an external CDN. Both .mp4 and .webm variants exist; we prefer
// .webm for smaller size and better looping in modern browsers.

const LUXURY_GIFT_FILENAMES = new Set([
  "jalwa-diamond-watch",
  "jalwa-luxury-perfume",
  "jalwa-gold-bar",
  "jalwa-diamond-necklace",
  "jalwa-premium-handbag",
  "jalwa-royal-crown",
  "jalwa-luxury-sports-car",
  "jalwa-lamborghini",
  "jalwa-ferrari",
  "jalwa-rolls-royce-phantom",
  "jalwa-private-helicopter",
  "jalwa-private-jet",
  "jalwa-super-yacht",
  "jalwa-luxury-villa",
  "jalwa-diamond-safe",
  "jalwa-treasure-chest",
  "jalwa-golden-peacock",
  "jalwa-white-stallion",
  "jalwa-crystal-piano",
  "jalwa-royal-ballroom",
  "jalwa-diamond-fountain",
  "jalwa-golden-palace",
  "jalwa-floating-luxury-island",
  "jalwa-millionaire-mansion",
  "jalwa-billionaire-empire",
]);

export function resolveLuxuryGiftMp4Url(url: string | null | undefined) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0]?.split("#")[0] ?? url;
  const filename = cleanUrl.split("/").pop();
  if (!filename) return url;
  const base = filename.replace(/\.(mp4|webm)$/i, "");
  if (LUXURY_GIFT_FILENAMES.has(base)) {
    return `/gifts/${base}.webm`;
  }
  return url;
}
