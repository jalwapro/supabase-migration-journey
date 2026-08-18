import type { ComponentStyle, DeviceKind, ResponsiveRule } from "./schema";

export const BREAKPOINTS: Record<DeviceKind, { min: number; max?: number }> = { mobile: { min: 0, max: 767 }, tablet: { min: 768, max: 1023 }, desktop: { min: 1024 } };
export function getDevice(width: number): DeviceKind { return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop"; }
export function resolveResponsiveStyle(base: ComponentStyle = {}, rules?: Partial<Record<DeviceKind, ResponsiveRule>>, device: DeviceKind = "mobile"): ComponentStyle {
  const fallback: DeviceKind[] = device === "mobile" ? ["mobile"] : device === "tablet" ? ["mobile", "tablet"] : ["mobile", "tablet", "desktop"];
  return fallback.reduce<ComponentStyle>((style, key) => ({ ...style, ...(rules?.[key]?.style ?? {}) }), { ...base });
}
export function isVisibleAtDevice(rules: Partial<Record<DeviceKind, ResponsiveRule>> | undefined, device: DeviceKind) { return rules?.[device]?.visible !== false; }
