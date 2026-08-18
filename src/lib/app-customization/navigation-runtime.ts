import { supabase } from "@/integrations/supabase/client";
import type { NavigationItemConfig } from "./navigation-manager";

export const DEFAULT_NAVIGATION: NavigationItemConfig[] = [
  { id: "home", label: "Home", icon: "Home", route: "/", order: 0, visible: true },
  { id: "rank", label: "Rank", icon: "Trophy", route: "/rank", order: 1, visible: true },
  { id: "create-room", label: "", icon: "Plus", route: "/create-room", order: 2, visible: true, action: { type: "primary" } },
  { id: "messages", label: "Chat", icon: "MessageCircle", route: "/messages", order: 3, visible: true },
  { id: "me", label: "Me", icon: "User", route: "/me", order: 4, visible: true },
];

function asItem(value: unknown, index: number): NavigationItemConfig | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const route = typeof item.route === "string" ? item.route : undefined;
  const action = item.action && typeof item.action === "object" ? item.action as { type?: unknown; value?: unknown } : undefined;
  return {
    id: typeof item.id === "string" ? item.id : `nav-${index}`,
    label: typeof item.label === "string" ? item.label : "",
    icon: typeof item.icon === "string" ? item.icon : undefined,
    activeIcon: typeof item.activeIcon === "string" ? item.activeIcon : undefined,
    route,
    order: typeof item.order === "number" ? item.order : index,
    visible: item.visible !== false,
    color: typeof item.color === "string" ? item.color : undefined,
    activeColor: typeof item.activeColor === "string" ? item.activeColor : undefined,
    iconSize: typeof item.iconSize === "number" ? item.iconSize : undefined,
    labelSize: typeof item.labelSize === "number" ? item.labelSize : undefined,
    action: action && typeof action.type === "string" ? { type: action.type, value: typeof action.value === "string" ? action.value : undefined } : undefined,
  };
}

export function extractNavigation(raw: unknown): NavigationItemConfig[] {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const candidate = Array.isArray(source.items) ? source.items : Array.isArray(source.bottom) ? source.bottom : Array.isArray(source.bottomNavigation) ? source.bottomNavigation : [];
  const parsed = candidate.map(asItem).filter((item): item is NavigationItemConfig => !!item && item.visible !== false && !!item.route);
  return parsed.length ? parsed.sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index })) : DEFAULT_NAVIGATION;
}

export async function loadPublishedNavigation(): Promise<NavigationItemConfig[]> {
  const { data: page, error: pageError } = await supabase
    .from("app_customization_pages")
    .select("id")
    .eq("page_key", "home")
    .eq("is_enabled", true)
    .maybeSingle();
  if (pageError || !page?.id) return DEFAULT_NAVIGATION;

  const { data, error } = await supabase
    .from("app_customization_published")
    .select("config")
    .eq("page_id", page.id)
    .eq("is_current", true)
    .maybeSingle();
  if (error) return DEFAULT_NAVIGATION;

  const config = data?.config && typeof data.config === "object" ? data.config as Record<string, unknown> : {};
  return extractNavigation(config.navigation);
}
