const LOVABLE_ORIGIN = "https://cloud-to-soul.lovable.app";

const LOCAL_GIFT_FILENAMES = new Set([
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

const preloadedVideos = new Set<string>();

export function absolutizeLovableAsset(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ORIGIN}${url}`;
  return url;
}

export function resolvePlayableGiftUrl(url: string | null | undefined) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0]?.split("#")[0] ?? url;
  const filename = cleanUrl.split("/").pop();
  if (filename) {
    const base = filename.replace(/\.(mp4|webm)$/i, "");
    if (LOCAL_GIFT_FILENAMES.has(base)) return `/gifts/${base}.webm`;
  }
  return absolutizeLovableAsset(url);
}

export function preloadGiftVideo(url: string | null | undefined) {
  const src = resolvePlayableGiftUrl(url);
  if (!src || preloadedVideos.has(src) || typeof document === "undefined") return;
  preloadedVideos.add(src);

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = src;
  document.head.appendChild(link);

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = src;
  video.load();
}