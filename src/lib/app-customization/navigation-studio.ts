export type NavigationItem = {
  id: string;
  label: string;
  route: string;
  icon?: string;
  activeIcon?: string;
  visible?: boolean;
  disabled?: boolean;
  order: number;
  badge?: string | number;
  action?: { type: string; value?: string };
};

export type NavigationConfig = {
  id: string;
  type: "bottom" | "top" | "side" | "tabs";
  items: NavigationItem[];
  activeColor?: string;
  inactiveColor?: string;
  background?: string;
  height?: number | string;
  gap?: number | string;
};

export const DEFAULT_NAVIGATION: NavigationConfig = {
  id: "primary-navigation",
  type: "bottom",
  items: [],
};

export function normalizeNavigation(raw: unknown): NavigationConfig[] {
  if (!raw || typeof raw !== "object") return [];
  const source = raw as Record<string, unknown>;
  const value = Array.isArray(source.configs) ? source.configs : Array.isArray(raw) ? raw : [raw];
  return value.filter(Boolean).map((entry, index) => {
    const input = entry as Record<string, unknown>;
    const items = Array.isArray(input.items) ? input.items : [];
    return {
      id: typeof input.id === "string" ? input.id : `navigation-${index + 1}`,
      type: input.type === "top" || input.type === "side" || input.type === "tabs" ? input.type : "bottom",
      items: items.map((item, itemIndex) => {
        const i = item as Record<string, unknown>;
        return {
          id: typeof i.id === "string" ? i.id : `nav-item-${itemIndex + 1}`,
          label: typeof i.label === "string" ? i.label : "",
          route: typeof i.route === "string" ? i.route : "#",
          icon: typeof i.icon === "string" ? i.icon : undefined,
          activeIcon: typeof i.activeIcon === "string" ? i.activeIcon : undefined,
          visible: i.visible !== false,
          disabled: i.disabled === true,
          order: typeof i.order === "number" ? i.order : itemIndex,
          badge: typeof i.badge === "string" || typeof i.badge === "number" ? i.badge : undefined,
          action: i.action && typeof i.action === "object" ? i.action as NavigationItem["action"] : undefined,
        };
      }).sort((a, b) => a.order - b.order),
      activeColor: typeof input.activeColor === "string" ? input.activeColor : undefined,
      inactiveColor: typeof input.inactiveColor === "string" ? input.inactiveColor : undefined,
      background: typeof input.background === "string" ? input.background : undefined,
      height: typeof input.height === "number" || typeof input.height === "string" ? input.height : undefined,
      gap: typeof input.gap === "number" || typeof input.gap === "string" ? input.gap : undefined,
    };
  });
}

export function reorderNavigationItems(config: NavigationConfig, activeId: string, overId: string): NavigationConfig {
  if (activeId === overId) return config;
  const items = [...config.items].sort((a, b) => a.order - b.order);
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0) return config;
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  return { ...config, items: items.map((item, order) => ({ ...item, order })) };
}

export function updateNavigationItem(config: NavigationConfig, id: string, patch: Partial<NavigationItem>): NavigationConfig {
  return { ...config, items: config.items.map((item) => item.id === id ? { ...item, ...patch } : item) };
}

export function addNavigationItem(config: NavigationConfig, item: Omit<NavigationItem, "order">): NavigationConfig {
  const order = config.items.length;
  return { ...config, items: [...config.items, { ...item, order }] };
}

export function removeNavigationItem(config: NavigationConfig, id: string): NavigationConfig {
  return { ...config, items: config.items.filter((item) => item.id !== id).map((item, order) => ({ ...item, order })) };
}

export function navigationToPageValue(configs: NavigationConfig[]) {
  return { configs };
}
