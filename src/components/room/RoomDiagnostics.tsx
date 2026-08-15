import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Activity } from "lucide-react";

type Status = "idle" | "connecting" | "connected" | "error" | "disabled";

const STATUS_COLOR: Record<Status, string> = {
  idle: "bg-white/40",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-green-500",
  error: "bg-red-500",
  disabled: "bg-white/30",
};

const VOICE_ROOM_REDESIGN_CSS = `
body:has([data-jalwa-voice-room-redesign]) {
  background: #030008 !important;
}
body:has([data-jalwa-voice-room-redesign]) .app-frame {
  background: #030008 !important;
}
body:has([data-jalwa-voice-room-redesign]) .max-w-md {
  max-width: min(820px, calc(100vw - 24px)) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  grid-template-rows: repeat(6, minmax(0, 1fr)) !important;
  gap: 10px !important;
  width: 100% !important;
  max-width: 820px !important;
  margin-inline: auto !important;
  align-items: stretch !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button {
  position: relative !important;
  min-width: 0 !important;
  width: 100% !important;
  aspect-ratio: 1 / 1 !important;
  border-radius: 18px !important;
  border: 1px solid rgba(168,85,247,.55) !important;
  background: radial-gradient(circle at 50% 15%, rgba(126,34,206,.22), rgba(2,0,8,.92) 70%) !important;
  box-shadow: inset 0 0 18px rgba(124,58,237,.08), 0 0 14px rgba(168,85,247,.12) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(1) {
  grid-column: 3 / span 2 !important;
  grid-row: 2 / span 3 !important;
  aspect-ratio: auto !important;
  min-height: 280px !important;
  border-radius: 28px !important;
  border: 2px solid rgba(168,85,247,.9) !important;
  background: radial-gradient(circle at 50% 35%, rgba(217,70,239,.30), transparent 48%), linear-gradient(145deg, rgba(30,10,50,.98), rgba(3,0,8,.98)) !important;
  box-shadow: 0 0 20px rgba(168,85,247,.35), inset 0 0 30px rgba(217,70,239,.15) !important;
  z-index: 4 !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(2) { grid-column:1; grid-row:2; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(3) { grid-column:1; grid-row:3; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(4) { grid-column:1; grid-row:4; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(5) { grid-column:1; grid-row:5; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(6) { grid-column:2; grid-row:1; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(7) { grid-column:3; grid-row:1; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(8) { grid-column:4; grid-row:1; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(9) { grid-column:5; grid-row:2; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(10) { grid-column:6; grid-row:2; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(11) { grid-column:6; grid-row:3; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(12) { grid-column:6; grid-row:4; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(13) { grid-column:6; grid-row:5; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(14) { grid-column:5; grid-row:6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(15) { grid-column:4; grid-row:6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(16) { grid-column:3; grid-row:6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(17) { grid-column:2; grid-row:6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(18) { grid-column:1; grid-row:6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(19) { grid-column:2; grid-row:5; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(20) { grid-column:2; grid-row:4; }
body:has([data-jalwa-voice-room-redesign]) input,
body:has([data-jalwa-voice-room-redesign]) textarea {
  background: rgba(10,3,20,.82) !important;
  border-color: rgba(168,85,247,.38) !important;
  border-radius: 999px !important;
}
@media (max-width: 700px) {
  body:has([data-jalwa-voice-room-redesign]) .max-w-md { max-width: calc(100vw - 12px) !important; }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] { gap: 6px !important; }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button { border-radius: 12px !important; }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > button:nth-child(1) {
    min-height: 210px !important;
    border-radius: 20px !important;
  }
}
`;

export function RoomDiagnostics({
  roomId,
  rtcChannel,
  status,
  error,
  remotesCount,
  muted,
  speakerMuted,
}: {
  roomId: string | null | undefined;
  rtcChannel: string | null | undefined;
  status: Status;
  error?: string | null;
  remotesCount?: number;
  muted?: boolean;
  speakerMuted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  };

  const shortRoom = roomId ? `${roomId.slice(0, 8)}…` : "—";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: VOICE_ROOM_REDESIGN_CSS }} />
      <div
        data-jalwa-voice-room-redesign
        className="pointer-events-auto fixed z-[70] left-2 select-none"
        style={{ top: "calc(env(safe-area-inset-top) + 56px)" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur"
          aria-label="Room diagnostics"
        >
          <Activity className="h-3 w-3" />
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />
          <span>{status}</span>
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {open && (
          <div className="mt-1.5 w-[260px] rounded-2xl border border-white/15 bg-black/80 p-2.5 text-[11px] text-white shadow-xl backdrop-blur-md">
            <Row label="Room ID" value={roomId ?? "—"} display={shortRoom} onCopy={roomId ? () => copy("Room ID", roomId) : undefined} copied={copied === "Room ID"} />
            <Row label="rtc_channel" value={rtcChannel ?? "—"} display={rtcChannel ?? "—"} onCopy={rtcChannel ? () => copy("rtc_channel", rtcChannel) : undefined} copied={copied === "rtc_channel"} />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">RTC</span>
              <span className="font-mono">ZEGOCLOUD</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Status</span>
              <span className="flex items-center gap-1 font-mono"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />{status}</span>
            </div>
            {typeof remotesCount === "number" && (
              <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Remotes</span><span className="font-mono">{remotesCount}</span></div>
            )}
            {typeof muted === "boolean" && (
              <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Mic</span><span className="font-mono">{muted ? "muted" : "live"}</span></div>
            )}
            {typeof speakerMuted === "boolean" && (
              <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Speaker</span><span className="font-mono">{speakerMuted ? "muted" : "on"}</span></div>
            )}
            {error && <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-1.5 text-[10px] text-red-200">{error}</div>}
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value, display, onCopy, copied }: { label: string; value: string; display: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="mt-0.5 flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      <button onClick={onCopy} disabled={!onCopy} title={value} className="flex max-w-[160px] items-center gap-1 truncate rounded px-1 py-0.5 font-mono text-white/90 hover:bg-white/10 disabled:opacity-60">
        <span className="truncate">{display}</span>
        {onCopy && (copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 opacity-60" />)}
      </button>
    </div>
  );
}
