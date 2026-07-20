import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark";
const KEY = "jalwa_theme_mode";

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* no-op */
  }
  return "dark";
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.style.colorScheme = mode;
}

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(() => getInitialThemeMode());

  useEffect(() => {
    applyThemeMode(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* no-op */
    }
    // notify other tabs / listeners
    window.dispatchEvent(new CustomEvent("jalwa:theme-mode", { detail: mode }));
  }, [mode]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ThemeMode>).detail;
      if (detail === "light" || detail === "dark") setModeState(detail);
    };
    window.addEventListener("jalwa:theme-mode", onChange);
    return () => window.removeEventListener("jalwa:theme-mode", onChange);
  }, []);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggle = useCallback(
    () => setModeState((m) => (m === "dark" ? "light" : "dark")),
    [],
  );

  return { mode, setMode, toggle };
}
