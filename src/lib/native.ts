// Native (Capacitor) bridge helpers. Safe to import from anywhere — falls
// back to no-ops on the web. All calls are lazy so nothing is pulled into
// the web bundle beyond a tiny detection stub.

import { Capacitor, SystemBars } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform(); // "web" | "ios" | "android"

function closeActiveOverlay() {
  const appBackEvent = new Event("jalwa:native-back", { cancelable: true });
  const shouldContinue = window.dispatchEvent(appBackEvent);
  if (!shouldContinue || appBackEvent.defaultPrevented) return true;

  const overlay = document.querySelector<HTMLElement>('[data-jalwa-overlay="true"]');
  const radix = document.querySelector(
    '[data-state="open"][role="dialog"], [data-state="open"][role="menu"], [data-radix-popper-content-wrapper]',
  );
  if (!overlay && !radix) return false;

  try {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  } catch {
    /* noop */
  }
  try {
    overlay?.click();
  } catch {
    /* noop */
  }
  return true;
}

export async function setVoiceRoomFullscreen(enabled: boolean) {
  if (!isNative()) return;

  try {
    if (enabled) {
      // VoiceRoom is a true immersive screen in the native app.
      // Hide both Android system bars so the room header/footer are not
      // covered by the phone status/navigation controls.
      await SystemBars.hide().catch(() => {});
    } else {
      // Restore normal system UI for every other screen.
      await SystemBars.show().catch(() => {});
    }
  } catch {
    /* noop */
  }
}

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

    // Android hardware/gesture Back follows normal app navigation:
    // 1) close an open popup/overlay first
    // 2) on any non-home page, navigate back but never exit the app
    // 3) on Home, require two Back presses within a short window to exit
    let lastHomeBackAt = 0;
    App.addListener("backButton", ({ canGoBack }) => {
      if (closeActiveOverlay()) return;

      const pathname = window.location.pathname.replace(/\\/+$/, "") || "/";
      const isHome = pathname === "/" || pathname === "/home";

      if (!isHome) {
        if (canGoBack || window.history.length > 1) {
          window.history.back();
        } else {
          window.location.assign("/");
        }
        return;
      }

      const now = Date.now();
      if (now - lastHomeBackAt <= 1800) {
        lastHomeBackAt = 0;
        App.exitApp().catch(() => {});
        return;
      }

      lastHomeBackAt = now;
      window.dispatchEvent(new CustomEvent("jalwa:back-to-exit-warning"));
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
