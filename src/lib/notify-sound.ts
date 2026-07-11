// Small helper to play the in-app notification chime.
// Handles autoplay policies by unlocking on first user gesture.

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio("/sounds/notify.mp3");
    audio.preload = "auto";
    audio.volume = 0.7;
  }
  return audio;
}

/** Call once after any user gesture (e.g. permission click) to unlock playback. */
export function unlockNotifySound() {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  a.muted = true;
  a.play().then(() => {
    a.pause();
    a.currentTime = 0;
    a.muted = false;
    unlocked = true;
  }).catch(() => {
    // ignore; will retry on next gesture
  });
}

export function playNotifySound() {
  if (typeof document !== "undefined" && document.hidden) return;
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate?.([40, 30, 60]); } catch { /* noop */ }
  }
}
