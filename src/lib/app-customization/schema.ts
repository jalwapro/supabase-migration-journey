export type DeviceKind = "mobile" | "tablet" | "desktop";
export type PositionMode = "static" | "relative" | "absolute" | "fixed" | "sticky";
export type Unit = "px" | "%" | "rem" | "em" | "vw" | "vh" | "auto";
export type AppPageKey =
  | "home" | "rooms" | "voice-room" | "video-room" | "pk-battle" | "profile"
  | "wallet" | "messages" | "ranking" | "gifts" | "notifications" | "settings"
  | "my-rooms" | "recharge" | "recharge-history" | "withdraw" | "gallery" | "visitors" | "games" | "privacy"
  | "login" | "register" | "splash";

export type ComponentType =
  | "container" | "text" | "heading" | "paragraph" | "image" | "button" | "icon-button" | "icon" | "card" | "banner"
  | "carousel" | "grid" | "row" | "column" | "stack" | "divider" | "badge" | "chip" | "tabs" | "avatar" | "input" | "search-box" | "select" | "checkbox" | "toggle" | "slider" | "progress" | "counter"
  | "user-profile-card" | "live-room-card" | "voice-room-card" | "video-room-card" | "pk-battle-card" | "gift-card" | "gift-grid" | "coin-balance" | "diamond-balance"
  | "recharge-packages" | "ranking-list" | "leaderboard" | "vip-badge" | "level-progress" | "friend-list" | "chat-list" | "notification-list"
  | "follow-button" | "live-button" | "create-room-button" | "pk-battle-button" | "room-seat-layout" | "video-container" | "audio-container"
  | "header" | "footer" | "bottom-navigation" | "navigation" | "list" | "list-item" | "popup" | "modal" | "dialog" | "bottom-sheet" | "drawer" | "toast" | "tooltip" | "dropdown" | "menu" | "overlay" | "custom";

export interface BoxSpacing { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number; linked?: boolean; }
export interface Shadow { x: number; y: number; blur: number; spread?: number; color: string; opacity?: number; }
export interface GradientStop { color: string; position: number; }
export interface Gradient { type: "linear" | "radial"; angle?: number; stops: GradientStop[]; }

export interface ComponentStyle {
  width?: string | number; height?: string | number; minWidth?: string | number; maxWidth?: string | number; minHeight?: string | number; maxHeight?: string | number;
  x?: string | number; y?: string | number; top?: string | number; right?: string | number; bottom?: string | number; left?: string | number;
  position?: PositionMode; zIndex?: number; padding?: string; margin?: string; spacing?: BoxSpacing; gap?: string | number; rowGap?: string | number; columnGap?: string | number;
  display?: string; flexDirection?: "row" | "column"; alignItems?: string; justifyContent?: string; gridTemplateColumns?: string; overflow?: string;
  background?: string; backgroundImage?: string; gradient?: Gradient; color?: string; opacity?: number; filter?: string; backdropFilter?: string;
  border?: string; borderWidth?: string | number; borderColor?: string; borderStyle?: string; borderRadius?: string | number; borderTopLeftRadius?: string | number; borderTopRightRadius?: string | number; borderBottomRightRadius?: string | number; borderBottomLeftRadius?: string | number;
  boxShadow?: string; shadows?: Shadow[]; transform?: string;
  fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; fontStyle?: string; lineHeight?: string | number; letterSpacing?: string | number; textAlign?: string; textTransform?: string; textDecoration?: string; textShadow?: string;
  objectFit?: string; objectPosition?: string;
}

export interface ResponsiveRule { width?: string | number; height?: string | number; style?: ComponentStyle; visible?: boolean; }
export interface ComponentInteraction { type: string; value?: string; popupId?: string; target?: string; }
export interface StudioRuntimeOverride { id: string; selector: string; style: ComponentStyle; visible?: boolean; content?: Record<string, unknown>; }
export interface ContentOverride { id: string; key: string; value: string; locale?: string; }
export interface DesignTokens {
  colors: Record<string, string>; typography: Record<string, Record<string, string | number>>; spacing: Record<string, string | number>;
  radius: Record<string, string | number>; shadows: Record<string, string>; fonts: string[];
}

export interface AppComponentNode {
  id: string; type: ComponentType; name?: string; parentId?: string | null; visible?: boolean; locked?: boolean; groupId?: string | null;
  props?: Record<string, unknown>; style?: ComponentStyle; responsive?: Partial<Record<DeviceKind, ResponsiveRule>>;
  interaction?: ComponentInteraction; action?: { type: string; value?: string }; children?: AppComponentNode[]; binding?: { source: string; path?: string };
}

export interface AppPageConfig {
  schemaVersion: 2; page: AppPageKey; theme: string; sections: AppComponentNode[];
  navigation?: Record<string, unknown>; responsive?: Partial<Record<DeviceKind, Record<string, unknown>>>;
  runtimeOverrides?: StudioRuntimeOverride[]; contentOverrides?: ContentOverride[]; tokens?: DesignTokens;
  validation?: { warnings: string[]; errors: string[]; validatedAt?: string };
}

