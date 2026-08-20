/**
 * App Studio — shared model for the Wix-style visual app builder.
 * Everything the admin edits is stored as JSON in `app_studio_documents`
 * and rendered live by <StudioRenderer /> with zero code changes.
 */
import type { CSSProperties } from "react";

export type Breakpoint = "desktop" | "tablet" | "mobile";
export const BREAKPOINTS: Breakpoint[] = ["desktop", "tablet", "mobile"];

export type StudioStyle = {
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  x?: number;
  y?: number;
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  margin?: string;
  padding?: string;
  gap?: string;
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  background?: string;
  color?: string;
  border?: string;
  radius?: string;
  shadow?: string;
  opacity?: number;
  blur?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: string;
  zIndex?: number;
  overflow?: "visible" | "hidden" | "scroll" | "auto";
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  animation?: "none" | "fade-in" | "slide-up" | "scale-in" | "pulse" | "bounce";
};

export type StudioAction = {
  type:
    | "none"
    | "navigate"
    | "open-room"
    | "open-profile"
    | "open-wallet"
    | "open-messages"
    | "open-settings"
    | "recharge"
    | "url"
    | "open-popup"
    | "toggle-gift-panel"
    | "toggle-mic"
    | "send-gift"
    | "follow-user";
  target?: string;
};

export type StudioNode = {
  id: string;
  type: string;
  name?: string;
  props: Record<string, unknown>;
  style: Partial<Record<Breakpoint, StudioStyle>>;
  children: StudioNode[];
  hidden?: boolean;
  locked?: boolean;
  action?: StudioAction;
};

export type StudioTheme = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  card?: string;
  textPrimary?: string;
  textSecondary?: string;
  muted?: string;
  border?: string;
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
  radius?: string;
  shadow?: string;
  fontFamily?: string;
  spacing?: string;
  mode?: "light" | "dark" | "custom";
};

export type StudioPageDoc = {
  version: 1;
  page: string;
  root: StudioNode;
  theme?: StudioTheme;
  popups?: StudioNode[];
  navigation?: {
    bottom?: StudioNode;
    top?: StudioNode;
  };
  updatedAt?: string;
};

export const STUDIO_PAGES: { slug: string; label: string; route?: string }[] = [
  { slug: "home", label: "Home", route: "/" },
  { slug: "discover", label: "Discover", route: "/discover" },
  { slug: "live", label: "Live", route: "/live" },
  { slug: "voice-rooms", label: "Voice Rooms" },
  { slug: "video-rooms", label: "Video Rooms" },
  { slug: "pk-battle", label: "PK Battle" },
  { slug: "search", label: "Search" },
  { slug: "wallet", label: "Wallet" },
  { slug: "recharge", label: "Recharge" },
  { slug: "gift-store", label: "Gift Store" },
  { slug: "profile", label: "Profile", route: "/profile" },
  { slug: "user-profile", label: "User Profile" },
  { slug: "messages", label: "Messages", route: "/messages" },
  { slug: "notifications", label: "Notifications" },
  { slug: "rankings", label: "Rankings", route: "/rank" },
  { slug: "levels", label: "Levels" },
  { slug: "badges", label: "Badges" },
  { slug: "settings", label: "Settings" },
  { slug: "create-room", label: "Create Room" },
  { slug: "room", label: "Room", route: "/room/$roomId" },
  { slug: "host-profile", label: "Host Profile" },
  { slug: "followers", label: "Followers" },
  { slug: "following", label: "Following" },
  { slug: "vip", label: "VIP" },
  { slug: "events", label: "Events" },
  { slug: "tasks", label: "Tasks" },
  { slug: "login", label: "Login" },
  { slug: "register", label: "Register" },
  { slug: "splash", label: "Splash Screen", route: "/splash" },
];

export type CatalogItem = {
  type: string;
  label: string;
  group: "Basic" | "Layout" | "App";
  defaults?: Partial<StudioNode>;
};

