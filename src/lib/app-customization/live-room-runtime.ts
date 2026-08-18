import type { AppComponentNode, AppPageConfig, ComponentStyle } from "./schema";
import { flattenLiveRoomRegistry } from "./live-room-registry";

type LiveKind = "voice-room" | "video-room" | "pk-battle";
const selectors: Record<string, string[]> = {
  "room-header": ["[data-room-header]", "header", "[class*='room-header']"], "room-info": ["[data-room-info]", "[class*='room-info']", "[class*='roomInfo']"],
  "room-chat": ["[data-room-chat]", "[class*='room-chat']", "textarea", "input[placeholder*='message' i]", "input[placeholder*='chat' i]"],
  "room-gifts": ["[data-gift-notification]", "[class*='gift-notification']", "[class*='gift-animation']"], "room-announcement": ["[data-room-announcement]", "[class*='announcement']"],
  "room-controls": ["[data-room-controls]", "[class*='room-controls']"], "bottom-sheet": ["[data-bottom-sheet]", "[role='dialog'][data-state]", "[class*='bottom-sheet']"],
  "voice-seat": ["[data-seat]", "[data-seat-id]", "[class*='seat-']", "[class*='seat ']"], "host-card": ["[data-host-card]", "[class*='host-card']"], waveform: ["[data-waveform]", "canvas[class*='wave']", "[class*='waveform']"],
  "mic-control": ["button[aria-label*='microphone' i]", "button[aria-label*='mic' i]", "button[title*='microphone' i]", "button[title*='mic' i]"], "mute-all": ["button[aria-label*='mute all' i]", "button[title*='mute all' i]"],
  "video-tile": ["[data-video-tile]", "video", "[class*='video-tile']", "[class*='participant-video']"], "video-grid": ["[data-video-grid]", "[class*='video-grid']"],
  "camera-control": ["button[aria-label*='camera' i]", "button[title*='camera' i]"], "active-speaker": ["[data-active-speaker]", "[class*='active-speaker']"],
  "pk-team-a": ["[data-pk-team='a']", "[data-team='a']", "[class*='team-a']"], "pk-team-b": ["[data-pk-team='b']", "[data-team='b']", "[class*='team-b']"],
  "pk-score": ["[data-pk-score]", "[class*='pk-score']", "[class*='score']"], "pk-vs": ["[data-pk-vs]", "[class*='pk-vs']", "[class*='vs-graphic']"], "pk-timer": ["[data-pk-timer]", "[class*='pk-timer']", "[class*='battle-timer']"],
  "pk-progress": ["[data-pk-progress]", "[class*='pk-progress']", "[class*='battle-progress']"], "winner-overlay": ["[data-winner-overlay]", "[class*='winner-overlay']"], "bottom-navigation": ["[data-bottom-nav]", "nav[aria-label*='bottom' i]", "[class*='bottom-nav']"],
};
function isRoomPath(pathname: string) { return pathname.includes("/room/") || pathname.includes("/pk/") || pathname.includes("/voice-room") || pathname.includes("/video-room"); }
function unique(elements: Element[]) { return Array.from(new Set(elements)); }
function findElements(type: string) { const result: Element[] = []; for (const selector of selectors[type] ?? []) { try { result.push(...Array.from(document.querySelectorAll(selector))); } catch {} } return unique(result); }
function applyStyle(target: HTMLElement, style: ComponentStyle | undefined) {
  if (!style) return;
  const { spacing, shadows, gradient, ...css } = style as ComponentStyle;
  for (const [key, value] of Object.entries(css)) { if (value === undefined || value === null || key === "x" || key === "y") continue; try { (target.style as unknown as Record<string, string | number>)[key] = value as string | number; } catch {} }
  if (style.x !== undefined || style.y !== undefined) target.style.translate = `${style.x ?? 0}px ${style.y ?? 0}px`;
  if (spacing) { target.style.marginTop = spacing.top == null ? "" : String(spacing.top); target.style.marginRight = spacing.right == null ? "" : String(spacing.right); target.style.marginBottom = spacing.bottom == null ? "" : String(spacing.bottom); target.style.marginLeft = spacing.left == null ? "" : String(spacing.left); }
  if (shadows?.length && !style.boxShadow) target.style.boxShadow = shadows.map((s) => `${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`).join(", ");
  if (gradient?.stops?.length && !style.background) { const angle = gradient.angle ?? 180; target.style.background = `${gradient.type}-gradient(${angle}deg, ${gradient.stops.map((s) => `${s.color} ${s.position}%`).join(", ")})`; }
}
function applyNode(target: Element, node: AppComponentNode) {
  if (!(target instanceof HTMLElement)) return;
  target.setAttribute("data-jalwa-live-node", node.id); target.setAttribute("data-jalwa-live-component", String(node.props?.componentType ?? "")); target.setAttribute("data-jalwa-live-component-id", String(node.props?.componentId ?? ""));
  target.toggleAttribute("data-jalwa-live-hidden", node.visible === false); if (node.visible === false) target.style.display = "none"; else applyStyle(target, node.style);
}
function componentKind(pathname: string): LiveKind { return pathname.includes("/pk/") ? "pk-battle" : pathname.includes("video") ? "video-room" : "voice-room"; }
function registryKind(kind: LiveKind) { return kind === "voice-room" ? "voice" : kind === "video-room" ? "video" : "pk"; }

