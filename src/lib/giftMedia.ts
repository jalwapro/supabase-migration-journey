const LOVABLE_ORIGIN = "https://cloud-to-soul.lovable.app";

const LOCAL_GIFT_FILENAMES = new Set([
  "jalwa-billionaire-empire",
  "jalwa-crystal-piano",
  "jalwa-diamond-fountain",
  "jalwa-diamond-necklace",
  "jalwa-diamond-safe",
  "jalwa-diamond-watch",
  
  "jalwa-ferrari",
  "jalwa-floating-luxury-island",
  "jalwa-gold-bar",
  "jalwa-golden-palace",
  "jalwa-golden-peacock",
  "jalwa-lamborghini",
  "jalwa-luxury-perfume",
  "jalwa-luxury-sports-car",
  "jalwa-luxury-villa",
  "jalwa-millionaire-mansion",
  "jalwa-premium-handbag",
  "jalwa-private-helicopter",
  "jalwa-private-jet",
  "jalwa-rolls-royce-phantom",
  "jalwa-royal-ballroom",
  "jalwa-royal-crown",
  "jalwa-super-yacht",
  "jalwa-treasure-chest",
  "jalwa-white-stallion",
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