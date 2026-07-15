import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Volume1 } from "lucide-react";
import {
  useGiftAudioPrefs,
  setGiftAudioMuted,
  setGiftAudioVolume,
} from "@/lib/giftAudio";

export function GiftAudioControl({ className = "" }: { className?: string }) {
  const prefs = useGiftAudioPrefs();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const effectiveMuted = prefs.muted || prefs.volume === 0;
  const Icon = effectiveMuted ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        onClick={() => {
          if (effectiveMuted) {
            setGiftAudioMuted(false);
            if (prefs.volume === 0) setGiftAudioVolume(0.8);
          } else {
            setGiftAudioMuted(true);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onDoubleClick={() => setOpen((v) => !v)}
        aria-label={effectiveMuted ? "Unmute gift sounds" : "Mute gift sounds"}
        className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur ring-1 ring-white/10 active:scale-95"
      >
        <Icon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 flex w-40 flex-col gap-2 rounded-2xl border border-white/10 bg-black/85 p-3 text-white shadow-2xl backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Gift Sound</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGiftAudioMuted(!prefs.muted)}
              className={`grid h-7 w-7 place-items-center rounded-full ${
                prefs.muted ? "bg-white/10" : "bg-[color:var(--primary)]"
              }`}
              aria-label={prefs.muted ? "Unmute" : "Mute"}
            >
              {prefs.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(prefs.volume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setGiftAudioVolume(v);
                if (v > 0 && prefs.muted) setGiftAudioMuted(false);
              }}
              className="flex-1 accent-[color:var(--primary)]"
            />
          </div>
          <p className="text-[10px] text-white/50">
            {prefs.muted ? "Muted" : `${Math.round(prefs.volume * 100)}%`}
          </p>
        </div>
      )}
    </div>
  );
}
