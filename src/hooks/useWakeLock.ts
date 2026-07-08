import { useEffect } from "react";

/**
 * Keeps the mobile screen awake while the app is in the foreground.
 * Silently no-ops on browsers without the Screen Wake Lock API.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const anyNav = navigator as any;
    if (!anyNav.wakeLock || typeof anyNav.wakeLock.request !== "function") return;

    let sentinel: any = null;
    let cancelled = false;

    const acquire = async () => {
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
      } catch {
        /* user gesture may be required; ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release?.().catch(() => {});
      sentinel = null;
    };
  }, []);
}
