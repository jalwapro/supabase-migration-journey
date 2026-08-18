import type { DetectedScreen } from "./auto-detection";
import type { StudioLayer } from "./layer-tree";

export interface SerializedLayer {
  id: string;
  type: string;
  name: string;
  parentId?: string;
  route: string;
  source?: string;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  depth: number;
  action?: StudioLayer["action"];
  dataBinding?: string;
  editable?: boolean;
}

export function serializeLayers(layers: StudioLayer[]): SerializedLayer[] {
  return layers.flatMap(layer => [
    {
      id: layer.id,
      type: layer.type,
      name: layer.name,
      parentId: layer.parentId,
      route: layer.route,
      source: layer.source,
      visible: layer.visible,
      locked: layer.locked,
      expanded: layer.expanded,
      depth: layer.depth,
      action: layer.action,
      dataBinding: layer.dataBinding,
      editable: layer.editable,
    },
    ...serializeLayers(layer.children),
  ]);
}

export function serializeScreenLayers(screen: DetectedScreen, layers: StudioLayer[]) {
  return {
    screenId: screen.id,
    route: screen.route,
    source: screen.source,
    layers: serializeLayers(layers),
  };
}
