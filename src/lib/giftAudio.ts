import { useEffect, useState } from "react";

const KEY = "jalwa:gift-audio";
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";

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

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new Ctx();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function resolveGiftSoundUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ASSET_ORIGIN}${url}`;
  return url;
}

export function unlockGiftAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
    return true;
  } catch {
    return false;
  }
}

function pickCue(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  if (/lion|dragon|tiger|king/.test(n)) return { notes: [98, 73, 55], type: "sawtooth" as OscillatorType, gain: 0.32, step: 0.18 };
  if (/car|ferrari|jet|rocket|spaceship|yacht/.test(n)) return { notes: [220, 330, 660, 990], type: "sawtooth" as OscillatorType, gain: 0.24, step: 0.08 };
  if (/money|coin|diamond|crown|palace/.test(n)) return { notes: [1318, 1568, 2093, 2637], type: "triangle" as OscillatorType, gain: 0.22, step: 0.07 };
  if (/heart|rose|kiss|love/.test(n)) return { notes: [523, 659, 784, 1046], type: "sine" as OscillatorType, gain: 0.2, step: 0.1 };
  if (/fire|party|music|dj|star/.test(n)) return { notes: [440, 880, 1320, 1760], type: "square" as OscillatorType, gain: 0.16, step: 0.075 };
  return { notes: [880, 1175, 1568, 2093], type: "sine" as OscillatorType, gain: 0.2, step: 0.07 };
}

export function playGiftSynthCue(giftName: string | null | undefined, volume = 1) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const cue = pickCue(giftName);
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);
    const now = ctx.currentTime;
    cue.notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cue.type;
      osc.frequency.setValueAtTime(freq, now + index * cue.step);
      gain.gain.setValueAtTime(0.0001, now + index * cue.step);
      gain.gain.exponentialRampToValueAtTime(cue.gain, now + index * cue.step + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * cue.step + 0.42);
      osc.connect(gain).connect(master);
      osc.start(now + index * cue.step);
      osc.stop(now + index * cue.step + 0.5);
    });
    setTimeout(() => {
      try { master.disconnect(); } catch { /* noop */ }
    }, 1200);
    return true;
  } catch {
    return false;
  }
}

export function playGiftAudioCue({
  soundUrl,
  giftName,
  volume = 1,
}: {
  soundUrl?: string | null;
  giftName?: string | null;
  volume?: number;
}) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  if (safeVolume <= 0) return false;
  unlockGiftAudio();
  const src = resolveGiftSoundUrl(soundUrl);
  if (!src) return playGiftSynthCue(giftName, safeVolume);
  try {
    const audio = new Audio(src);
    audio.volume = safeVolume;
    void audio.play().catch(() => {
      playGiftSynthCue(giftName, safeVolume);
    });
    return true;
  } catch {
    return playGiftSynthCue(giftName, safeVolume);
  }
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
