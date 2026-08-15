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

/*
 * This file only provides the small diagnostics mount plus a scoped visual layer.
 * The actual room functionality remains in src/routes/room.$roomId.tsx.
 * The previous version forced a very tall 6x6 stage and a 300px+ host card,
 * which caused the desktop/mobile room to overflow and produced the distorted
 * screenshot. This version keeps the reference composition but scales the
 * complete stage to the available viewport.
 */
const VOICE_ROOM_REFERENCE_CSS = `
/* Room shell */
body:has([data-jalwa-voice-room-redesign]) {
  background: #020006 !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col {
  background: radial-gradient(circle at 50% 35%, rgba(91,20,130,.18), transparent 42%), #020006 !important;
  color: #fff !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: none;
  padding-bottom: 8px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col::-webkit-scrollbar { display:none; }

/* Remove the old full-screen decorative background so the UI reads like the supplied reference. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > img,
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.absolute.inset-0.bg-black,
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.absolute.blur-\\[120px\\],
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.absolute.blur-\\[100px\\] {
  display: none !important;
}

/* Keep diagnostics itself invisible in production. */
body:has([data-jalwa-voice-room-redesign]) [data-jalwa-voice-room-redesign] {
  opacity: 0 !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  pointer-events: none !important;
}

/* Responsive centered room canvas. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > .max-w-md {
  width: min(820px, calc(100vw - 16px)) !important;
  max-width: 820px !important;
}

/* Header stays compact. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 {
  width: min(820px, calc(100vw - 16px)) !important;
  padding: 8px 0 4px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 > div.flex.items-center.justify-between {
  min-height: 58px !important;
  padding: 6px 10px !important;
  border: 1px solid rgba(188,65,255,.40) !important;
  border-radius: 18px !important;
  background: linear-gradient(120deg, rgba(7,2,14,.94), rgba(25,4,39,.86)) !important;
  box-shadow: inset 0 0 22px rgba(190,55,255,.05), 0 0 18px rgba(175,45,255,.08) !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 .h-12.w-12 {
  width: 42px !important;
  height: 42px !important;
  border-radius: 13px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 .text-\\[14px\\] {
  font-size: 16px !important;
}

/* Ranking and online controls. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 > div.flex.items-center.gap-2.mb-3 {
  margin: 4px 0 5px !important;
  padding: 6px 11px !important;
  min-width: 0 !important;
  width: fit-content !important;
  border: 1px solid rgba(190,50,255,.42) !important;
  border-radius: 13px !important;
  background: rgba(8,2,16,.80) !important;
}

/* Main 20-position stage. 6 columns x 6 rows gives the reference shape while
   allowing the host to stay compact on small screens. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
  display: grid !important;
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  grid-template-rows: repeat(6, minmax(42px, 1fr)) !important;
  gap: clamp(4px, 1vw, 8px) !important;
  width: min(820px, calc(100vw - 16px)) !important;
  max-width: 820px !important;
  height: clamp(330px, 45vh, 430px) !important;
  margin: 2px auto 0 !important;
  padding: 2px !important;
  box-sizing: border-box !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div {
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  align-self: stretch !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div > button {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  border-radius: clamp(10px, 1.8vw, 16px) !important;
  border: 1px solid rgba(148,58,255,.70) !important;
  background: radial-gradient(circle at 50% 15%, rgba(129,40,255,.16), rgba(2,0,8,.96) 66%) !important;
  box-shadow: inset 0 0 16px rgba(149,44,255,.07), 0 0 10px rgba(165,48,255,.07) !important;
  overflow: hidden !important;
}

/* Host is compact and centered rather than taking over the viewport. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) {
  grid-column: 3 / span 2 !important;
  grid-row: 2 / span 3 !important;
  z-index: 5 !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) > button {
  min-height: 0 !important;
  border-radius: clamp(18px, 3vw, 28px) !important;
  border: 2px solid rgba(193,62,255,.90) !important;
  background: radial-gradient(circle at 50% 35%, rgba(255,0,224,.22), transparent 45%), linear-gradient(145deg, rgba(31,8,51,.98), rgba(2,0,8,.98)) !important;
  box-shadow: 0 0 22px rgba(185,46,255,.32), inset 0 0 28px rgba(215,38,255,.10) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) > button::before {
  content: "HOST";
  position: absolute;
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 13px;
  border-radius: 999px;
  border: 1px solid rgba(241,94,255,.68);
  background: rgba(10,0,20,.82);
  color: #fff;
  font-size: clamp(8px, 1.8vw, 12px);
  font-weight: 900;
  letter-spacing: 1.5px;
  z-index: 20;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) img {
  width: clamp(62px, 12vw, 120px) !important;
  height: clamp(62px, 12vw, 120px) !important;
  max-width: 58% !important;
  object-fit: cover !important;
  border-radius: 20px !important;
  border: 2px solid rgba(236,72,255,.62) !important;
  box-shadow: 0 0 20px rgba(217,70,239,.35) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) .text-\\[11px\\] {
  font-size: clamp(10px, 2.2vw, 15px) !important;
  font-weight: 900 !important;
}

/* 19 seats around the host. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(2) { grid-column: 1; grid-row: 2; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(3) { grid-column: 1; grid-row: 3; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(4) { grid-column: 1; grid-row: 4; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(5) { grid-column: 1; grid-row: 5; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(6) { grid-column: 2; grid-row: 1; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(7) { grid-column: 3; grid-row: 1; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(8) { grid-column: 4; grid-row: 1; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(9) { grid-column: 5; grid-row: 2; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(10) { grid-column: 6; grid-row: 2; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(11) { grid-column: 6; grid-row: 3; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(12) { grid-column: 6; grid-row: 4; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(13) { grid-column: 6; grid-row: 5; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(14) { grid-column: 5; grid-row: 6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(15) { grid-column: 4; grid-row: 6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(16) { grid-column: 3; grid-row: 6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(17) { grid-column: 2; grid-row: 6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(18) { grid-column: 1; grid-row: 6; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(19) { grid-column: 2; grid-row: 5; }
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(20) { grid-column: 2; grid-row: 4; }

/* Seat content stays compact. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] .relative.flex.flex-col.items-center.gap-1\\.5 {
  gap: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] .relative.flex.flex-col.items-center.gap-1\\.5 > button {
  width: 100% !important;
  height: 100% !important;
  border-radius: clamp(10px, 1.8vw, 16px) !important;
  border-color: rgba(147,51,234,.70) !important;
  background: linear-gradient(145deg, rgba(9,3,18,.96), rgba(2,0,8,.98)) !important;
  box-shadow: inset 0 0 14px rgba(168,85,247,.06), 0 0 8px rgba(168,85,247,.06) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] .relative.flex.flex-col.items-center.gap-1\\.5 > button img {
  border-radius: 10px !important;
  max-width: 68% !important;
  max-height: 68% !important;
  object-fit: cover !important;
}

/* Controls directly beneath the stage. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] + div {
  margin-top: 2px !important;
  min-height: 54px !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] ~ div .grid.h-9.w-9,
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] ~ div .grid.h-10.w-10 {
  border-color: rgba(188,60,255,.55) !important;
  background: rgba(8,2,16,.82) !important;
}

/* Chat/side cards retain their existing behavior but use the reference glass style. */
body:has([data-jalwa-voice-room-redesign]) input,
body:has([data-jalwa-voice-room-redesign]) textarea {
  background: rgba(7,2,15,.88) !important;
  border-color: rgba(168,85,247,.36) !important;
}
body:has([data-jalwa-voice-room-redesign]) button {
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 700px) {
  body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > .max-w-md,
  body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2,
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
    width: calc(100vw - 10px) !important;
  }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
    height: clamp(300px, 43vh, 360px) !important;
    gap: 4px !important;
  }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) > button {
    border-radius: 18px !important;
  }
}

@media (min-width: 1000px) {
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
    height: 430px !important;
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
      <style dangerouslySetInnerHTML={{ __html: VOICE_ROOM_REFERENCE_CSS }} />
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
            <div className="mt-1.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">RTC</span><span className="font-mono">ZEGOCLOUD</span></div>
            <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Status</span><span className="flex items-center gap-1 font-mono"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />{status}</span></div>
            {typeof remotesCount === "number" && <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Remotes</span><span className="font-mono">{remotesCount}</span></div>}
            {typeof muted === "boolean" && <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Mic</span><span className="font-mono">{muted ? "muted" : "live"}</span></div>}
            {typeof speakerMuted === "boolean" && <div className="mt-0.5 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-white/50">Speaker</span><span className="font-mono">{speakerMuted ? "muted" : "on"}</span></div>}
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
