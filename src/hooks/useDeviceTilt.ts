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

    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma = left/right tilt (-90..90), beta = front/back (-180..180)
      const g = e.gamma ?? 0;
      const b = (e.beta ?? 0) - 40; // rest position ~40deg when holding phone
      setTilt({
        ry: clamp(g * 0.9, maxDeg),
        rx: clamp(-b * 0.5, maxDeg * 0.6),
        active: true,
      });
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
        window.removeEventListener("touchend", requestOnce);
        window.removeEventListener("click", requestOnce);
      };
      window.addEventListener("touchend", requestOnce, { once: true });
      window.addEventListener("click", requestOnce, { once: true });
    } else {
      attach();
    }

    return () => window.removeEventListener("deviceorientation", onOrient, true);
  }, [maxDeg]);

  return tilt;
}
