import { useEffect, useRef, useState } from "react";
import { Mic, Trash2 } from "lucide-react";

type Props = {
  stream: MediaStream | null;
  startTs: number;
  onCancel: () => void;
};

/**
 * Live recording tray shown in place of the composer while a voice message
 * is being captured. Renders an animated bar-graph waveform driven by an
 * AnalyserNode on the incoming MediaStream, a live MM:SS timer, and a
 * cancel (trash) button. The parent (mic hold button) drives start/stop.
 */
export function VoiceRecordingTray({ stream, startTs, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(28).fill(0.04));
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Timer
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTs) / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, [startTs]);

  // Waveform meter
  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    try {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(data);
        // average low/mid bins to get an amplitude value
        let sum = 0;
        for (let i = 2; i < 40; i++) sum += data[i];
        const avg = sum / 38 / 255; // 0..1
        setBars((prev) => {
          const next = prev.slice(1);
          // Boost small signals so the bars feel alive but cap at 1
          next.push(Math.min(1, Math.max(0.06, avg * 1.6)));
          return next;
        });
        rafRef.current = window.requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore visualization errors — recording still works
    }
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { analyserRef.current?.disconnect(); } catch { /* noop */ }
      try { void audioCtxRef.current?.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, [stream]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 rounded-full border border-[color:var(--primary)]/40 bg-gradient-to-r from-black/70 via-[color:var(--secondary)]/20 to-black/70 px-2 py-1.5 shadow-[0_0_30px_-8px_rgba(236,72,153,0.5)] backdrop-blur">
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onCancel}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
        aria-label="Cancel recording"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex flex-1 items-center gap-2 overflow-hidden px-1">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-white/90">
          {mm}:{ss}
        </span>
        <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden">
          {bars.map((v, i) => (
            <span
              key={i}
              className="inline-block w-[3px] rounded-full bg-gradient-to-t from-[color:var(--primary)] via-[color:var(--gold)] to-[color:var(--secondary)]"
              style={{ height: `${Math.round(v * 100)}%`, minHeight: "10%" }}
            />
          ))}
        </div>
      </div>

      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--primary)]/20 text-[color:var(--primary)]">
        <Mic className="h-4 w-4 animate-pulse" />
      </div>
    </div>
  );
}
