import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, X, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addSong,
  deleteSong,
  listSongs,
  formatSize,
  type StoredSong,
} from "@/lib/music-library";

export type HostMusicController = {
  musicPlaying: boolean;
  musicTitle: string | null;
  playMusicFile: (file: Blob, title: string) => Promise<void>;
  pauseMusic: () => void;
  resumeMusic: () => void;
  stopMusic: () => Promise<void>;
  setMusicVolume: (v: number) => void;
};

export function HostMusicPlayer({
  open,
  onClose,
  controller,
}: {
  open: boolean;
  onClose: () => void;
  controller: HostMusicController;
}) {
  const [songs, setSongs] = useState<StoredSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listSongs();
      setSongs(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    controller.setMusicVolume(volume);
  }, [volume, controller]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      let added = 0;
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)) {
          toast.error(`Skipped: ${f.name} (not an audio file)`);
          continue;
        }
        if (f.size > 25 * 1024 * 1024) {
          toast.error(`Skipped: ${f.name} (>25MB)`);
          continue;
        }
        await addSong(f);
        added++;
      }
      if (added > 0) toast.success(`${added} song${added > 1 ? "s" : ""} added to your library`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePlay(song: StoredSong) {
    try {
      await controller.playMusicFile(song.blob, song.name);
      setCurrentId(song.id);
    } catch (e) {
      toast.error((e as Error).message || "Play failed");
    }
  }

  function handleToggle() {
    if (controller.musicPlaying) controller.pauseMusic();
    else controller.resumeMusic();
  }

  async function handleStop() {
    await controller.stopMusic();
    setCurrentId(null);
  }

  async function handleDelete(id: string) {
    if (currentId === id) await handleStop();
    await deleteSong(id);
    await refresh();
  }

  const activeTitle = controller.musicTitle;

  return (
    <>
      {/* Floating mini-player pill */}
      {!open && activeTitle && (
        <div
          className="fixed left-1/2 z-40 flex w-[calc(100%-24px)] max-w-[460px] -translate-x-1/2 items-center gap-2 rounded-full border border-[color:var(--primary)]/40 bg-black/80 p-2 shadow-2xl backdrop-blur-md"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
        >
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)]">
            <Music className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-white">{activeTitle}</div>
            <div className="truncate text-[10px] text-white/60">Playing for everyone</div>
          </div>
          <button
            onClick={handleToggle}
            className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-white"
          >
            {controller.musicPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleStop}
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
              maxHeight: "85vh",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <Music className="h-5 w-5 text-[color:var(--primary)]" /> My Music
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
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="glow-4d mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] p-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload from Gallery"}
            </button>

            {activeTitle && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 p-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)]">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{activeTitle}</div>
                  <div className="truncate text-[11px] text-[color:var(--gold)]">
                    ● Broadcasting to room
                  </div>
                </div>
                <button
                  onClick={handleToggle}
                  className="glow-4d grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                >
                  {controller.musicPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleStop}
                  aria-label="Stop"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {activeTitle && (
              <div className="mb-3">
                <label className="mb-1 block text-[10px] text-muted-foreground">Volume</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-[color:var(--primary)]"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your Library
                </div>
                <div className="text-[10px] text-muted-foreground">{songs.length} songs</div>
              </div>

              {loading ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : songs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <Music className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <div className="text-xs font-bold">No songs yet</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Tap "Upload from Gallery" to add MP3 / M4A songs.
                    They stay saved on your device for next time.
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {songs.map((s) => {
                    const isActive = currentId === s.id && !!activeTitle;
                    return (
                      <li key={s.id}>
                        <div
                          className={`flex items-center gap-3 rounded-xl p-2 transition ${
                            isActive ? "bg-[color:var(--primary)]/20" : "hover:bg-white/5"
                          }`}
                        >
                          <button
                            onClick={() => void handlePlay(s)}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-white"
                            aria-label={`Play ${s.name}`}
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold">{s.name}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {formatSize(s.size)}
                            </div>
                          </div>
                          <button
                            onClick={() => void handleDelete(s.id)}
                            aria-label="Delete"
                            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-2 text-center text-[10px] text-muted-foreground">
              Songs stream through the room — all viewers &amp; hosts hear them.
            </div>
          </div>
        </>
      )}
    </>
  );
}
