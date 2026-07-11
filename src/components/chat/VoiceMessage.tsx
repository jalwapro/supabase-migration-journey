import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

type Props = {
  url: string;
  mine: boolean;
  duration?: number | null;
};

// Cache decoded waveform peaks per URL so we only decode once.
const peakCache = new Map<string, number[]>();

const BAR_COUNT = 40;

async function decodePeaks(url: string): Promise<number[]> {
  const cached = peakCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const raw = audio.getChannelData(0);
    const step = Math.floor(raw.length / BAR_COUNT) || 1;
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      let peak = 0;
      const start = i * step;
      const end = Math.min(raw.length, start + step);
      for (let j = start; j < end; j++) {
        const v = Math.abs(raw[j]);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    const norm = peaks.map((p) => (max > 0 ? Math.max(0.08, p / max) : 0.1));
    peakCache.set(url, norm);
    return norm;
  } finally {
    try { void ctx.close(); } catch { /* noop */ }
  }
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(1, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * WhatsApp-style voice message bubble:
 * play/pause · waveform (played vs unplayed color) · time · speed toggle.
 * Fully custom UI — no browser `<audio controls>`.
 */
export function VoiceMessage({ url, mine, duration }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [loadingPeaks, setLoadingPeaks] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState<number>(duration ?? 0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const barsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    a.playbackRate = speed;
    audioRef.current = a;
    const onTime = () => setCur(a.currentTime);
    const onLoaded = () => { if (isFinite(a.duration)) setDur(a.duration); };
    const onEnded = () => { setPlaying(false); setCur(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const ensurePeaks = useCallback(async () => {
    if (peaks) return;
    setLoadingPeaks(true);
    try {
      const p = await decodePeaks(url);
      setPeaks(p);
    } catch {
      setPeaks(Array(BAR_COUNT).fill(0.4));
    } finally {
      setLoadingPeaks(false);
    }
  }, [url, peaks]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    void ensurePeaks();
    try { await a.play(); } catch { /* autoplay/permission — no-op */ }
  };

  const cycleSpeed = () => {
    setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1));
  };

  const seekTo = (clientX: number) => {
    const el = barsRef.current;
    const a = audioRef.current;
    if (!el || !a || !dur) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    a.currentTime = pct * dur;
    setCur(a.currentTime);
  };

  const progress = dur > 0 ? Math.min(1, cur / dur) : 0;
  const activeBar = Math.floor(progress * BAR_COUNT);
  const display = peaks ?? Array(BAR_COUNT).fill(0.35);
  const timeLabel = playing || cur > 0 ? fmt(cur) : fmt(dur);

  // Colors adapt to bubble side
  const playedColor = mine ? "bg-white" : "bg-[color:var(--primary)]";
  const unplayedColor = mine ? "bg-white/35" : "bg-muted-foreground/40";
  const iconTint = mine ? "text-white" : "text-[color:var(--primary)]";
  const chipBg = mine ? "bg-white/20 text-white" : "bg-muted text-muted-foreground";

  return (
    <div className="flex min-w-[220px] max-w-[280px] items-center gap-2 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice" : "Play voice"}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          mine ? "bg-white/25 hover:bg-white/35" : "bg-[color:var(--primary)]/15 hover:bg-[color:var(--primary)]/25"
        } transition`}
      >
        {loadingPeaks && !playing ? (
          <Loader2 className={`h-4 w-4 animate-spin ${iconTint}`} />
        ) : playing ? (
          <Pause className={`h-4 w-4 ${iconTint}`} />
        ) : (
          <Play className={`h-4 w-4 translate-x-[1px] ${iconTint}`} />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div
          ref={barsRef}
          onPointerDown={(e) => seekTo(e.clientX)}
          className="flex h-7 cursor-pointer items-center gap-[2px] touch-none"
        >
          {display.map((v, i) => (
            <span
              key={i}
              className={`inline-block w-[3px] rounded-full ${
                i <= activeBar ? playedColor : unplayedColor
              } transition-colors`}
              style={{ height: `${Math.round(Math.max(0.15, v) * 100)}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-mono text-[10px] tabular-nums ${mine ? "text-white/80" : "text-muted-foreground"}`}>
            {timeLabel}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className={`rounded-full px-1.5 py-[1px] text-[9px] font-bold ${chipBg} transition hover:opacity-90`}
            aria-label="Playback speed"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}
