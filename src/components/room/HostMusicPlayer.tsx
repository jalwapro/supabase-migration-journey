import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, X, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube } from "@/lib/youtube-search.functions";

type Track = {
  id: string; // youtube videoId
  title: string;
  artist: string;
  artwork: string;
};

// Minimal YT IFrame Player typing
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  loadVideoById: (id: string) => void;
  setVolume: (v: number) => void; // 0-100
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYTApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

export function HostMusicPlayer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const playerRef = useRef<YTPlayer | null>(null);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70); // 0-100 for YT
  const [ready, setReady] = useState(false);

  const doSearch = useServerFn(searchYouTube);

  // Init YT player once (persistent, hidden div outside sheet)
  useEffect(() => {
    let cancelled = false;
    loadYTApi().then(() => {
      if (cancelled || !playerHostRef.current || playerRef.current) return;
      const YT = window.YT;
      if (!YT) return;
      playerRef.current = new YT.Player(playerHostRef.current, {
        height: "1",
        width: "1",
        playerVars: {
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume);
            setReady(true);
          },
          onStateChange: (e) => {
            if (!window.YT) return;
            if (e.data === window.YT.PlayerState.PLAYING) setPlaying(true);
            else if (
              e.data === window.YT.PlayerState.PAUSED ||
              e.data === window.YT.PlayerState.ENDED
            )
              setPlaying(false);
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) playerRef.current?.setVolume(volume);
  }, [volume, ready]);

  // Debounced search via YouTube Data API
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await doSearch({ data: { q } });
        setResults(items as Track[]);
      } catch (e) {
        toast.error((e as Error).message || "Search failed");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, open, doSearch]);

  function pickTrack(t: Track) {
    setTrack(t);
    if (!playerRef.current || !ready) {
      toast.error("Player loading… try again in a sec");
      return;
    }
    playerRef.current.loadVideoById(t.id);
  }

  function toggle() {
    const p = playerRef.current;
    if (!p || !track) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }

  function stopAll() {
    playerRef.current?.stopVideo();
    setPlaying(false);
    setTrack(null);
  }

  return (
    <>
      {/* Persistent hidden YT player — keeps playing when sheet closes */}
      <div
        style={{
          position: "fixed",
          left: -9999,
          top: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden
      >
        <div ref={playerHostRef} />
      </div>

      {/* Floating mini-player pill */}
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

            <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search song or artist on YouTube…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

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

            <div className="mt-3 flex-1 overflow-y-auto">
              {results.length === 0 && query.trim().length >= 2 && !loading && (
                <div className="py-10 text-center text-xs text-muted-foreground">No results</div>
              )}
              {results.length === 0 && query.trim().length < 2 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Type at least 2 characters to search YouTube Music
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
                        <div
                          className="truncate text-sm font-bold"
                          // YouTube returns HTML entities in titles
                          dangerouslySetInnerHTML={{ __html: r.title }}
                        />
                        <div className="truncate text-[11px] text-muted-foreground">{r.artist}</div>
                      </div>
                      <Play className="h-4 w-4 text-[color:var(--primary)]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {track && (
              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-[color:var(--primary)]"
                />
                <div className="mt-1 text-center text-[10px] text-muted-foreground">
                  Full track from YouTube — plays only on your device
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
