import { useEffect, useState } from "react";

/**
 * Device-tilt hook — returns rotateX/rotateY (deg) based on phone orientation.
 * Falls back to an idle sway on desktop / when sensors are unavailable.
 * iOS: on the first user tap it requests DeviceOrientationEvent permission.
 */
export function useDeviceTilt(maxDeg = 22) {
  const [tilt, setTilt] = useState<{ rx: number; ry: number; active: boolean }>({
    rx: 0,
    ry: 0,
    active: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    let baseBeta: number | null = null;
    let baseGamma: number | null = null;
    let raf = 0;
    let lastTs = 0;
    let lastTilt = { rx: 0, ry: 0, active: false };

    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma !== "number" && typeof e.beta !== "number") return;

      // gamma = left/right tilt (-90..90), beta = front/back (-180..180)
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;

      if (baseGamma === null) baseGamma = gamma;
      if (baseBeta === null) baseBeta = beta;

      const deltaGamma = gamma - baseGamma;
      const deltaBeta = baseBeta - beta;
      const nextTilt = {
        ry: clamp(deltaGamma * 1.15, maxDeg),
        rx: clamp(deltaBeta * 0.8, maxDeg * 0.75),
        active: Math.abs(deltaGamma) > 1.5 || Math.abs(deltaBeta) > 1.5,
      };

      const now = performance.now();
      const changedEnough =
        Math.abs(nextTilt.rx - lastTilt.rx) > 0.65 ||
        Math.abs(nextTilt.ry - lastTilt.ry) > 0.65 ||
        nextTilt.active !== lastTilt.active;

      if (!changedEnough || now - lastTs < 70) return;

      lastTs = now;
      lastTilt = nextTilt;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTilt(nextTilt));
    };

    const attach = () => window.addEventListener("deviceorientation", onOrient, true);

    const AnyDOE: any = (window as any).DeviceOrientationEvent;
    if (AnyDOE && typeof AnyDOE.requestPermission === "function") {
      // iOS: needs a user gesture. Wire it once.
      const requestOnce = async () => {
        try {
          const state = await AnyDOE.requestPermission();
          if (state === "granted") attach();
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointerdown", requestOnce);
      };
      window.addEventListener("pointerdown", requestOnce, { once: true, passive: true });
    } else {
      attach();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onOrient, true);
    };
  }, [maxDeg]);

  return tilt;
}
