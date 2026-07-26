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
// Realistic per-gift sound synthesis (no TTS / no female voice)
// ============================================================

type SoundKind =
  | "roar" | "engine" | "rocket" | "coins" | "diamond" | "crown"
  | "heart" | "kiss" | "rose" | "fire" | "explosion" | "fireworks"
  | "party" | "dj" | "chime" | "sparkle" | "pop" | "whoosh"
  | "cheer" | "bell" | "horn" | "magic";

function classifyGift(name: string | null | undefined): SoundKind {
  const n = (name ?? "").toLowerCase();
  if (/lion|tiger|dragon|beast|roar/.test(n)) return "roar";
  if (/ferrari|car|bugatti|porsche|truck|bike|ducati|harley|mclaren|gwagon|cyber|f1|police/.test(n)) return "engine";
  if (/rocket|jet|spaceship|spacecraft|missile|launch/.test(n)) return "rocket";
  if (/money|coin|cash|wallet|dollar|rupee/.test(n)) return "coins";
  if (/diamond|ice|crystal|gem/.test(n)) return "diamond";
  if (/crown|king|queen|throne|palace|royal|emperor/.test(n)) return "crown";
  if (/kiss/.test(n)) return "kiss";
  if (/heart|love/.test(n)) return "heart";
  if (/rose|flower|petal|bouquet|teddy/.test(n)) return "rose";
  if (/firework|sparkler/.test(n)) return "fireworks";
  if (/bomb|boom|explos/.test(n)) return "explosion";
  if (/fire|flame|phoenix|inferno/.test(n)) return "fire";
  if (/dj|music|note|song|beat/.test(n)) return "dj";
  if (/party|confetti|balloon|cake|birthday/.test(n)) return "party";
  if (/cheer|clap|applause|like|thumb/.test(n)) return "cheer";
  if (/bell|ring/.test(n)) return "bell";
  if (/horn|trumpet/.test(n)) return "horn";
  if (/magic|wand|fairy|star|galaxy|universe|cosmic/.test(n)) return "magic";
  if (/pop|bubble/.test(n)) return "pop";
  if (/wind|wave|whoosh|storm|tornado/.test(n)) return "whoosh";
  if (/sparkle|shine|glitter|twinkle/.test(n)) return "sparkle";
  return "chime";
}

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playRoar(ctx: AudioContext, out: GainNode, t0: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 1.4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(180, t0);
  bp.frequency.exponentialRampToValueAtTime(70, t0 + 1.2);
  bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
  src.connect(bp).connect(g).connect(out);
  src.start(t0); src.stop(t0 + 1.4);
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 1.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.5, t0 + 0.1);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
  osc.connect(og).connect(out);
  osc.start(t0); osc.stop(t0 + 1.4);
}

function playEngine(ctx: AudioContext, out: GainNode, t0: number) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70, t0);
  osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.7);
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 1.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
  osc.connect(g).connect(out);
  osc.start(t0); osc.stop(t0 + 1.5);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 1.5);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 800; bp.Q.value = 0.6;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.25, t0 + 0.2);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
  noise.connect(bp).connect(ng).connect(out);
  noise.start(t0); noise.stop(t0 + 1.5);
}

function playRocket(ctx: AudioContext, out: GainNode, t0: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 1.8);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.setValueAtTime(200, t0);
  hp.frequency.exponentialRampToValueAtTime(1400, t0 + 1.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
  noise.connect(hp).connect(g).connect(out);
  noise.start(t0); noise.stop(t0 + 1.8);
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, t0);
  osc.frequency.exponentialRampToValueAtTime(1600, t0 + 1.6);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.25, t0 + 0.2);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.7);
  osc.connect(og).connect(out);
  osc.start(t0); osc.stop(t0 + 1.8);
}

function playCoins(ctx: AudioContext, out: GainNode, t0: number) {
  for (let i = 0; i < 14; i++) {
    const t = t0 + i * 0.05 + Math.random() * 0.02;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const f = 1800 + Math.random() * 1600;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.17);
  }
}

function playDiamond(ctx: AudioContext, out: GainNode, t0: number) {
  [2637, 3136, 3951, 5274].forEach((f, i) => {
    const t = t0 + i * 0.08;
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.95);
  });
}

function playCrown(ctx: AudioContext, out: GainNode, t0: number) {
  [261.6, 329.6, 392, 523.2].forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth"; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    osc.connect(g).connect(out);
    osc.start(t0); osc.stop(t0 + 1.5);
  });
}

function playHeart(ctx: AudioContext, out: GainNode, t0: number) {
  [0, 0.28].forEach((delay) => {
    const t = t0 + delay;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.3);
  });
}

