import type { AppComponentNode, AppPageConfig, ComponentStyle, DeviceKind } from "./schema";
import { flattenLiveRoomRegistry } from "./live-room-registry";
import { getLiveRoomStateConfig } from "./live-room-state-config";

type LiveKind = "voice-room" | "video-room" | "pk-battle";

type LiveTargetBinding = {
  key: string;
  click?: EventListener;
  pointerDown?: EventListener;
  resizeObserver?: ResizeObserver;
};

const selectors: Record<string, string[]> = {
  "room-header": ["[data-room-header]", "header", "[class*='room-header']"],
  "room-info": ["[data-room-info]", "[class*='room-info']", "[class*='roomInfo']"],
  "room-chat": ["[data-room-chat]", "[class*='room-chat']", "textarea", "input[placeholder*='message' i]", "input[placeholder*='chat' i]"],
  "room-gifts": ["[data-gift-notification]", "[class*='gift-notification']", "[class*='gift-animation']"],
  "room-announcement": ["[data-room-announcement]", "[class*='announcement']"],
  "room-controls": ["[data-room-controls]", "[class*='room-controls']"],
  "bottom-sheet": ["[data-bottom-sheet]", "[role='dialog'][data-state]", "[class*='bottom-sheet']"],
  "voice-seat": ["[data-seat]", "[data-seat-id]", "[class*='seat-']", "[class*='seat ']"],
  "host-card": ["[data-host-card]", "[class*='host-card']"],
  waveform: ["[data-waveform]", "canvas[class*='wave']", "[class*='waveform']"],
  "room-audio-controls": ["[data-room-audio-controls]", "[data-room-controls]", "[class*='voice-controls']", "[class*='audio-controls']"],
  "video-tile": ["[data-video-tile]", "video", "[class*='video-tile']", "[class*='participant-video']"],
  "video-grid": ["[data-video-grid]", "[class*='video-grid']"],
  "camera-control": ["button[aria-label*='camera' i]", "button[title*='camera' i]"],
  "active-speaker": ["[data-active-speaker]", "[class*='active-speaker']"],
  "pk-team-a": ["[data-pk-team='a']", "[data-team='a']", "[class*='team-a']"],
  "pk-team-b": ["[data-pk-team='b']", "[data-team='b']", "[class*='team-b']"],
  "pk-score": ["[data-pk-score]", "[class*='pk-score']", "[class*='score']"],
  "pk-vs": ["[data-pk-vs]", "[class*='pk-vs']", "[class*='vs-graphic']"],
  "pk-timer": ["[data-pk-timer]", "[class*='pk-timer']", "[class*='battle-timer']"],
  "pk-progress": ["[data-pk-progress]", "[class*='pk-progress']", "[class*='battle-progress']"],
  "winner-overlay": ["[data-winner-overlay]", "[class*='winner-overlay']"],
  "bottom-navigation": ["[data-bottom-nav]", "nav[aria-label*='bottom' i]", "[class*='bottom-nav']"],
};

function isRoomPath(pathname: string) {
  return pathname.includes("/room/") || pathname.includes("/pk/") || pathname.includes("/voice-room") || pathname.includes("/video-room");
}

function unique(elements: Element[]) {
  return Array.from(new Set(elements));
}

function findElements(type: string) {
  const results: Element[] = [];
  for (const selector of selectors[type] ?? []) {
    try {
      results.push(...Array.from(document.querySelectorAll(selector)));
    } catch {
      // Ignore an invalid optional selector and continue discovery.
    }
  }
  return unique(results);
}

