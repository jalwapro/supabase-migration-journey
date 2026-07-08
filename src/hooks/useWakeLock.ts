import { useEffect } from "react";
import { isNative } from "@/lib/native";

/**
 * Keeps the mobile screen awake while the app is in the foreground.
 * Silently no-ops on browsers without support.
 * Uses native Capacitor keep-awake in app builds, and web Wake Lock in browsers.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof document === "undefined" || typeof navigator === "undefined") return;

    let sentinel: any = null;
    let cancelled = false;
    let pending = false;
    let nativeAwake = false;

    const acquireNative = async () => {
      if (!isNative() || nativeAwake) return false;
      try {
        const { KeepAwake } = await import("@capacitor-community/keep-awake");
        const support = await KeepAwake.isSupported().catch(() => ({ isSupported: true }));
        if (support.isSupported === false) return false;
        await KeepAwake.keepAwake();
        nativeAwake = true;
        return true;
      } catch {
        return false;
      }
    };

    const acquireWeb = async () => {
      const anyNav = navigator as any;
      if (!anyNav.wakeLock || typeof anyNav.wakeLock.request !== "function") return;
      try {
        const s = await anyNav.wakeLock.request("screen");
        if (cancelled) {
          s.release?.();
          return;
        }
        sentinel = s;
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
          if (!cancelled && document.visibilityState === "visible") void acquire();
        });
      } catch {
        /* some mobile browsers require a gesture; interaction listeners retry */
      }
    };

    const acquire = async () => {
      if (pending || cancelled || document.visibilityState !== "visible") return;
      pending = true;
      const hasNativeLock = await acquireNative();
      if (!hasNativeLock && !sentinel) await acquireWeb();
      pending = false;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    const onInteraction = () => {
      void acquire();
    };

    // Initial attempt
    acquire();

    // Re-acquire on visibility change
    document.addEventListener("visibilitychange", onVisibility);

    // Attempt on interaction in case initial attempt failed due to lack of gesture
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("touchstart", onInteraction, { passive: true });
    window.addEventListener("click", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction, { passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("click", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      if (sentinel) {
        sentinel.release?.().catch(() => {});
        sentinel = null;
      }
      if (nativeAwake) {
        void import("@capacitor-community/keep-awake")
          .then(({ KeepAwake }) => KeepAwake.allowSleep())
          .catch(() => {});
      }
    };
  }, []);
}
