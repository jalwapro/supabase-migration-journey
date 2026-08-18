export interface NavigationItemConfig { id: string; label: string; icon?: string; activeIcon?: string; route?: string; order: number; visible?: boolean; color?: string; activeColor?: string; iconSize?: number; labelSize?: number; action?: { type: string; value?: string }; }

export function reorderNavigation(items: NavigationItemConfig[], activeId: string, overId: string) {
  const source = items.findIndex(item => item.id === activeId), target = items.findIndex(item => item.id === overId);
  if (source < 0 || target < 0 || source === target) return items;
  const next = [...items]; const [moved] = next.splice(source, 1); next.splice(target, 0, moved);
  return next.map((item, index) => ({ ...item, order: index }));
}

export function normalizeNavigation(items: NavigationItemConfig[]) { return [...items].sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index })); }
