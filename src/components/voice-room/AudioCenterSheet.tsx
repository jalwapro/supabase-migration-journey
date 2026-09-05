import { useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Headphones, Music, Play, Pause, Square, X, AlertTriangle } from "lucide-react";

export type AudioCenterController = {
  muted: boolean;
  micBlocked: boolean;
  micError: string | null;
  micLevel: number;
  onToggleMic: () => void;
  speakerMuted: boolean;
  onToggleSpeaker: () => void;
  speakerVolume: number;
  setSpeakerVolume: (v: number) => void;
  audioOutputs: { deviceId: string; label: string }[];
  audioOutputId: string;
  setAudioOutput: (id: string) => Promise<void> | void;
  refreshAudioOutputs: () => Promise<void> | void;
  musicPlaying: boolean;
  musicTitle: string | null;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  pauseMusic: () => void;
  resumeMusic: () => void;
  stopMusic: () => Promise<void> | void;
  onOpenMusic: () => void;
  canPlayMusic: boolean;
  speakingCount: number;
};

/** Mobile-first audio hub: mic + level meter, master output, device picker, music stream. */
export function AudioCenterSheet({ open, onClose, c }: { open: boolean; onClose: () => void; c: AudioCenterController }) {
  useEffect(() => { if (open) void c.refreshAudioOutputs(); }, [open, c]);

  if (!open) return null;

  const bars = 14;
  const active = Math.round(c.micLevel * bars);
  const supportsOutputPicker = typeof window !== "undefined" && typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown }).setSinkId === "function";

  return (
    <>
      <div data-jalwa-overlay="true" className="fixed inset-0 z-[60] bg-black/80" onClick={onClose} />
      <div data-jalwa-overlay-content="true" className="fixed bottom-0 left-1/2 z-[61] w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-white/10 bg-[#1a0b2e] p-5 pb-8 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Headphones className="h-4 w-4 text-fuchsia-400" /><h3 className="text-sm font-black uppercase tracking-widest">Audio Center</h3></div>
          <button onClick={onClose} aria-label="Close audio center" className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {/* Microphone */}
        <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold">Microphone</p>
              <p className="text-[10px] text-white/50">{c.muted ? "Muted" : "Live — others can hear you"}</p>
            </div>
            <button onClick={c.onToggleMic} aria-label={c.muted ? "Unmute microphone" : "Mute microphone"}
              className={`grid h-11 w-11 place-items-center rounded-full transition ${c.muted ? "bg-white/10 text-white/60" : "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-[0_0_20px_-4px_rgba(232,60,220,0.9)]"}`}>
              {c.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-3 flex h-8 items-end gap-1" aria-hidden>
            {Array.from({ length: bars }).map((_, i) => (
              <span key={i} className={`flex-1 rounded-full transition-all duration-75 ${!c.muted && i < active ? "bg-emerald-400" : "bg-white/10"}`}
                style={{ height: `${20 + (i % 5) * 12}%`, ...(!c.muted && i < active ? { height: `${30 + Math.min(70, c.micLevel * 100)}%` } : {}) }} />
            ))}
          </div>
          {c.micBlocked && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/15 p-2 text-[10px] font-semibold text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {c.micError ?? "Microphone blocked. Browser settings me mic allow karo."}
            </p>
          )}
        </section>

        {/* Speaker */}
        <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold">Room Sound</p>
              <p className="text-[10px] text-white/50">{c.speakerMuted ? "Deafened" : `${c.speakingCount} speaking now`}</p>
            </div>
            <button onClick={c.onToggleSpeaker} aria-label={c.speakerMuted ? "Undeafen" : "Deafen"}
              className={`grid h-11 w-11 place-items-center rounded-full transition ${c.speakerMuted ? "bg-rose-500/25 text-rose-300" : "bg-cyan-500/20 text-cyan-300"}`}>
              {c.speakerMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
          <label className="mt-3 block text-[10px] font-bold uppercase tracking-widest text-white/50">Master volume · {c.speakerVolume}%</label>
          <input type="range" min={0} max={100} value={c.speakerVolume} onChange={(e) => c.setSpeakerVolume(Number(e.target.value))}
            className="mt-1 w-full accent-fuchsia-500" aria-label="Master speaker volume" />
          {supportsOutputPicker && (
            <>
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-widest text-white/50">Output device</label>
              <select value={c.audioOutputId} onChange={(e) => void c.setAudioOutput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs" aria-label="Audio output device">
                <option value="">System default</option>
                {c.audioOutputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
              </select>
            </>
          )}
        </section>

        {/* Music */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold"><Music className="h-3.5 w-3.5 text-amber-300" />Room Music</p>
              <p className="truncate text-[10px] text-white/50">{c.musicTitle ?? "No track streaming"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={!c.musicTitle} onClick={() => (c.musicPlaying ? c.pauseMusic() : c.resumeMusic())} aria-label={c.musicPlaying ? "Pause music" : "Play music"}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 disabled:opacity-40">
                {c.musicPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button disabled={!c.musicTitle} onClick={() => void c.stopMusic()} aria-label="Stop music"
                className="grid h-10 w-10 place-items-center rounded-full bg-rose-500/20 text-rose-300 disabled:opacity-40"><Square className="h-4 w-4" /></button>
            </div>
          </div>
          <label className="mt-3 block text-[10px] font-bold uppercase tracking-widest text-white/50">Music volume · {c.musicVolume}%</label>
          <input type="range" min={0} max={100} value={c.musicVolume} onChange={(e) => c.setMusicVolume(Number(e.target.value))}
            className="mt-1 w-full accent-amber-400" aria-label="Music stream volume" />
          <button onClick={() => { onClose(); c.onOpenMusic(); }} disabled={!c.canPlayMusic}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 py-2.5 text-xs font-black text-black disabled:opacity-40">
            Choose a track
          </button>
        </section>
      </div>
    </>
  );
}
