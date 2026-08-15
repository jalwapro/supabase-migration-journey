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

const VOICE_ROOM_REFERENCE_CSS = `
/* Jalwa voice-room reference layout: black glass + neon purple/pink, 20 seats around a hero host. */
body:has([data-jalwa-voice-room-redesign]) {
  background: #020005 !important;
  overflow: hidden !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col {
  background: #020005 !important;
  color: #fff !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: none;
  padding-bottom: 12px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col::-webkit-scrollbar { display:none; }
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > img,
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.absolute.inset-0.bg-black,
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.absolute.blur-\[120px\],
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.absolute.blur-\[100px\] { display:none !important; }

/* Diagnostics pill is retained for debugging but visually hidden in the production room. */
body:has([data-jalwa-voice-room-redesign]) [data-jalwa-voice-room-redesign] {
  opacity: 0 !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  pointer-events: none !important;
}

/* Shared centered canvas. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > .max-w-md {
  max-width: 820px !important;
}

/* Header */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 {
  width: min(820px, calc(100% - 24px)) !important;
  padding: 14px 0 8px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 > div.flex.items-center.justify-between {
  min-height: 72px !important;
  padding: 8px 14px !important;
  border: 1px solid rgba(188, 65, 255, .42) !important;
  border-radius: 24px !important;
  background: linear-gradient(120deg, rgba(11,4,21,.94), rgba(23,4,39,.82)) !important;
  box-shadow: 0 0 30px rgba(176, 45, 255, .10), inset 0 0 25px rgba(255,0,225,.04) !important;
}
body:has([data-jalwa-voice-room-redesign]) .glow-4d {
  box-shadow: 0 0 18px rgba(214, 66, 255, .35) !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 .h-12.w-12 {
  border-radius: 16px !important;
  box-shadow: 0 0 18px rgba(190, 50, 255, .35) !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 .text-\[14px\] {
  font-size: 20px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 .text-\[10px\] {
  font-size: 12px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 .flex.items-center.gap-2:last-child {
  gap: 10px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col .grid.h-9.w-9,
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col .grid.h-8.w-8 {
  border-color: rgba(184, 65, 255, .48) !important;
  background: rgba(7, 3, 14, .86) !important;
}

/* Ranking / online row */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 > div.flex.items-center.gap-2.mb-3 {
  margin: 8px 0 8px !important;
  padding: 9px 16px !important;
  width: fit-content !important;
  min-width: 230px !important;
  border: 1px solid rgba(190, 50, 255, .48) !important;
  border-radius: 16px !important;
  background: rgba(12, 4, 24, .85) !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2 > div.flex.items-center.gap-2.mb-3 + div.flex.items-center {
  justify-content: flex-end !important;
}

/* Voice stage */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
  display: grid !important;
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  grid-template-rows: repeat(6, minmax(78px, 1fr)) !important;
  gap: 10px !important;
  width: min(820px, calc(100vw - 24px)) !important;
  max-width: 820px !important;
  margin: 4px auto 0 !important;
  padding: 4px !important;
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
  min-height: 88px !important;
  border-radius: 16px !important;
  border: 1px solid rgba(148, 58, 255, .72) !important;
  background: radial-gradient(circle at 50% 15%, rgba(129, 40, 255, .18), rgba(2,0,8,.96) 66%) !important;
  box-shadow: inset 0 0 20px rgba(149, 44, 255, .08), 0 0 12px rgba(165, 48, 255, .08) !important;
}

/* Host seat: center hero card, visually much larger than regular seats. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) {
  grid-column: 3 / span 2 !important;
  grid-row: 2 / span 3 !important;
  z-index: 5 !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) > button {
  min-height: 300px !important;
  border-radius: 28px !important;
  border: 2px solid rgba(193, 62, 255, .92) !important;
  background: radial-gradient(circle at 50% 35%, rgba(255, 0, 224, .24), transparent 45%), linear-gradient(145deg, rgba(31, 8, 51, .98), rgba(2,0,8,.98)) !important;
  box-shadow: 0 0 28px rgba(185, 46, 255, .42), inset 0 0 38px rgba(215, 38, 255, .13) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) > button::before {
  content: "HOST";
  position: absolute;
  top: 9px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 20px;
  border-radius: 999px;
  border: 1px solid rgba(241, 94, 255, .72);
  background: rgba(10,0,20,.82);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 2px;
  z-index: 20;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) img {
  width: 145px !important;
  height: 145px !important;
  max-width: 48% !important;
  object-fit: cover !important;
  border-radius: 28px !important;
  border: 2px solid rgba(236, 72, 255, .68) !important;
  box-shadow: 0 0 24px rgba(217, 70, 239, .45) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) .text-\[11px\] {
  font-size: 15px !important;
  font-weight: 900 !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) .text-\[10px\] {
  font-size: 13px !important;
}

/* Seat positions around host: 1..20 exactly like the supplied reference. */
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

/* Hide the old inline empty-seat spacing and make seat cards look like reference. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] .relative.flex.flex-col.items-center.gap-1\.5 {
  gap: 0 !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] .relative.flex.flex-col.items-center.gap-1\.5 > button {
  border-radius: 16px !important;
  border-color: rgba(147, 51, 234, .72) !important;
  background: linear-gradient(145deg, rgba(9,3,18,.96), rgba(2,0,8,.98)) !important;
  box-shadow: inset 0 0 16px rgba(168, 85, 247, .07), 0 0 12px rgba(168, 85, 247, .08) !important;
}
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] .relative.flex.flex-col.items-center.gap-1\.5 > button img {
  border-radius: 12px !important;
}

/* Host controls immediately under the stage. */
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] + div,
body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] ~ div .grid.h-9.w-9 {
  border-color: rgba(188, 60, 255, .55) !important;
}

/* Announcement/chat region. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.mt-4.w-full.max-w-md.px-3 {
  width: min(820px, calc(100% - 24px)) !important;
  margin-top: 8px !important;
  padding: 0 !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.mt-2.flex.w-full.max-w-md.min-h-0.flex-1.flex-col.px-2 {
  width: min(820px, calc(100% - 24px)) !important;
  max-width: 820px !important;
  flex: none !important;
  min-height: 330px !important;
  margin: 10px auto 0 !important;
  padding: 0 !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1.65fr) minmax(230px, .75fr) !important;
  gap: 12px !important;
}
/* Existing chat transcript inside this section */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.mt-2.flex.w-full.max-w-md.min-h-0.flex-1.flex-col.px-2 > div > div:first-child {
  width: 100% !important;
  min-height: 330px !important;
  border: 1px solid rgba(153, 48, 255, .42) !important;
  border-radius: 22px !important;
  background: rgba(3,0,10,.82) !important;
  box-shadow: inset 0 0 30px rgba(153, 48, 255, .04) !important;
  padding: 12px !important;
}

/* Popularity widget becomes the compact right-side panel from the reference. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.mt-2.flex.w-full.max-w-md.min-h-0.flex-1.flex-col.px-2 > div > div:first-child + div {
  width: 100% !important;
  min-height: 330px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col .h-\[300px\] {
  height: 112px !important;
  min-height: 112px !important;
  border-radius: 18px !important;
}

/* Footer/composer dock: dark glass pill with neon controls. */
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.shrink-0.px-3.pt-2 {
  width: min(820px, calc(100% - 24px)) !important;
  max-width: 820px !important;
  padding: 8px 0 calc(env(safe-area-inset-bottom) + 12px) !important;
  margin-top: 8px !important;
}
body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.w-full.max-w-md.shrink-0.px-3.pt-2 > div.flex.items-center.gap-1\.5 {
  min-height: 64px !important;
  padding: 8px 12px !important;
  border: 1px solid rgba(178, 51, 255, .45) !important;
  border-radius: 22px !important;
  background: rgba(5,1,12,.92) !important;
  box-shadow: 0 0 24px rgba(172, 44, 255, .12), inset 0 0 18px rgba(172, 44, 255, .04) !important;
}
body:has([data-jalwa-voice-room-redesign]) input,
body:has([data-jalwa-voice-room-redesign]) textarea {
  background: rgba(4,1,10,.88) !important;
  border-color: rgba(177, 57, 255, .36) !important;
}

/* Make the supplied 20-seat design responsive without collapsing the stage. */
@media (max-width: 760px) {
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] {
    width: calc(100vw - 12px) !important;
    gap: 5px !important;
    grid-template-rows: repeat(6, minmax(56px, 1fr)) !important;
  }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div:nth-child(1) > button {
    min-height: 220px !important;
    border-radius: 20px !important;
  }
  body:has([data-jalwa-voice-room-redesign]) [style*="grid-template-columns"] > div > button {
    min-height: 62px !important;
    border-radius: 11px !important;
  }
  body:has([data-jalwa-voice-room-redesign]) > div.fixed.inset-0.flex.flex-col > div.relative.z-10.mx-auto.mt-2.flex.w-full.max-w-md.min-h-0.flex-1.flex-col.px-2 {
    grid-template-columns: 1fr !important;
    min-height: 0 !important;
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