function deviceKind(): DeviceKind {
  const width = window.innerWidth;
  return width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

function responsiveStyle(node: AppComponentNode, device: DeviceKind): ComponentStyle | undefined {
  return node.responsive?.[device]?.style ?? node.style;
}

function applyStyle(target: HTMLElement, style: ComponentStyle | undefined) {
  if (!style) return;
  const { spacing, shadows, gradient, ...css } = style as ComponentStyle;
  for (const [key, value] of Object.entries(css)) {
    if (value == null || key === "x" || key === "y") continue;
    try {
      (target.style as unknown as Record<string, string | number>)[key] = value as string | number;
    } catch {
      // Ignore a style that the browser does not accept.
    }
  }
  if (style.x !== undefined || style.y !== undefined) {
    target.style.translate = `${style.x ?? 0}px ${style.y ?? 0}px`;
  }
  if (spacing) {
    target.style.marginTop = spacing.top == null ? "" : String(spacing.top);
    target.style.marginRight = spacing.right == null ? "" : String(spacing.right);
    target.style.marginBottom = spacing.bottom == null ? "" : String(spacing.bottom);
    target.style.marginLeft = spacing.left == null ? "" : String(spacing.left);
  }
  if (shadows?.length && !style.boxShadow) {
    target.style.boxShadow = shadows
      .map((shadow) => `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread ?? 0}px ${shadow.color}`)
      .join(", ");
  }
  if (gradient?.stops?.length && !style.background) {
    const angle = gradient.angle ?? 180;
    target.style.background = `${gradient.type}-gradient(${angle}deg, ${gradient.stops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`;
  }
}

function applyNode(target: Element, node: AppComponentNode, device: DeviceKind) {
  if (!(target instanceof HTMLElement)) return;
  target.setAttribute("data-jalwa-live-node", node.id);
  target.setAttribute("data-jalwa-live-component", String(node.props?.componentType ?? ""));
  target.setAttribute("data-jalwa-live-component-id", String(node.props?.componentId ?? ""));
  target.setAttribute("data-jalwa-live-instance-index", String(node.props?.instanceIndex ?? 0));

  const responsive = node.responsive?.[device];
  const hidden = node.visible === false || responsive?.visible === false;
  target.toggleAttribute("data-jalwa-live-hidden", hidden);
  if (hidden) {
    target.style.display = "none";
    return;
  }
  target.style.display = "";
  applyStyle(target, responsiveStyle(node, device));
}

function componentKind(pathname: string): LiveKind {
  if (pathname.includes("/pk/")) return "pk-battle";
  if (pathname.includes("video")) return "video-room";
  return "voice-room";
}

function registryKind(kind: LiveKind) {
  return kind === "voice-room" ? "voice" : kind === "video-room" ? "video" : "pk";
}

function stableKey(node: AppComponentNode) {
  return `${String(node.props?.componentId ?? "")}:${Number(node.props?.instanceIndex ?? 0)}`;
}

export function bindLiveRoomComponents(pathname: string, config?: AppPageConfig) {
  if (typeof document === "undefined" || !isRoomPath(pathname)) return () => undefined;

  const kind = componentKind(pathname);
  const root = document.querySelector("main") ?? document.body;
  root.setAttribute("data-jalwa-live-room", kind);

  const registry = new Map(flattenLiveRoomRegistry(registryKind(kind)).slice(1).map((item) => [item.id, item]));
  const studioPreview = new URLSearchParams(window.location.search).get("studioPreview") === "1";
  const bindings = new WeakMap<Element, LiveTargetBinding>();
  const trackedTargets = new Set<Element>();
  const resizeBaseline = new WeakMap<Element, { width: number; height: number }>();

  let currentConfig = config;
  let stopped = false;
  let device = deviceKind();
  let focused: string | null = null;
  let currentState = new URLSearchParams(window.location.search).get("studioState") || String(root.getAttribute("data-jalwa-live-state") || "normal");

  const getNodes = () => {
    const base = (currentConfig?.sections ?? []).filter(
      (node) => node.props?.roomType === kind && (node.props?.roomState === currentState || !node.props?.roomState),
    );
    const saved = getLiveRoomStateConfig(currentConfig ?? ({ sections: [] } as AppPageConfig), kind, currentState);
    return (saved?.sections ?? base).filter(
      (node) => node.props?.roomType === kind && (node.props?.roomState === currentState || !node.props?.roomState),
    );
  };

  const cleanupTarget = (target: Element) => {
    const binding = bindings.get(target);
    if (!binding) return;
    if (binding.click) target.removeEventListener("click", binding.click, true);
    if (binding.pointerDown) target.removeEventListener("pointerdown", binding.pointerDown, true);
    binding.resizeObserver?.disconnect();
    bindings.delete(target);
    trackedTargets.delete(target);
  };

  const cleanupAll = () => {
    trackedTargets.forEach(cleanupTarget);
    trackedTargets.clear();
  };

  const bind = () => {
    if (stopped) return;
    device = deviceKind();
    const nodes = getNodes();
    const counters = new Map<string, number>();
    const activeTargets = new Set<Element>();

    for (const node of nodes) {
      const componentId = String(node.props?.componentId ?? "");
      const component = registry.get(componentId);
      const type = String(node.props?.componentType ?? component?.runtimeType ?? component?.type ?? "");
      if (!type) continue;

      const matches = findElements(type);
      const index = Number(node.props?.instanceIndex ?? counters.get(componentId) ?? 0);
      counters.set(componentId, index + 1);
      const target = matches[index] ?? matches[0];
      if (!target) continue;

      activeTargets.add(target);
      const key = stableKey(node);
      applyNode(target, node, device);

      if (target instanceof HTMLElement) {
        target.setAttribute("data-jalwa-live-stable-key", key);
        target.style.outline = focused === key ? "2px solid hsl(var(--primary))" : "";
        target.style.outlineOffset = focused === key ? "2px" : "";
      }

      if (!studioPreview || !(target instanceof HTMLElement)) continue;
      const existing = bindings.get(target);
      if (existing?.key === key) continue;
      if (existing) cleanupTarget(target);

      const click: EventListener = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage(
          { type: "jalwa-live-select", nodeId: node.id, componentId, instanceIndex: index, stableKey: key, roomType: kind, roomState: currentState },
          "*",
        );
      };

      const pointerDown: EventListener = (event) => {
        if (node.locked || !(event instanceof PointerEvent) || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage(
          { type: "jalwa-live-select", nodeId: node.id, componentId, instanceIndex: index, stableKey: key, roomType: kind, roomState: currentState },
          "*",
        );
        const startX = event.clientX;
        const startY = event.clientY;
        const startTranslateX = Number(node.responsive?.[device]?.style?.x ?? node.style?.x ?? 0);
        const startTranslateY = Number(node.responsive?.[device]?.style?.y ?? node.style?.y ?? 0);
        target.setPointerCapture?.(event.pointerId);
        const move = (moveEvent: PointerEvent) => {
          target.style.translate = `${startTranslateX + moveEvent.clientX - startX}px ${startTranslateY + moveEvent.clientY - startY}px`;
        };
        const up = (upEvent: PointerEvent) => {
          target.releasePointerCapture?.(upEvent.pointerId);
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", up);
          window.parent.postMessage(
            {
              type: "jalwa-live-move",
              nodeId: node.id,
              componentId,
              instanceIndex: index,
              stableKey: key,
              x: Math.round(startTranslateX + upEvent.clientX - startX),
              y: Math.round(startTranslateY + upEvent.clientY - startY),
              device,
              roomType: kind,
              roomState: currentState,
            },
            "*",
          );
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", up, { once: true });
      };

      target.addEventListener("click", click, true);
      target.addEventListener("pointerdown", pointerDown, true);
      target.style.cursor = node.locked ? "" : "move";
      target.style.resize = node.locked ? "" : "both";
      target.style.overflow = target.style.overflow || "auto";
      target.setAttribute("data-jalwa-live-resizable", "true");

      const baseline = { width: Math.round(target.getBoundingClientRect().width), height: Math.round(target.getBoundingClientRect().height) };
      resizeBaseline.set(target, baseline);
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const element = entry.target;
          if (!(element instanceof HTMLElement)) continue;
          const width = Math.round(entry.contentRect.width);
          const height = Math.round(entry.contentRect.height);
          const previous = resizeBaseline.get(element);
          if (!previous) {
            resizeBaseline.set(element, { width, height });
            continue;
          }
          if (width === previous.width && height === previous.height) continue;
          resizeBaseline.set(element, { width, height });
          window.parent.postMessage(
            { type: "jalwa-live-resize", nodeId: node.id, componentId, instanceIndex: index, stableKey: key, width, height, device, roomType: kind, roomState: currentState },
            "*",
          );
        }
      });
      resizeObserver.observe(target);
      bindings.set(target, { key, click, pointerDown, resizeObserver });
      trackedTargets.add(target);
    }

    trackedTargets.forEach((target) => {
      if (!activeTargets.has(target)) cleanupTarget(target);
    });
  };

  const setState = (state: string) => {
    currentState = state || "normal";
    root.setAttribute("data-jalwa-live-state", currentState);
    bind();
  };

  const studioMessage = (event: MessageEvent) => {
    if (!studioPreview) return;
    if (event.data?.type === "jalwa-live-studio-config" && event.data.config) {
      currentConfig = event.data.config as AppPageConfig;
      currentState = String(event.data.state ?? currentState);
      root.setAttribute("data-jalwa-live-state", currentState);
      bind();
    }
    if (event.data?.type === "jalwa-live-state") setState(String(event.data.state ?? "normal"));
    if (event.data?.type === "jalwa-live-focus") {
      focused = String(event.data.stableKey ?? event.data.componentId ?? "");
      if (event.data.state) currentState = String(event.data.state);
      bind();
      const matches = findElements(String(event.data.componentId ?? ""));
      const index = Number(event.data.instanceIndex ?? 0);
      matches[index]?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "center" });
    }
  };

  const stateEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail as { state?: string } | undefined;
    if (detail?.state) setState(detail.state);
  };

  window.addEventListener("message", studioMessage);
  window.addEventListener("jalwa-live-room-state", stateEvent);
  const onResize = () => bind();
  window.addEventListener("resize", onResize);
  bind();

  const observer = new MutationObserver(() => bind());
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    stopped = true;
    observer.disconnect();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("message", studioMessage);
    window.removeEventListener("jalwa-live-room-state", stateEvent);
    cleanupAll();
  };
}
