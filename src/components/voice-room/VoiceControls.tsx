import { Volume2, VolumeX, Mic, MicOff, MicVocal } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  micOn: boolean;
  speakerOn: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onMuteAll: () => void;
}

const OCTAGON = { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" } as const;

export function VoiceControls({ micOn, speakerOn, onToggleMic, onToggleSpeaker, onMuteAll }: VoiceControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-2 sm:gap-10">
      <button
        onClick={onToggleSpeaker}
        className="flex flex-col items-center gap-1 text-white/70 transition-transform active:scale-90"
        aria-label="Toggle speaker"
      >
        <span
          style={OCTAGON}
          className="flex h-12 w-12 items-center justify-center border-2 border-violet-400/50 bg-gradient-to-b from-white/[0.06] to-black/40"
        >
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
          style={OCTAGON}
          className={cn(
            "flex h-[68px] w-[68px] items-center justify-center border-[3px] transition-colors",
            micOn
              ? "border-fuchsia-400 bg-gradient-to-b from-fuchsia-500 to-violet-700 shadow-[0_0_26px_-2px_rgba(232,60,220,0.9)]"
              : "border-white/20 bg-white/[0.06]",
          )}
        >
          {micOn ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7 text-white/50" />}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold">
          <span className={cn("h-1.5 w-1.5 rounded-full", micOn ? "bg-emerald-400 shadow-[0_0_5px_1px_rgba(52,211,153,0.9)]" : "bg-white/30")} />
          Mic {micOn ? "On" : "Off"}
        </span>
      </button>

      <button
        onClick={onMuteAll}
        className="flex flex-col items-center gap-1 text-white/70 transition-transform active:scale-90"
        aria-label="Mute all seats"
      >
        <span
          style={OCTAGON}
          className="flex h-12 w-12 items-center justify-center border-2 border-violet-400/50 bg-gradient-to-b from-white/[0.06] to-black/40"
        >
          <MicVocal className="h-5 w-5" />
        </span>
        <span className="text-[10px] font-medium">Mute All</span>
      </button>
    </div>
  );
}