export function bindLiveRoomComponents(pathname: string, config?: AppPageConfig) {
  if (typeof document === "undefined" || !isRoomPath(pathname)) return () => undefined;
  const kind = componentKind(pathname); const root = document.querySelector("main") ?? document.body; root.setAttribute("data-jalwa-live-room", kind);
  const registry = new Map(flattenLiveRoomRegistry(registryKind(kind)).slice(1).map((item) => [item.id, item])); const studioPreview = new URLSearchParams(window.location.search).get("studioPreview") === "1";
  const bound = new WeakMap<Element, string>(); const listeners = new Map<Element, EventListener>(); const moveListeners = new Map<Element, EventListener>(); let currentConfig = config; let stopped = false;
  const bind = () => {
    if (stopped) return;
    const nodes = (currentConfig?.sections ?? []).filter((node) => node.props?.roomType === kind); const counters = new Map<string, number>();
    for (const node of nodes) {
      const componentId = String(node.props?.componentId ?? ""); const component = registry.get(componentId); const type = String(node.props?.componentType ?? component?.runtimeType ?? component?.type ?? ""); if (!type) continue;
      const matches = findElements(type); const index = Number(node.props?.instanceIndex ?? counters.get(componentId) ?? 0); counters.set(componentId, index + 1); const target = matches[index] ?? matches[0]; if (!target) continue; applyNode(target, node);
      if (studioPreview && bound.get(target) !== node.id && target instanceof HTMLElement) {
        const click: EventListener = (event) => { event.preventDefault(); event.stopPropagation(); window.parent.postMessage({ type: "jalwa-live-select", nodeId: node.id, componentId }, "*"); };
        target.addEventListener("click", click, true); bound.set(target, node.id); listeners.set(target, click);
        const drag: EventListener = (event) => {
          if ((node.locked ?? false) || !(event instanceof PointerEvent) || event.button !== 0) return;
          event.preventDefault(); event.stopPropagation(); window.parent.postMessage({ type: "jalwa-live-select", nodeId: node.id, componentId }, "*");
          const startX = event.clientX, startY = event.clientY; const startLeft = Number(node.style?.x ?? 0), startTop = Number(node.style?.y ?? 0); target.setPointerCapture?.(event.pointerId);
          const move = (e: PointerEvent) => { target.style.translate = `${startLeft + e.clientX - startX}px ${startTop + e.clientY - startY}px`; };
          const up = (e: PointerEvent) => { target.releasePointerCapture?.(e.pointerId); target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); const x = Math.round(startLeft + e.clientX - startX), y = Math.round(startTop + e.clientY - startY); window.parent.postMessage({ type: "jalwa-live-move", nodeId: node.id, x, y }, "*"); };
          target.addEventListener("pointermove", move); target.addEventListener("pointerup", up, { once: true });
        };
        target.addEventListener("pointerdown", drag, true); moveListeners.set(target, drag);
        target.style.cursor = "move";
      }
    }
  };
  const studioMessage = (event: MessageEvent) => { if (!studioPreview || event.data?.type !== "jalwa-live-studio-config" || !event.data.config) return; currentConfig = event.data.config as AppPageConfig; bind(); };
  if (studioPreview) window.addEventListener("message", studioMessage); bind(); const observer = new MutationObserver(() => bind()); observer.observe(root, { childList: true, subtree: true });
  return () => { stopped = true; observer.disconnect(); if (studioPreview) window.removeEventListener("message", studioMessage); listeners.forEach((listener, target) => target.removeEventListener("click", listener, true)); moveListeners.forEach((listener, target) => target.removeEventListener("pointerdown", listener, true)); listeners.clear(); moveListeners.clear(); };
}
