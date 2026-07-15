import { useEffect, useState } from "react";

const KEY = "jalwa:gift-audio";

type Prefs = { muted: boolean; volume: number };

const DEFAULTS: Prefs = { muted: false, volume: 1 };

function read(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return {
      muted: !!p.muted,
      volume: Math.max(0, Math.min(1, Number(p.volume ?? 1))),
    };
  } catch {
    return DEFAULTS;
  }
}

function write(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
  try {
    window.dispatchEvent(new CustomEvent("jalwa:gift-audio-changed", { detail: p }));
  } catch {
    /* noop */
  }
}

export function getGiftAudioPrefs(): Prefs {
  return read();
}

export function setGiftAudioMuted(muted: boolean) {
  const p = read();
  write({ ...p, muted });
}

export function setGiftAudioVolume(volume: number) {
  const p = read();
  write({ ...p, volume: Math.max(0, Math.min(1, volume)) });
}

export function useGiftAudioPrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(() => read());
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Prefs>).detail;
      if (detail) setPrefs(detail);
      else setPrefs(read());
    };
    window.addEventListener("jalwa:gift-audio-changed", handler);
    return () => window.removeEventListener("jalwa:gift-audio-changed", handler);
  }, []);
  return prefs;
}
