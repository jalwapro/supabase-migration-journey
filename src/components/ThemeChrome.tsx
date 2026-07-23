import { useEffect } from "react";

/**
 * Syncs the mobile chrome (browser theme-color meta + Capacitor
 * Android status/nav bar) with the user's active theme. Reads the
 * computed `--primary` and `--background` from <body> (set by
 * ThemeBackground / useThemeMode) and pushes them to native.
 */
function toHex(color: string): string | null {
  if (!color) return null;
  const c = color.trim();
  if (c.startsWith("#")) return c;
  const m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map((x) => x.trim());
    const [r, g, b] = parts.map((x) => parseFloat(x));
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    const h = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }
  // hsl(...) or oklch(...): render via a hidden div to resolve
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.style.color = c;
    el.style.display = "none";
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return toHex(rgb);
  }
  return null;
}

export function ThemeChrome() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    let disposed = false;

    const apply = async () => {
      const bodyStyles = getComputedStyle(document.body);
      const primaryVar = bodyStyles.getPropertyValue("--primary").trim();
      const bgVar = bodyStyles.getPropertyValue("--background").trim();
      const primary = toHex(primaryVar ? `hsl(${primaryVar})` : "") || toHex(primaryVar);
      const bg = toHex(bgVar ? `hsl(${bgVar})` : "") || toHex(bgVar);
      const chrome = primary || bg || "#1a0d2e";

      // <meta name="theme-color"> — updates address bar / PWA chrome
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = chrome;

      // Capacitor: status + navigation bar tint on Android/iOS
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform() || disposed) return;
        const isLight = document.documentElement.classList.contains("light");
        const [{ StatusBar, Style }] = await Promise.all([
          import("@capacitor/status-bar"),
        ]);
        await StatusBar.setBackgroundColor({ color: chrome }).catch(() => {});
        await StatusBar.setStyle({
          style: isLight ? Style.Light : Style.Dark,
        }).catch(() => {});
        // Android navigation bar tint requires an additional plugin
        // (e.g. @capgo/capacitor-navigation-bar). Install it and it will
        // be picked up here; skipped by default to keep the bundle lean.
      } catch {
        /* not native */
      }
    };

    void apply();

    // Watch for theme mode + shop-theme changes
    const onMode = () => void apply();
    window.addEventListener("jalwa:theme-mode", onMode);

    const obs = new MutationObserver(() => void apply());
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      disposed = true;
      window.removeEventListener("jalwa:theme-mode", onMode);
      obs.disconnect();
    };
  }, []);

  return null;
}