function playKiss(ctx: AudioContext, out: GainNode, t0: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.25);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  noise.connect(bp).connect(g).connect(out);
  noise.start(t0); noise.stop(t0 + 0.25);
}

function playRose(ctx: AudioContext, out: GainNode, t0: number) {
  [880, 1175, 1568].forEach((f, i) => {
    const t = t0 + i * 0.12;
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.65);
  });
}

function playFire(ctx: AudioContext, out: GainNode, t0: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 1.4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  noise.connect(bp).connect(g).connect(out);
  noise.start(t0); noise.stop(t0 + 1.4);
}

function playExplosion(ctx: AudioContext, out: GainNode, t0: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 1.2);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.setValueAtTime(1200, t0);
  lp.frequency.exponentialRampToValueAtTime(120, t0 + 1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
  noise.connect(lp).connect(g).connect(out);
  noise.start(t0); noise.stop(t0 + 1.2);
}

function playFireworks(ctx: AudioContext, out: GainNode, t0: number) {
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * 0.35 + Math.random() * 0.1;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(og).connect(out);
    osc.start(t); osc.stop(t + 0.32);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, 0.3);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t + 0.28);
    ng.gain.exponentialRampToValueAtTime(0.7, t + 0.3);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(ng).connect(out);
    n.start(t + 0.28); n.stop(t + 0.6);
  }
}

function playParty(ctx: AudioContext, out: GainNode, t0: number) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
  osc.connect(g).connect(out);
  osc.start(t0); osc.stop(t0 + 0.75);
}

function playDj(ctx: AudioContext, out: GainNode, t0: number) {
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * 0.25;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.22);
  }
}

function playCheer(ctx: AudioContext, out: GainNode, t0: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 1.3);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1600; bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
  noise.connect(bp).connect(g).connect(out);
  noise.start(t0); noise.stop(t0 + 1.3);
}

function playBell(ctx: AudioContext, out: GainNode, t0: number) {
  [880, 1320, 1760].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3 / (i + 1), t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    osc.connect(g).connect(out);
    osc.start(t0); osc.stop(t0 + 1.7);
  });
}

function playHorn(ctx: AudioContext, out: GainNode, t0: number) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.setValueAtTime(330, t0 + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
  osc.connect(g).connect(out);
  osc.start(t0); osc.stop(t0 + 0.85);
}

function playMagic(ctx: AudioContext, out: GainNode, t0: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, t0);
  osc.frequency.exponentialRampToValueAtTime(3200, t0 + 0.9);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1);
  osc.connect(g).connect(out);
  osc.start(t0); osc.stop(t0 + 1.05);
}

function playPop(ctx: AudioContext, out: GainNode, t0: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, t0);
  osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
  osc.connect(g).connect(out);
  osc.start(t0); osc.stop(t0 + 0.17);
}

function playWhoosh(ctx: AudioContext, out: GainNode, t0: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 1);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, t0);
  bp.frequency.exponentialRampToValueAtTime(3000, t0 + 0.8);
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1);
  noise.connect(bp).connect(g).connect(out);
  noise.start(t0); noise.stop(t0 + 1);
}

function playSparkle(ctx: AudioContext, out: GainNode, t0: number) {
  for (let i = 0; i < 8; i++) {
    const t = t0 + i * 0.06;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 2000 + Math.random() * 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.27);
  }
}

function playChime(ctx: AudioContext, out: GainNode, t0: number) {
  [1046, 1318, 1568, 2093].forEach((f, i) => {
    const t = t0 + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.75);
  });
}

const PLAYERS: Record<SoundKind, (ctx: AudioContext, out: GainNode, t0: number) => void> = {
  roar: playRoar, engine: playEngine, rocket: playRocket, coins: playCoins,
  diamond: playDiamond, crown: playCrown, heart: playHeart, kiss: playKiss,
  rose: playRose, fire: playFire, explosion: playExplosion, fireworks: playFireworks,
  party: playParty, dj: playDj, chime: playChime, sparkle: playSparkle,
  pop: playPop, whoosh: playWhoosh, cheer: playCheer, bell: playBell,
  horn: playHorn, magic: playMagic,
};

export function playGiftSynthCue(giftName: string | null | undefined, volume = 1) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);
    const kind = classifyGift(giftName);
    (PLAYERS[kind] ?? playChime)(ctx, master, ctx.currentTime + 0.02);
    setTimeout(() => { try { master.disconnect(); } catch { /* noop */ } }, 2500);
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
    audio.crossOrigin = "anonymous";
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
