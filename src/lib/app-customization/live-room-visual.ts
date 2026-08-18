import type { AppComponentNode, ComponentStyle, DeviceKind } from "./schema";

export type LiveVisualPatch = Partial<ComponentStyle> & { animation?: { name?: string; duration?: string; timing?: string; delay?: string; iterationCount?: string | number; direction?: string; fillMode?: string; playState?: string } };

export const LIVE_VISUAL_GROUPS = {
  layout: ["x","y","width","height","minWidth","maxWidth","minHeight","maxHeight","position","zIndex","display","overflow"],
  spacing: ["padding","margin","gap","rowGap","columnGap"],
  typography: ["fontFamily","fontSize","fontWeight","fontStyle","lineHeight","letterSpacing","textAlign","textTransform","textDecoration","textShadow"],
  appearance: ["background","backgroundImage","color","opacity","filter","backdropFilter"],
  border: ["border","borderWidth","borderColor","borderStyle","borderRadius","borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"],
  effects: ["boxShadow","transform","translate","objectFit","objectPosition"],
} as const;

export function getLiveDeviceStyle(node: AppComponentNode, device: DeviceKind): ComponentStyle { return { ...(node.style ?? {}), ...(node.responsive?.[device]?.style ?? {}) }; }

export function patchLiveDeviceStyle(node: AppComponentNode, device: DeviceKind, patch: LiveVisualPatch): AppComponentNode {
  const responsive = { ...(node.responsive ?? {}) };
  responsive[device] = { ...(responsive[device] ?? {}), style: { ...getLiveDeviceStyle(node, device), ...patch } };
  return { ...node, responsive };
}

export function clearLiveDeviceStyle(node: AppComponentNode, device: DeviceKind, keys?: readonly string[]): AppComponentNode {
  const current = getLiveDeviceStyle(node, device);
  if (!keys) return patchLiveDeviceStyle(node, device, {});
  const next = { ...current } as Record<string, unknown>;
  keys.forEach(k => delete next[k]);
  return patchLiveDeviceStyle(node, device, next as ComponentStyle);
}

export function animationToCss(animation?: LiveVisualPatch["animation"]): Record<string,string> {
  if (!animation?.name) return {};
  return {
    animationName: animation.name,
    animationDuration: animation.duration ?? "300ms",
    animationTimingFunction: animation.timing ?? "ease",
    animationDelay: animation.delay ?? "0ms",
    animationIterationCount: String(animation.iterationCount ?? 1),
    animationDirection: animation.direction ?? "normal",
    animationFillMode: animation.fillMode ?? "both",
    animationPlayState: animation.playState ?? "running",
  };
}

export function resolveLiveVisualStyle(node: AppComponentNode, device: DeviceKind): ComponentStyle {
  const style = getLiveDeviceStyle(node, device);
  const animation = (node.props?.animation ?? node.props?.animationConfig) as LiveVisualPatch["animation"] | undefined;
  return { ...style, ...animationToCss(animation) };
}
