import type { AppComponentNode, AppPageConfig, ComponentStyle, DeviceKind, ResponsiveRule } from "./schema";
import type { LiveRoomComponent, LiveRoomKind } from "./live-room-registry";

export type LiveRoomBreakpoint = DeviceKind;
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface CanvasRect { left: number; top: number; width: number; height: number; }
export interface ResizeResult { rect: CanvasRect; changedPosition: boolean; }

export const LIVE_ROOM_BREAKPOINTS: Record<LiveRoomBreakpoint, { label: string; width: number; height: number }> = {
  mobile: { label: "Mobile", width: 390, height: 844 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  desktop: { label: "Desktop", width: 1440, height: 900 },
};

export const LIVE_ROOM_DEFAULT_RESPONSIVE: Record<LiveRoomBreakpoint, ResponsiveRule> = {
  mobile: {}, tablet: {}, desktop: {},
};

export function resizeFromHandle(start: CanvasRect, handle: ResizeHandle, dx: number, dy: number, minWidth = 24, minHeight = 24, maxWidth = Number.POSITIVE_INFINITY, maxHeight = Number.POSITIVE_INFINITY): ResizeResult {
  let { left, top, width, height } = start;
  if (handle.includes("e")) width += dx;
  if (handle.includes("s")) height += dy;
  if (handle.includes("w")) { width -= dx; left += dx; }
  if (handle.includes("n")) { height -= dy; top += dy; }
  width = Math.min(maxWidth, Math.max(minWidth, width));
  height = Math.min(maxHeight, Math.max(minHeight, height));
  if (handle.includes("w")) left = start.left + (start.width - width);
  if (handle.includes("n")) top = start.top + (start.height - height);
  return { rect: { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }, changedPosition: handle.includes("n") || handle.includes("w") };
}

export function responsiveStyle(node: AppComponentNode, device: LiveRoomBreakpoint): ComponentStyle {
  return { ...(node.style ?? {}), ...(node.responsive?.[device]?.style ?? {}) };
}

export function setResponsiveStyle(config: AppPageConfig, nodeId: string, device: LiveRoomBreakpoint, style: ComponentStyle, visible?: boolean): AppPageConfig {
  const patch = (node: AppComponentNode): AppComponentNode => {
    if (node.id === nodeId) {
      const current = node.responsive?.[device] ?? {};
      const responsive = { ...(node.responsive ?? {}), [device]: { ...current, style, ...(visible === undefined ? {} : { visible }) } };
      return { ...node, responsive };
    }
    return node.children?.length ? { ...node, children: node.children.map(patch) } : node;
  };
  return { ...config, sections: config.sections.map(patch) };
}

export function cloneForDevice(config: AppPageConfig, device: LiveRoomBreakpoint): AppPageConfig {
  return {
    ...structuredClone(config),
    sections: config.sections.map((node) => ({
      ...structuredClone(node),
      style: responsiveStyle(node, device),
      children: node.children,
    })),
  };
}

export function componentInstances(registry: LiveRoomComponent, kind: LiveRoomKind): AppComponentNode[] {
  const repeatCount = registry.repeatable ? (registry.id.includes("seat") ? 20 : registry.id.includes("participant") ? 9 : registry.id.includes("team") ? 2 : 1) : 1;
  return Array.from({ length: repeatCount }, (_, index) => ({
    id: `${registry.id}-${index + 1}`,
    type: "custom",
    name: `${registry.label}${registry.repeatable ? ` ${index + 1}` : ""}`,
    visible: true,
    locked: false,
    props: { componentId: registry.id, componentType: registry.runtimeType ?? registry.type, roomType: kind, instanceIndex: index, stateful: true },
    style: {},
    responsive: structuredClone(LIVE_ROOM_DEFAULT_RESPONSIVE),
  }));
}

export function clampRect(rect: CanvasRect, canvas: { width: number; height: number }, allowOverflow = false): CanvasRect {
  if (allowOverflow) return rect;
  return { ...rect, left: Math.max(0, Math.min(rect.left, Math.max(0, canvas.width - rect.width))), top: Math.max(0, Math.min(rect.top, Math.max(0, canvas.height - rect.height))) };
}
