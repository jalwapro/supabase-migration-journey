import { Volume2, VolumeX, Mic, MicOff, MicVocal } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  micOn: boolean;
  speakerOn: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onMuteAll: () => void;
}

export function VoiceControls({ micOn, speakerOn, onToggleMic, onToggleSpeaker, onMuteAll }: VoiceControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-2 sm:gap-10">
      <button
        onClick={onToggleSpeaker}
        className="flex flex-col items-center gap-1 text-white/70 transition-transform active:scale-90"
        aria-label="Toggle speaker"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-red-400" />}
        </span>
        <span className="text-[10px] font-medium">Speaker</span>
      </button>

      <button
        onClick={onToggleMic}
        className="flex flex-col items-center gap-1 text-white transition-transform active:scale-90"
        aria-label="Toggle microphone"
      >
        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border-2 transition-colors",
            micOn
              ? "border-fuchsia-400 bg-gradient-to-b from-fuchsia-500 to-violet-600 shadow-[0_0_24px_-4px_rgba(232,60,220,0.8)]"
              : "border-white/15 bg-white/[0.06]",
          )}
        >
          {micOn ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7 text-white/50" />}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold">
          <span className={cn("h-1.5 w-1.5 rounded-full", micOn ? "bg-emerald-400" : "bg-white/30")} />
          Mic {micOn ? "On" : "Off"}
        </span>
      </button>

      <button
        onClick={onMuteAll}
        className="flex flex-col items-center gap-1 text-white/70 transition-transform active:scale-90"
        aria-label="Mute all seats"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <MicVocal className="h-5 w-5" />
        </span>
        <span className="text-[10px] font-medium">Mute All</span>
      </button>
    </div>
  );
}
