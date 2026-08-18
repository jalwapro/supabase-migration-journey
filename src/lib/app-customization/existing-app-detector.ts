import { buildDetectedScreen, type DetectedComponent, type DetectedScreen } from "./auto-detection";

const routeFiles = import.meta.glob("/src/routes/**/*.{tsx,ts}", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

const EXCLUDED = new Set(["route.tsx", "__root.tsx"]);
const toRoute = (file: string) => {
  const relative = file.replace(/^\/src\/routes\//, "").replace(/\.(tsx|ts)$/, "");
  if (relative.startsWith("api/")) return null;
  const parts = relative.split("/").filter(Boolean);
  const leaf = parts.pop() || "";
  if (EXCLUDED.has(`${leaf}.tsx`) || EXCLUDED.has(`${leaf}.ts`)) return null;
  const path = [...parts, leaf].join("/");
  if (path === "index") return "/";
  if (path.endsWith("/index")) return `/${path.slice(0, -6)}`;
  return `/${path.replace(/\[([^\]]+)\]/g, ":$1")}`;
};

const labelize = (value: string) => value.replace(/^[-_]+|[-_]+$/g, "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase()) || "Screen";
const importedNames = (source: string) => {
  const names = new Set<string>();
  for (const match of source.matchAll(/import\\s+([^;]+?)\\s+from\\s+[\"']@\\/components\\/[^\"']+[\"']/g)) {
    const clause = match[1].trim();
    const named = clause.match(/\\{([^}]+)\\}/)?.[1];
    if (named) named.split(",").forEach((x) => names.add(x.trim().split(/\\s+as\\s+/)[0]));
    const def = clause.match(/^([A-Za-z_$][\\w$]*)/);
    if (def) names.add(def[1]);
  }
  return names;
};

const componentType = (name: string) => {
  const n = name.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (n.includes("bottomnav")) return "bottom-navigation";
  if (n.includes("navigation") || n.includes("navbar")) return "navigation";
  if (n.includes("header")) return "header";
  if (n.includes("footer")) return "footer";
  if (n.includes("button")) return "button";
  if (n.includes("avatar")) return "avatar";
  if (n.includes("image") || n === "img") return "image";
  if (n.includes("icon")) return "icon";
  if (n.includes("card")) return "card";
  if (n.includes("modal")) return "modal";
  if (n.includes("dialog")) return "dialog";
  if (n.includes("drawer")) return "drawer";
  if (n.includes("sheet")) return "bottom-sheet";
  if (n.includes("popup")) return "popup";
  if (n.includes("input") || n.includes("field")) return "input";
  if (n.includes("search")) return "search-box";
  if (n.includes("tab")) return "tabs";
  if (n.includes("room")) return "live-room-card";
  if (n.includes("gift")) return "gift-card";
  if (n.includes("ranking") || n.includes("leaderboard")) return "ranking-list";
  if (n.includes("profile")) return "user-profile-card";
  return "custom";
};

function actionsFor(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const around = source.match(new RegExp(`<${escaped}\\b[\\s\\S]{0,1200}?</${escaped}>`))?.[0] || source.match(new RegExp(`<${escaped}\\b[^>]*>`))?.[0] || "";
  const to = around.match(/(?:to|href)=\{?[\"']([^\"']+)[\"']/)?.[1];
  if (to) return { kind: "navigation" as const, target: to, name: `Navigate to ${to}` };
  if (/onClick|onPress|onSubmit/.test(around)) return { kind: "click" as const, name: "Existing handler" };
  return undefined;
}

export function detectExistingApp(): DetectedScreen[] {
  const screens: DetectedScreen[] = [];
  for (const [file, raw] of Object.entries(routeFiles)) {
    const route = toRoute(file);
    if (!route) continue;
    const source = raw || "";
    const imports = importedNames(source);
    const components: Array<Omit<DetectedComponent, "id" | "route">> = [];
    const seen = new Set<string>();
    for (const match of source.matchAll(/<([A-Z][A-Za-z0-9_.]*)\\b/g)) {
      const name = match[1].split(".").pop() || match[1];
      if (!imports.has(name) || seen.has(name)) continue;
      seen.add(name);
      components.push({ name: labelize(name), type: componentType(name), source: file.replace(/^\//, ""), editable: true, action: actionsFor(source, name) });
    }
    for (const tag of ["button", "input", "img", "a"]) {
      const count = [...source.matchAll(new RegExp(`<${tag}\\b`, "g"))].length;
      if (count) components.push({ name: tag === "button" ? "Native Buttons" : labelize(tag), type: tag === "button" ? "button" : tag === "input" ? "input" : tag === "img" ? "image" : "custom", source: file.replace(/^\//, ""), editable: true });
    }
    const unique = components.filter((component, index, list) => list.findIndex((x) => x.name === component.name && x.source === component.source) === index);
    screens.push(buildDetectedScreen(route, file.replace(/^\//, ""), unique));
  }
  return screens.sort((a, b) => a.route.localeCompare(b.route));
}

export function findDetectedScreen(screens: DetectedScreen[], route: string) {
  return screens.find((screen) => screen.route === route) || screens.find((screen) => screen.route.replace(/^\//, "") === route.replace(/^\//, ""));
}