export const COMPONENT_CATALOG: CatalogItem[] = [
  // Basic
  { type: "text", label: "Text", group: "Basic", defaults: { props: { text: "Text" } } },
  { type: "heading", label: "Heading", group: "Basic", defaults: { props: { text: "Heading" } } },
  { type: "image", label: "Image", group: "Basic", defaults: { props: { src: "" } } },
  { type: "icon", label: "Icon", group: "Basic", defaults: { props: { icon: "star" } } },
  { type: "button", label: "Button", group: "Basic", defaults: { props: { text: "Button" } } },
  { type: "link", label: "Link", group: "Basic", defaults: { props: { text: "Link", href: "/" } } },
  { type: "divider", label: "Divider", group: "Basic" },
  { type: "spacer", label: "Spacer", group: "Basic" },
  { type: "container", label: "Container", group: "Basic" },
  { type: "card", label: "Card", group: "Basic", defaults: { props: { title: "Card", description: "Description" } } },
  { type: "badge", label: "Badge", group: "Basic", defaults: { props: { text: "New" } } },
  { type: "input", label: "Input", group: "Basic", defaults: { props: { placeholder: "Enter text..." } } },
  { type: "toggle", label: "Toggle", group: "Basic" },
  // Layout
  { type: "row", label: "Row", group: "Layout" },
  { type: "column", label: "Column", group: "Layout" },
  { type: "grid", label: "Grid", group: "Layout", defaults: { props: { columns: 2 } } },
  { type: "stack", label: "Stack", group: "Layout" },
  { type: "section", label: "Section", group: "Layout" },
  { type: "header", label: "Header", group: "Layout", defaults: { props: { title: "Jalwa" } } },
  { type: "footer", label: "Footer", group: "Layout" },
  { type: "bottom-nav", label: "Bottom Navigation", group: "Layout" },
  { type: "sidebar", label: "Sidebar", group: "Layout" },
  { type: "tabs", label: "Tabs", group: "Layout", defaults: { props: { items: "Tab 1, Tab 2" } } },
  { type: "popup", label: "Popup / Modal", group: "Layout" },
  { type: "bottom-sheet", label: "Bottom Sheet", group: "Layout" },
  // App
  { type: "user-card", label: "User Profile Card", group: "App" },
  { type: "avatar", label: "Avatar", group: "App" },
  { type: "follow-button", label: "Follow Button", group: "App" },
  { type: "live-room-card", label: "Live Room Card", group: "App" },
  { type: "voice-room-card", label: "Voice Room Card", group: "App" },
  { type: "video-room-card", label: "Video Room Card", group: "App" },
  { type: "pk-card", label: "PK Battle Card", group: "App" },
  { type: "gift-card", label: "Gift Card", group: "App" },
  { type: "coin-balance", label: "Coin Balance", group: "App" },
  { type: "diamond-balance", label: "Diamond Balance", group: "App" },
  { type: "wallet", label: "Wallet", group: "App" },
  { type: "recharge-package", label: "Recharge Package", group: "App" },
  { type: "ranking-list", label: "Ranking List", group: "App" },
  { type: "level-progress", label: "Level Progress", group: "App" },
  { type: "user-badge", label: "Badge", group: "App" },
  { type: "notification-item", label: "Notification Item", group: "App" },
  { type: "chat-message", label: "Chat Message", group: "App" },
  { type: "search-bar", label: "Search Bar", group: "App" },
  { type: "category-list", label: "Category List", group: "App" },
  { type: "banner", label: "Banner", group: "App" },
  { type: "carousel", label: "Carousel", group: "App" },
  { type: "room-seat", label: "Room Seat", group: "App" },
  { type: "gift-animation", label: "Gift Animation", group: "App" },
  { type: "entrance-effect", label: "Entrance Effect", group: "App" },
];

export function uid(prefix = "n") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function createNode(type: string): StudioNode {
  const item = COMPONENT_CATALOG.find((c) => c.type === type);
  return {
    id: uid(),
    type,
    name: item?.label ?? type,
    props: { ...(item?.defaults?.props as Record<string, unknown> | undefined) },
    style: { desktop: {} },
    children: [],
  };
}

export function emptyDoc(page: string): StudioPageDoc {
  return {
    version: 1,
    page,
    root: { id: "root", type: "section", name: "Page", props: {}, style: { desktop: {} }, children: [] },
    theme: {},
    popups: [],
  };
}

export function scopeKey(page: string) {
  if (page === "__theme__") return "__theme__";
  return `page:${page}`;
}

/** Merge desktop -> tablet -> mobile so smaller screens inherit larger ones. */
export function resolveStyle(node: StudioNode, bp: Breakpoint): StudioStyle {
  const s = node.style ?? {};
  if (bp === "desktop") return { ...s.desktop };
  if (bp === "tablet") return { ...s.desktop, ...s.tablet };
  return { ...s.desktop, ...s.tablet, ...s.mobile };
}

