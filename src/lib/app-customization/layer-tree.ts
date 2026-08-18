import type { DetectedComponent, DetectedScreen } from "./auto-detection";

export interface StudioLayer extends DetectedComponent {
  children: StudioLayer[];
  depth: number;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
}

function toLayer(component: DetectedComponent, children: StudioLayer[], depth: number): StudioLayer {
  return { ...component, children, depth, visible: true, locked: false, expanded: true };
}

export function buildLayerTree(screen: DetectedScreen): StudioLayer[] {
  const byParent = new Map<string | undefined, DetectedComponent[]>();
  for (const component of screen.components) {
    const list = byParent.get(component.parentId) || [];
    list.push(component);
    byParent.set(component.parentId, list);
  }
  const build = (parentId: string | undefined, depth: number): StudioLayer[] =>
    (byParent.get(parentId) || []).map(component => toLayer(component, build(component.id, depth + 1), depth));
  return build(undefined, 0);
}

export function flattenLayers(layers: StudioLayer[]): StudioLayer[] {
  return layers.flatMap(layer => [layer, ...flattenLayers(layer.children)]);
}

export function findLayer(layers: StudioLayer[], id: string): StudioLayer | undefined {
  return flattenLayers(layers).find(layer => layer.id === id);
}

export function setLayerState(layers: StudioLayer[], id: string, patch: Partial<Pick<StudioLayer, "visible" | "locked" | "expanded" | "name">>): StudioLayer[] {
  return layers.map(layer => layer.id === id
    ? { ...layer, ...patch }
    : { ...layer, children: setLayerState(layer.children, id, patch) });
}

export function reorderLayer(layers: StudioLayer[], id: string, direction: "up" | "down"): StudioLayer[] {
  const next = layers.map(layer => ({ ...layer, children: reorderLayer(layer.children, id, direction) }));
  const index = next.findIndex(layer => layer.id === id);
  if (index < 0) return next;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function renameLayer(layers: StudioLayer[], id: string, name: string) {
  return setLayerState(layers, id, { name: name.trim() || "Layer" });
}
