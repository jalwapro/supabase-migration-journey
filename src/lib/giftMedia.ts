// Gift asset URL resolution. Every gift asset now lives on Cloudflare R2; the
// helpers below only exist to absolutize the handful of legacy relative URLs
// that may still be in flight (cached rows, optimistic events).
const LOVABLE_ORIGIN = "https://cloud-to-soul.lovable.app";

const preloadedVideos = new Set<string>();

export function absolutizeLovableAsset(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ORIGIN}${url}`;
  return url;
}

export function isAssetUrlLike(value: string | null | undefined) {
  if (!value) return false;
  return /^(https?:|data:|blob:|\/|__l5e\/assets-v1\/)/i.test(value.trim());
}

export function resolveGiftImageUrl(url: string | null | undefined) {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;
  if (value.startsWith("__l5e/assets-v1/")) return `${LOVABLE_ORIGIN}/${value}`;
  return absolutizeLovableAsset(value);
}

/**
 * Resolve a playable (video/svga) gift URL. R2 URLs pass through untouched —
 * they are already the canonical source.
 */
export function resolvePlayableGiftUrl(url: string | null | undefined) {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;
  if (value.startsWith("__l5e/assets-v1/")) return `${LOVABLE_ORIGIN}/${value}`;
  return absolutizeLovableAsset(value);
}

/** Warm the browser/network cache for a gift clip so playback starts instantly. */
export function preloadGiftVideo(url: string | null | undefined) {
  const src = resolvePlayableGiftUrl(url);
  if (!src || preloadedVideos.has(src) || typeof document === "undefined") return;
  preloadedVideos.add(src);

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = src;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = src;
  video.load();
}

/** Warm an audio asset (gift sound) ahead of playback. */
const preloadedAudio = new Set<string>();
export function preloadGiftAudio(url: string | null | undefined) {
  const src = resolvePlayableGiftUrl(url);
  if (!src || preloadedAudio.has(src) || typeof document === "undefined") return;
  preloadedAudio.add(src);
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = src;
  audio.load();
}

/** Warm every asset for a gift row (clip + audio + thumbnail). */
export function preloadGiftAssets(gift: {
  clip_path?: string | null;
  preview_url?: string | null;
  audio_url?: string | null;
  sound_url?: string | null;
  thumb_url?: string | null;
  icon_path?: string | null;
  image_url?: string | null;
} | null | undefined) {
  if (!gift) return;
  const clip = gift.clip_path ?? gift.preview_url;
  if (clip && /\.(mp4|webm|mov)$/i.test(clip)) preloadGiftVideo(clip);
  preloadGiftAudio(gift.audio_url ?? gift.sound_url);
  const thumb = resolveGiftImageUrl(gift.thumb_url ?? gift.icon_path ?? gift.image_url);
  if (thumb && typeof Image !== "undefined") {
    const img = new Image();
    img.src = thumb;
  }
}

export function clearGiftPreloadCache() {
  preloadedVideos.clear();
  preloadedAudio.clear();
}
