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

// ============================================================
// Jalwa audio — chhoti awaz sirf coin-drop; premium gifts ke liye
// sirf real sample sound (DB soundUrl). Jab sample na ho to ek
// unique "Jalwa signature" chime bajta hai (3 golden notes +
// shimmer tail) — yehi Jalwa ki apni pehchan hai, baaki kisi
// Chinese platform pe nahi milegi.
// ============================================================

/** Coin-drop jingle: chhote gifts ke liye. */
export function playCoinsCue(volume = 0.6) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.01;
    const drops = 6;
    for (let i = 0; i < drops; i++) {
      const t = t0 + i * 0.045 + Math.random() * 0.015;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const f = 2000 + Math.random() * 1800;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.15);
    }
    setTimeout(() => { try { master.disconnect(); } catch { /* noop */ } }, 900);
    return true;
  } catch {
    return false;
  }
}

/** Soft magical gift whoosh + twinkle — TikTok-style landing cue.
 *  Sirf ek short "pfft-twinkle" jo har flyer landing pe smooth lagay,
 *  coin-drop jaisi nahi. */
export function playGiftWhooshCue(volume = 0.55) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.005;

    // 1) Soft airy whoosh (filtered noise sweep, very short).
    const bufSize = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1600, t0);
    bp.frequency.exponentialRampToValueAtTime(4200, t0 + 0.16);
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    noise.connect(bp).connect(ng).connect(master);
    noise.start(t0);
    noise.stop(t0 + 0.2);

    // 2) Twinkle bell on top (two high sine notes, ascending).
    const notes = [1760, 2637]; // A6, E7
    notes.forEach((f, i) => {
      const t = t0 + 0.03 + i * 0.05;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.24);
    });

    setTimeout(() => { try { master.disconnect(); } catch { /* noop */ } }, 500);
    return true;
  } catch {
    return false;
  }
}

/** Jalwa signature chime — 3 golden ascending notes + shimmer.
 *  Sirf tab bajta hai jab gift ke pass real soundUrl na ho. */
export function playJalwaSignature(volume = 0.6) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.02;
    // Golden signature: C6, E6, G6 arpeggio with sine + soft saw layer.
    const notes = [1046.5, 1318.5, 1568.0];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.11;
      const sine = ctx.createOscillator();
      sine.type = "sine";
      sine.frequency.value = f;
      const saw = ctx.createOscillator();
      saw.type = "triangle";
      saw.frequency.value = f * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      sine.connect(g);
      const sg = ctx.createGain();
      sg.gain.value = 0.15;
      saw.connect(sg).connect(g);
      g.connect(master);
      sine.start(t); sine.stop(t + 0.95);
      saw.start(t); saw.stop(t + 0.95);
    });
    // Shimmer tail
    for (let i = 0; i < 6; i++) {
      const t = t0 + 0.35 + i * 0.05;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 2500 + Math.random() * 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g).connect(master);
      osc.start(t); osc.stop(t + 0.32);
    }
    setTimeout(() => { try { master.disconnect(); } catch { /* noop */ } }, 1800);
    return true;
  } catch {
    return false;
  }
}

/** Backward-compat shim: ab koi fake gift-name synth nahi bajta.
 *  Coins name aaye to coin-drop, warna Jalwa signature. */
export function playGiftSynthCue(giftName: string | null | undefined, volume = 1) {
  const n = (giftName ?? "").toLowerCase();
  if (/coin|money|cash|jingle/.test(n)) return playCoinsCue(volume);
  return playJalwaSignature(volume);
}

/** Real gift sound only: DB soundUrl bajao. Agar nahi hai, aur
 *  premium=true, to Jalwa signature chime; warna silent (chhota
 *  gift ka apna coin-drop already flyer landing pe bajta hai). */
export function playGiftAudioCue({
  soundUrl,
  giftName: _giftName,
  volume = 1,
  premium = false,
}: {
  soundUrl?: string | null;
  giftName?: string | null;
  volume?: number;
  premium?: boolean;
}) {
  const safeVolume = Math.max(0, Math.min(1, volume));
  if (safeVolume <= 0) return false;
  unlockGiftAudio();
  const src = resolveGiftSoundUrl(soundUrl);
  if (src) {
    try {
      const audio = new Audio(src);
      audio.crossOrigin = "anonymous";
      audio.volume = safeVolume;
      void audio.play().catch(() => {
        if (premium) playJalwaSignature(safeVolume);
      });
      return true;
    } catch {
      if (premium) return playJalwaSignature(safeVolume);
      return false;
    }
  }
  if (premium) return playJalwaSignature(safeVolume);
  return false;
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
