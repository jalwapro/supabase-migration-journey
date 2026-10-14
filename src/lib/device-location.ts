import { Capacitor } from "@capacitor/core";

/**
 * Uses Capacitor's native GPS bridge inside Android/iOS and browser geolocation
 * on the web. Coordinates are returned only to the caller and are not persisted.
 */
export async function getDevicePosition(
  options: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 12000,
    maximumAge: 300000,
  },
): Promise<GeolocationPosition> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    let permission = await Geolocation.checkPermissions();
    if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
      permission = await Geolocation.requestPermissions();
    }
    if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
      const error = new Error("Please allow location access in Android app settings.") as Error & { code: number };
      error.code = 1;
      throw error;
    }
    const position = await Geolocation.getCurrentPosition(options);
    return position as unknown as GeolocationPosition;
  }

  if (!navigator.geolocation) {
    throw new Error("GPS location is not supported on this device.");
  }
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}
