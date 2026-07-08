import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, X, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Track = {
  id: number;
  title: string;
  artist: string;
  artwork: string;
  previewUrl: string;
};

type ITunesResult = {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
};

export function HostMusicPlayer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);

  // Debounced search via iTunes public API (no key, CORS-friendly, 30s previews)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`;
        const res = await fetch(url, { signal: ctrl.signal });
        const json = (await res.json()) as { results: ITunesResult[] };
        setResults(
          (json.results ?? [])
            .filter((r) => r.previewUrl)
            .map((r) => ({
              id: r.trackId,
              title: r.trackName,
              artist: r.artistName,
              artwork: r.artworkUrl100.replace("100x100", "200x200"),
              previewUrl: r.previewUrl,
            })),
        );
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") {
          toast.error("Search failed. Try again.");
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, open]);

  // Keep audio element volume in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function pickTrack(t: Track) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = t.previewUrl;
      audioRef.current.load();
    }
    setTrack(t);
    setPlaying(false);
    setTimeout(() => {
      audioRef.current
        ?.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }, 50);
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

  function stopAll() {
    audioRef.current?.pause();
    setPlaying(false);
    setTrack(null);
  }

  return (
    <>
      {/* Persistent audio element — stays mounted even when sheet is closed,
          so music keeps playing after user taps X. */}
      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="hidden"
      />

      {/* Floating mini-player pill (shows when sheet closed AND a track loaded) */}
      {!open && track && (
        <div
          className="fixed left-1/2 z-40 flex w-[calc(100%-24px)] max-w-[460px] -translate-x-1/2 items-center gap-2 rounded-full border border-[color:var(--primary)]/40 bg-black/80 p-2 shadow-2xl backdrop-blur-md"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
        >
          <img src={track.artwork} alt="" className="h-8 w-8 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-white">{track.title}</div>
            <div className="truncate text-[10px] text-white/60">{track.artist}</div>
          </div>
          <button
            onClick={toggle}
            className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-white"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={stopAll}
            aria-label="Stop music"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/10 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div
            className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
            style={{
              maxHeight: "80vh",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
            }}
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

            {/* Search input */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search song or artist…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Now playing */}
            {track && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 p-3">
                <img src={track.artwork} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{track.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{track.artist}</div>
                </div>
                <button
                  onClick={toggle}
                  className="glow-4d grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* Results list */}
            <div className="mt-3 flex-1 overflow-y-auto">
              {results.length === 0 && query.trim().length >= 2 && !loading && (
                <div className="py-10 text-center text-xs text-muted-foreground">No results</div>
              )}
              {results.length === 0 && query.trim().length < 2 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Type at least 2 characters to search millions of songs
                </div>
              )}
              <ul className="flex flex-col gap-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => pickTrack(r)}
                      className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                        track?.id === r.id
                          ? "bg-[color:var(--primary)]/20"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <img src={r.artwork} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{r.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{r.artist}</div>
                      </div>
                      <Play className="h-4 w-4 text-[color:var(--primary)]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Volume */}
            {track && (
              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-[color:var(--primary)]"
                />
                <div className="mt-1 text-center text-[10px] text-muted-foreground">
                  Preview clip (30s from iTunes) — plays only on your device
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
