// Native (Capacitor) bridge helpers. Safe to import from anywhere — falls
// back to no-ops on the web. All calls are lazy so nothing is pulled into
// the web bundle beyond a tiny detection stub.

import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform(); // "web" | "ios" | "android"

export async function initNativeShell() {
  if (!isNative()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
      import("@capacitor/app"),
    ]);

    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#1a0d2e" }).catch(() => {});
    await SplashScreen.hide().catch(() => {});

    // Android hardware back button: navigate back or minimise app at root.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp().catch(() => {});
    });
  } catch (err) {
    console.warn("Native shell init failed", err);
  }
}

export async function haptic(style: "light" | "medium" | "heavy" = "light") {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: map[style] });
  } catch {
    /* noop */
  }
}
