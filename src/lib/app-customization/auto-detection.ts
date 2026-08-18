export interface DetectedAction { kind: "navigation" | "click" | "submit" | "custom"; target?: string; name?: string; }
export interface DetectedComponent { id: string; type: string; name: string; route: string; parentId?: string; source?: string; action?: DetectedAction; dataBinding?: string; editable?: boolean; }
export interface DetectedScreen { id: string; route: string; name: string; source?: string; components: DetectedComponent[]; }

const normalize = (value: string) => value.trim().replace(/\\/g, "/").replace(/\.tsx?$/, "");
const title = (value: string) => value.split(/[\\/_-]/).filter(Boolean).pop()?.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, c => c.toUpperCase()) || value;

export function createScreenId(route: string) { return `screen:${normalize(route)}`; }
export function createComponentId(route: string, source: string, index = 0) { return `component:${normalize(route)}:${normalize(source)}:${index}`; }

/** Converts a project route/component manifest into the Studio's editable map. No mock UI is created. */
export function buildDetectedScreen(route: string, source: string, components: Array<Omit<DetectedComponent, "id" | "route">>): DetectedScreen {
  const normalizedRoute = route || "/";
  return {
    id: createScreenId(normalizedRoute),
    route: normalizedRoute,
    name: title(normalizedRoute === "/" ? "Home" : normalizedRoute),
    source,
    components: components.map((component, index) => ({ ...component, id: createComponentId(normalizedRoute, component.source || component.name, index), route: normalizedRoute })),
  };
}

export function mergeDetectedScreens(existing: DetectedScreen[], discovered: DetectedScreen[]) {
  const byId = new Map(existing.map(screen => [screen.id, screen]));
  for (const screen of discovered) {
    const previous = byId.get(screen.id);
    byId.set(screen.id, previous ? { ...screen, ...previous, components: screen.components.map(component => previous.components.find(item => item.id === component.id) || component) } : screen);
  }
  return [...byId.values()];
}

export function findDetectedComponents(screens: DetectedScreen[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return screens.flatMap(screen => screen.components);
  return screens.flatMap(screen => screen.components.filter(component => `${component.name} ${component.type} ${component.route} ${component.dataBinding || ""}`.toLowerCase().includes(q)));
}
