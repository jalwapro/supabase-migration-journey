export type DeviceKind = "mobile" | "tablet" | "desktop";
export type AppPageKey =
  | "home" | "rooms" | "voice-room" | "video-room" | "pk-battle" | "profile"
  | "wallet" | "messages" | "ranking" | "gifts" | "notifications" | "settings"
  | "my-rooms" | "recharge" | "recharge-history" | "withdraw" | "gallery" | "visitors" | "games" | "privacy"
  | "login" | "register" | "splash";

export type ComponentType =
  | "container" | "text" | "heading" | "image" | "button" | "card" | "banner"
  | "carousel" | "grid" | "tabs" | "avatar" | "progress" | "counter"
  | "user-profile-card" | "live-room-card" | "voice-room-card" | "video-room-card"
  | "pk-battle-card" | "gift-card" | "gift-grid" | "coin-balance" | "diamond-balance"
  | "recharge-packages" | "ranking-list" | "leaderboard" | "vip-badge" | "level-progress"
  | "friend-list" | "chat-list" | "notification-list" | "follow-button" | "live-button"
  | "create-room-button" | "pk-battle-button" | "room-seat-layout" | "header" | "bottom-navigation";

export interface ComponentStyle {
  width?: string | number; height?: string | number; minHeight?: string | number;
  padding?: string; margin?: string; background?: string; color?: string; border?: string;
  borderRadius?: string | number; boxShadow?: string; opacity?: number; display?: string;
  gap?: string | number; fontSize?: string | number; fontWeight?: string | number;
  lineHeight?: string | number; letterSpacing?: string | number;
}

export interface StudioRuntimeOverride {
  id: string;
  selector: string;
  style: ComponentStyle;
  visible?: boolean;
}

export interface AppComponentNode {
  id: string; type: ComponentType; name?: string; visible?: boolean; locked?: boolean;
  props?: Record<string, unknown>; style?: ComponentStyle;
  responsive?: Partial<Record<DeviceKind, ComponentStyle>>;
  action?: { type: string; value?: string }; children?: AppComponentNode[];
}

export interface AppPageConfig {
  schemaVersion: 1; page: AppPageKey; theme: string; sections: AppComponentNode[];
  navigation?: Record<string, unknown>; responsive?: Partial<Record<DeviceKind, Record<string, unknown>>>;
  runtimeOverrides?: StudioRuntimeOverride[];
}

export const DEFAULT_APP_CONFIG: AppPageConfig = {
  schemaVersion: 1, page: "home", theme: "default", sections: [],
  navigation: {}, responsive: { mobile: {}, tablet: {}, desktop: {} }, runtimeOverrides: [],
};

const SAFE_TYPES: ComponentType[] = [
  "container","text","heading","image","button","card","banner","carousel","grid","tabs","avatar","progress","counter",
  "user-profile-card","live-room-card","voice-room-card","video-room-card","pk-battle-card","gift-card","gift-grid","coin-balance","diamond-balance",
  "recharge-packages","ranking-list","leaderboard","vip-badge","level-progress","friend-list","chat-list","notification-list","follow-button","live-button",
  "create-room-button","pk-battle-button","room-seat-layout","header","bottom-navigation",
];

export function isSafeComponentType(value: unknown): value is ComponentType {
  return typeof value === "string" && SAFE_TYPES.includes(value as ComponentType);
}

export function normalizePageConfig(raw: unknown, page: AppPageKey): AppPageConfig {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const sections = Array.isArray(source.sections)
    ? source.sections.filter((node) => node && typeof node === "object" && isSafeComponentType((node as Record<string, unknown>).type)) as AppComponentNode[]
    : [];
  const runtimeOverrides = Array.isArray(source.runtimeOverrides)
    ? source.runtimeOverrides.filter((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).selector === "string").map((item) => {
        const value = item as Record<string, unknown>;
        return {
          id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
          selector: String(value.selector),
          style: value.style && typeof value.style === "object" ? value.style as ComponentStyle : {},
          visible: value.visible !== false,
        } satisfies StudioRuntimeOverride;
      })
    : [];
  return {
    schemaVersion: 1, page,
    theme: typeof source.theme === "string" ? source.theme : "default",
    sections,
    navigation: source.navigation && typeof source.navigation === "object" ? source.navigation as Record<string, unknown> : {},
    responsive: source.responsive && typeof source.responsive === "object" ? source.responsive as AppPageConfig["responsive"] : { mobile: {}, tablet: {}, desktop: {} },
    runtimeOverrides,
  };
}
