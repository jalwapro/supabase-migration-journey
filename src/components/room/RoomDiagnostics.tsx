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
    <div
      className="pointer-events-auto fixed z-[70] left-2 select-none"
      style={{ top: "calc(env(safe-area-inset-top) + 56px)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur"
      >
        <Activity className="h-3 w-3" />
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />
        <span>{status}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-1.5 w-[260px] rounded-2xl border border-white/15 bg-black/80 p-2.5 text-[11px] text-white shadow-xl backdrop-blur-md">
          <Row
            label="Room ID"
            value={roomId ?? "—"}
            display={shortRoom}
            onCopy={roomId ? () => copy("Room ID", roomId) : undefined}
            copied={copied === "Room ID"}
          />
          <Row
            label="rtc_channel"
            value={rtcChannel ?? "—"}
            display={rtcChannel ?? "—"}
            onCopy={rtcChannel ? () => copy("rtc_channel", rtcChannel) : undefined}
            copied={copied === "rtc_channel"}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/50">RTC</span>
            <span className="font-mono">ZEGOCLOUD</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/50">Status</span>
            <span className="flex items-center gap-1 font-mono">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />
              {status}
            </span>
          </div>
          {typeof remotesCount === "number" && (
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Remotes</span>
              <span className="font-mono">{remotesCount}</span>
            </div>
          )}
          {typeof muted === "boolean" && (
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Mic</span>
              <span className="font-mono">{muted ? "muted" : "live"}</span>
            </div>
          )}
          {typeof speakerMuted === "boolean" && (
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Speaker</span>
              <span className="font-mono">{speakerMuted ? "muted" : "on"}</span>
            </div>
          )}
          {error && (
            <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-1.5 text-[10px] text-red-200">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  display,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  display: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="mt-0.5 flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      <button
        onClick={onCopy}
        disabled={!onCopy}
        title={value}
        className="flex max-w-[160px] items-center gap-1 truncate rounded px-1 py-0.5 font-mono text-white/90 hover:bg-white/10 disabled:opacity-60"
      >
        <span className="truncate">{display}</span>
        {onCopy && (copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 opacity-60" />)}
      </button>
    </div>
  );
}
