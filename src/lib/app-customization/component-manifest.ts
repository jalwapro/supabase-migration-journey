import type { DetectedAction, DetectedComponent, DetectedScreen } from "./auto-detection";

export interface StudioComponentManifestEntry {
  name: string;
  type: string;
  source?: string;
  parentId?: string;
  editable?: boolean;
  action?: DetectedAction;
  dataBinding?: string;
}

export interface StudioScreenManifestEntry {
  route: string;
  source: string;
  name?: string;
  components: StudioComponentManifestEntry[];
}

export function manifestToScreens(manifest: StudioScreenManifestEntry[]): DetectedScreen[] {
  return manifest.map((screen) => ({
    id: `screen:${screen.route}`,
    route: screen.route,
    name: screen.name || screen.route,
    source: screen.source,
    components: screen.components.map((component, index): DetectedComponent => ({
      ...component,
      id: `component:${screen.route}:${component.source || component.name}:${index}`,
      route: screen.route,
    })),
  }));
}