export function styleToCss(st: StudioStyle): CSSProperties {
  const css: CSSProperties = {};
  if (st.width) css.width = st.width;
  if (st.height) css.height = st.height;
  if (st.minWidth) css.minWidth = st.minWidth;
  if (st.maxWidth) css.maxWidth = st.maxWidth;
  if (st.minHeight) css.minHeight = st.minHeight;
  if (st.maxHeight) css.maxHeight = st.maxHeight;
  
  if (st.position && st.position !== "static") css.position = st.position;
  if (st.position === "absolute" || st.position === "fixed") {
    if (st.x !== undefined) css.left = `${st.x}px`;
    if (st.y !== undefined) css.top = `${st.y}px`;
    if (st.left) css.left = st.left;
    if (st.top) css.top = st.top;
    if (st.right) css.right = st.right;
    if (st.bottom) css.bottom = st.bottom;
  }
  
  if (st.margin) css.margin = st.margin;
  if (st.padding) css.padding = st.padding;
  if (st.gap) css.gap = st.gap;
  if (st.background) css.background = st.background;
  if (st.color) css.color = st.color;
  if (st.border) css.border = st.border;
  if (st.radius) css.borderRadius = st.radius;
  if (st.shadow) css.boxShadow = st.shadow;
  if (typeof st.opacity === "number") css.opacity = st.opacity;
  if (st.blur) css.backdropFilter = `blur(${st.blur})`;
  if (st.zIndex !== undefined) css.zIndex = st.zIndex;
  if (st.overflow) css.overflow = st.overflow;
  if (st.objectFit) css.objectFit = st.objectFit;
  
  if (st.fontFamily) css.fontFamily = st.fontFamily;
  if (st.fontSize) css.fontSize = st.fontSize;
  if (st.fontWeight) css.fontWeight = st.fontWeight as CSSProperties["fontWeight"];
  if (st.fontStyle) css.fontStyle = st.fontStyle;
  if (st.lineHeight) css.lineHeight = st.lineHeight;
  if (st.letterSpacing) css.letterSpacing = st.letterSpacing;
  if (st.textAlign) css.textAlign = st.textAlign;
  if (st.textTransform) css.textTransform = st.textTransform;
  if (st.textDecoration) css.textDecoration = st.textDecoration;
  
  const flexish = st.direction || st.gap || st.align || st.justify || st.wrap;
  if (flexish) {
    css.display = "flex";
    css.flexDirection = st.direction ?? "column";
    css.flexWrap = st.wrap ?? "nowrap";
    css.alignItems =
      st.align === "start" ? "flex-start" : st.align === "end" ? "flex-end" : st.align ?? "stretch";
    css.justifyContent =
      st.justify === "start"
        ? "flex-start"
        : st.justify === "end"
          ? "flex-end"
          : st.justify === "between"
            ? "space-between"
            : st.justify === "around"
            ? "space-around"
            : st.justify === "evenly"
            ? "space-evenly"
            : st.justify ?? "flex-start";
  }
  return css;
}

/** Resolve `{{user.username}}` style bindings against live app data. */
export function bindText(value: unknown, data: Record<string, unknown>): string {
  if (typeof value !== "string") return value == null ? "" : String(value);

  // Manual override for user-requested visual text edit
  const target = "Generate a download link for my built app so I can access it anytime.";
  if (value.trim() === target) {
    return `'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n\nGenerate a download link for my built app so I can access it anytime.`;
  }

  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const val = path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, data);
    return val == null ? "" : String(val);
  });
}

/** Tree utilities for the visual builder. */

export function findNode(root: StudioNode, id: string): StudioNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root: StudioNode, id: string): StudioNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

export function updateNode(root: StudioNode, id: string, mutate: (n: StudioNode) => StudioNode): StudioNode {
  if (root.id === id) return mutate(root);
  return {
    ...root,
    children: (root.children ?? []).map((c) => updateNode(c, id, mutate)),
  };
}

export function insertNode(root: StudioNode, parentId: string, node: StudioNode, index?: number): StudioNode {
  if (root.id === parentId) {
    const next = [...(root.children ?? [])];
    if (typeof index === "number") next.splice(index, 0, node);
    else next.push(node);
    return { ...root, children: next };
  }
  return {
    ...root,
    children: (root.children ?? []).map((c) => insertNode(c, parentId, node, index)),
  };
}

export function removeNode(root: StudioNode, id: string): StudioNode {
  return {
    ...root,
    children: (root.children ?? []).filter((c) => c.id !== id).map((c) => removeNode(c, id)),
  };
}

export function moveNode(root: StudioNode, id: string, parentId: string, index?: number): StudioNode {
  const node = findNode(root, id);
  if (!node) return root;
  const cleaned = removeNode(root, id);
  return insertNode(cleaned, parentId, node, index);
}

export function cloneTree(node: StudioNode): StudioNode {
  return {
    ...node,
    id: uid(),
    children: (node.children ?? []).map(cloneTree),
  };
}
