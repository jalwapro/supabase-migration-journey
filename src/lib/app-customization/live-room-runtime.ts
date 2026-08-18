import type { AppPageConfig } from "./schema";

type LiveKind = "voice-room" | "video-room" | "pk-battle";

const selectors: Record<string, string[]> = {
  "room-header": ["header", "[data-room-header]", "[class*='room-header']"],
  "room-chat": ["[data-room-chat]", "textarea", "input[placeholder*='message' i]", "input[placeholder*='chat' i]"],
  "room-gifts": ["[data-gift-notification]", "[class*='gift-notification']", "[class*='gift-animation']"],
  "room-announcement": ["[data-room-announcement]", "[class*='announcement']"],
  "room-controls": ["[data-room-controls]", "[class*='room-controls']"],
  "voice-seat": ["[data-seat]", "[data-seat-id]", "[class*='seat-']", "[class*='seat ']"],
  "host-card": ["[data-host-card]", "[class*='host-card']"],
  waveform: ["[data-waveform]", "canvas[class*='wave']", "[class*='waveform']"],
  "mic-control": ["button[aria-label*='microphone' i]", "button[aria-label*='mic' i]", "button[title*='microphone' i]", "button[title*='mic' i]"],
  "mute-all": ["button[aria-label*='mute all' i]", "button[title*='mute all' i]"],
  "video-tile": ["video", "[data-video-tile]", "[class*='video-tile']", "[class*='participant-video']"],
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
};

function isRoomPath(pathname: string) { return pathname.includes("/room/") || pathname.includes("/pk/") || pathname.includes("/voice-room") || pathname.includes("/video-room"); }
function unique(elements: Element[]) { return Array.from(new Set(elements)); }
function findElements(type: string) {
  const result: Element[] = [];
  for (const selector of selectors[type] ?? []) {
    try { result.push(...Array.from(document.querySelectorAll(selector))); } catch { /* invalid selector is ignored safely */ }
  }
  return unique(result);
}

export function bindLiveRoomComponents(pathname: string, config?: AppPageConfig) {
  if (typeof document === "undefined" || !isRoomPath(pathname)) return () => undefined;
  const kind: LiveKind = pathname.includes("/pk/") ? "pk-battle" : pathname.includes("video") ? "video-room" : "voice-room";
  const root = document.querySelector("main") ?? document.body;
  root.setAttribute("data-jalwa-live-room", kind);
  const tagged: Element[] = [];
  const counters = new Map<string, number>();
  for (const node of config?.sections ?? []) {
    const type = String(node.props?.componentType ?? "");
    if (!type || (node.props?.roomType && node.props.roomType !== kind)) continue;
    const matches = findElements(type);
    const index = counters.get(type) ?? 0;
    const target = matches[index] ?? matches[0];
    counters.set(type, index + 1);
    if (!target) continue;
    target.setAttribute("data-jalwa-live-component", type);
    target.setAttribute("data-jalwa-live-node", node.id);
    tagged.push(target);
  }

  const observer = new MutationObserver(() => {
    if (tagged.length === 0) return;
    for (const element of tagged) element.setAttribute("data-jalwa-live-bound", "true");
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
