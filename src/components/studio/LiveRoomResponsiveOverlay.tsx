import { useEffect, useState } from "react";

export type LiveRoomDevice = "mobile" | "tablet" | "desktop";
export type LiveRoomResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export interface LiveRoomRect { x: number; y: number; width: number; height: number; }

export const LIVE_ROOM_VIEWPORTS: Record<LiveRoomDevice, { width: number; height: number; label: string }> = {
  mobile: { width: 390, height: 844, label: "Mobile" },
  tablet: { width: 768, height: 1024, label: "Tablet" },
  desktop: { width: 1440, height: 900, label: "Desktop" },
};

const HANDLES: LiveRoomResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<LiveRoomResizeHandle, string> = { nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize", se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize" };

function clampRect(rect: LiveRoomRect, viewport: { width: number; height: number }): LiveRoomRect {
  const width = Math.max(24, Math.min(rect.width, viewport.width));
  const height = Math.max(24, Math.min(rect.height, viewport.height));
  return { ...rect, width, height, x: Math.max(0, Math.min(rect.x, viewport.width - width)), y: Math.max(0, Math.min(rect.y, viewport.height - height)) };
}

export interface LiveRoomResponsiveOverlayProps {
  rect: LiveRoomRect | null;
  device: LiveRoomDevice;
  onDeviceChange: (device: LiveRoomDevice) => void;
  onMove: (rect: LiveRoomRect) => void;
  onResize: (rect: LiveRoomRect) => void;
  grid?: number;
  snap?: boolean;
}

export function LiveRoomResponsiveOverlay({ rect, device, onDeviceChange, onMove, onResize, grid = 8, snap = true }: LiveRoomResponsiveOverlayProps) {
  const viewport = LIVE_ROOM_VIEWPORTS[device];
  const [interaction, setInteraction] = useState<{ mode: "move" | "resize"; handle?: LiveRoomResizeHandle; startX: number; startY: number; rect: LiveRoomRect } | null>(null);
  const [guides, setGuides] = useState<{ vertical?: number; horizontal?: number }>({});
  const snapValue = (value: number) => snap ? Math.round(value / grid) * grid : value;

  const beginMove = (event: React.PointerEvent) => {
    if (!rect) return;
    event.preventDefault(); event.stopPropagation();
    setInteraction({ mode: "move", startX: event.clientX, startY: event.clientY, rect });
  };
  const beginResize = (handle: LiveRoomResizeHandle) => (event: React.PointerEvent) => {
    if (!rect) return;
    event.preventDefault(); event.stopPropagation();
    setInteraction({ mode: "resize", handle, startX: event.clientX, startY: event.clientY, rect });
  };

  useEffect(() => {
    if (!interaction) return;
    const move = (event: PointerEvent) => {
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      const start = interaction.rect;
      if (interaction.mode === "move") {
        const next = clampRect({ ...start, x: snapValue(start.x + dx), y: snapValue(start.y + dy) }, viewport);
        setGuides({
          vertical: Math.abs(next.x + next.width / 2 - viewport.width / 2) <= grid ? viewport.width / 2 : undefined,
          horizontal: Math.abs(next.y + next.height / 2 - viewport.height / 2) <= grid ? viewport.height / 2 : undefined,
        });
        onMove(next);
        return;
      }
      const handle = interaction.handle!;
      let { x, y, width, height } = start;
      if (handle.includes("e")) width = start.width + dx;
      if (handle.includes("s")) height = start.height + dy;
      if (handle.includes("w")) { width = start.width - dx; x = start.x + dx; }
      if (handle.includes("n")) { height = start.height - dy; y = start.y + dy; }
      onResize(clampRect({ x: snapValue(x), y: snapValue(y), width: snapValue(width), height: snapValue(height) }, viewport));
    };
    const up = () => { setInteraction(null); setGuides({}); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [interaction, viewport, grid, snap, onMove, onResize]);

  if (!rect) return null;
  return <>
    <div data-studio-editor-ui className="fixed left-3 top-3 z-[2147483647] flex gap-1 rounded-xl border border-white/15 bg-black/90 p-1 text-white shadow-2xl backdrop-blur-xl">
      {(Object.keys(LIVE_ROOM_VIEWPORTS) as LiveRoomDevice[]).map((item) => <button key={item} type="button" onClick={() => onDeviceChange(item)} className={`rounded-lg px-3 py-1.5 text-[10px] ${device === item ? "bg-primary" : "bg-white/10"}`}>{LIVE_ROOM_VIEWPORTS[item].label}</button>)}
    </div>
    <div data-studio-editor-ui className="pointer-events-none fixed z-[2147483646] border border-primary/80" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
      {guides.vertical !== undefined && <span className="absolute -top-[100vh] bottom-0 left-1/2 w-px bg-primary/60" />}
      {guides.horizontal !== undefined && <span className="absolute -left-[100vw] right-0 top-1/2 h-px bg-primary/60" />}
      {HANDLES.map((handle) => <button key={handle} type="button" aria-label={`Resize ${handle}`} data-studio-editor-ui onPointerDown={beginResize(handle)} className="pointer-events-auto absolute h-3 w-3 rounded-sm border border-white bg-primary shadow" style={{ left: handle.includes("w") ? -6 : handle.includes("e") ? rect.width - 6 : rect.width / 2 - 6, top: handle.includes("n") ? -6 : handle.includes("s") ? rect.height - 6 : rect.height / 2 - 6, cursor: CURSORS[handle], touchAction: "none" }} />)}
      <button type="button" data-studio-editor-ui onPointerDown={beginMove} className="pointer-events-auto absolute left-1/2 -top-7 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-[9px] font-bold text-white shadow" style={{ cursor: "move", touchAction: "none" }}>MOVE</button>
      <span className="absolute -bottom-6 left-0 rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-white/80">{Math.round(rect.width)} × {Math.round(rect.height)} · {Math.round(rect.x)}, {Math.round(rect.y)}</span>
    </div>
    <div data-studio-editor-ui className="fixed right-3 top-3 z-[2147483647] rounded-xl border border-white/15 bg-black/90 px-3 py-2 text-[9px] text-white/70 shadow-2xl">{viewport.label} · {viewport.width}×{viewport.height} · grid {grid}px · snap {snap ? "ON" : "OFF"}</div>
  </>;
}
