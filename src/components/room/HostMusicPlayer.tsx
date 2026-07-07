import { useRef, useState } from "react";
import { Music, Play, Pause, X, Upload } from "lucide-react";
import { toast } from "sonner";

export function HostMusicPlayer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<{ name: string; url: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("audio")) {
      toast.error("Please pick an audio file (mp3, m4a, wav)");
      return;
    }
    const url = URL.createObjectURL(f);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setTrack({ name: f.name, url });
    setPlaying(false);
  }

  function toggle() {
    const el = audioRef.current;
    if (!el || !track) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch((err) => toast.error(err.message));
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Music className="h-5 w-5 text-[color:var(--primary)]" /> Music (Host)
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-background/60 border border-border"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={pickFile}
        />

        {!track ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/60 py-8"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-bold">Pick mp3 from device</span>
            <span className="text-[11px] text-muted-foreground">Plays only on your device</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggle}
                className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{track.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {playing ? "Playing" : "Paused"}
                </div>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={track.url}
              onEnded={() => setPlaying(false)}
              onVolumeChange={() => {}}
              className="hidden"
            />
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                className="w-full accent-[color:var(--primary)]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 rounded-full border border-border py-2 text-xs font-bold"
                >
                  Change track
                </button>
                <button
                  onClick={() => {
                    audioRef.current?.pause();
                    setPlaying(false);
                    setTrack(null);
                  }}
                  className="flex-1 rounded-full bg-[color:var(--destructive)]/80 py-2 text-xs font-bold"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