export const DEFAULT_TOKENS: DesignTokens = {
  colors: { primary: "#8B5CF6", secondary: "#6366F1", accent: "#EC4899", background: "#0B0B12", surface: "#151521", card: "#1B1B29", textPrimary: "#FFFFFF", textSecondary: "#B8B8C7", muted: "#777789", border: "#2B2B3A", success: "#22C55E", warning: "#F59E0B", error: "#EF4444", info: "#3B82F6" },
  typography: { h1: { fontSize: 32, fontWeight: 700 }, h2: { fontSize: 26, fontWeight: 700 }, h3: { fontSize: 22, fontWeight: 600 }, body: { fontSize: 16, fontWeight: 400 }, caption: { fontSize: 12, fontWeight: 400 }, button: { fontSize: 14, fontWeight: 600 }, label: { fontSize: 13, fontWeight: 500 } },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { none: 0, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, pill: "999px" },
  shadows: { none: "none", sm: "0 2px 8px rgba(0,0,0,.12)", md: "0 8px 24px rgba(0,0,0,.18)", lg: "0 16px 48px rgba(0,0,0,.24)" }, fonts: ["Inter", "Poppins", "system-ui"]
};

export const DEFAULT_APP_CONFIG: AppPageConfig = { schemaVersion: 2, page: "home", theme: "default", sections: [], navigation: {}, responsive: { mobile: {}, tablet: {}, desktop: {} }, runtimeOverrides: [], contentOverrides: [], tokens: DEFAULT_TOKENS };

const SAFE_TYPES: ComponentType[] = [
  "container","text","heading","paragraph","image","button","icon-button","icon","card","banner","carousel","grid","row","column","stack","divider","badge","chip","tabs","avatar","input","search-box","select","checkbox","toggle","slider","progress","counter","user-profile-card","live-room-card","voice-room-card","video-room-card","pk-battle-card","gift-card","gift-grid","coin-balance","diamond-balance","recharge-packages","ranking-list","leaderboard","vip-badge","level-progress","friend-list","chat-list","notification-list","follow-button","live-button","create-room-button","pk-battle-button","room-seat-layout","video-container","audio-container","header","footer","bottom-navigation","navigation","list","list-item","popup","modal","dialog","bottom-sheet","drawer","toast","tooltip","dropdown","menu","overlay","custom"
];

export function isSafeComponentType(value: unknown): value is ComponentType { return typeof value === "string" && SAFE_TYPES.includes(value as ComponentType); }

export function normalizePageConfig(raw: unknown, page: AppPageKey): AppPageConfig {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const sections = Array.isArray(source.sections) ? source.sections.filter((node) => node && typeof node === "object" && isSafeComponentType((node as Record<string, unknown>).type)) as AppComponentNode[] : [];
  const runtimeOverrides = Array.isArray(source.runtimeOverrides) ? source.runtimeOverrides.filter((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).selector === "string").map((item) => { const value = item as Record<string, unknown>; return { id: typeof value.id === "string" ? value.id : crypto.randomUUID(), selector: String(value.selector), style: value.style && typeof value.style === "object" ? value.style as ComponentStyle : {}, visible: value.visible !== false, content: value.content && typeof value.content === "object" ? value.content as Record<string, unknown> : undefined }; }) : [];
  const tokens = source.tokens && typeof source.tokens === "object" ? source.tokens as DesignTokens : DEFAULT_TOKENS;
  return { schemaVersion: 2, page, theme: typeof source.theme === "string" ? source.theme : "default", sections, navigation: source.navigation && typeof source.navigation === "object" ? source.navigation as Record<string, unknown> : {}, responsive: source.responsive && typeof source.responsive === "object" ? source.responsive as AppPageConfig["responsive"] : { mobile: {}, tablet: {}, desktop: {} }, runtimeOverrides, contentOverrides: Array.isArray(source.contentOverrides) ? source.contentOverrides as ContentOverride[] : [], tokens };
}

export function validatePageConfig(config: AppPageConfig): { warnings: string[]; errors: string[] } {
  const warnings: string[] = []; const errors: string[] = []; const ids = new Set<string>();
  const walk = (nodes: AppComponentNode[]) => nodes.forEach((node) => { if (ids.has(node.id)) errors.push(`Duplicate component id: ${node.id}`); ids.add(node.id); if (!node.type || !isSafeComponentType(node.type)) errors.push(`Unsupported component: ${node.id}`); if (node.children) walk(node.children); });
  walk(config.sections);
  if (config.sections.length === 0) warnings.push("No Studio-owned components are configured; the original page will be used.");
  for (const node of config.sections) { const w = node.style?.width; if (typeof w === "number" && w < 0) errors.push(`Invalid width: ${node.id}`); if (typeof node.style?.height === "number" && node.style.height < 0) errors.push(`Invalid height: ${node.id}`); if (node.type === "image" && !node.props?.src && !node.binding) warnings.push(`Image ${node.id} has no source.`); }
  return { warnings, errors };
}
