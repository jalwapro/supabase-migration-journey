import { useEffect } from "react";

/**
 * Keeps the mobile screen awake while the app is in the foreground.
 * Silently no-ops on browsers without the Screen Wake Lock API.
 * Improved reliability by attempting to acquire on user interaction.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const anyNav = navigator as any;
    if (!anyNav.wakeLock || typeof anyNav.wakeLock.request !== "function") return;

    let sentinel: any = null;
    let cancelled = false;

    const acquire = async () => {
      if (sentinel || cancelled) return;
      try {
        const s = await anyNav.wakeLock.request("screen");
        if (cancelled) {
          s.release?.();
          return;
        }
        sentinel = s;
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
        });
        console.log("[useWakeLock] Screen Wake Lock acquired");
      } catch (err) {
        // May fail if no user gesture has occurred yet or if battery is low
        console.debug("[useWakeLock] Failed to acquire:", err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    const onInteraction = () => {
      acquire();
      // Keep listeners until we successfully acquire or unmount
      if (sentinel) {
        window.removeEventListener("pointerdown", onInteraction);
        window.removeEventListener("keydown", onInteraction);
      }
    };

    // Initial attempt
    acquire();

    // Re-acquire on visibility change
    document.addEventListener("visibilitychange", onVisibility);
    
    // Attempt on interaction in case initial attempt failed due to lack of gesture
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction, { passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      if (sentinel) {
        sentinel.release?.().catch(() => {});
        sentinel = null;
      }
    };
  }, []);
}
