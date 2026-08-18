import type { AppComponentNode, AppPageConfig, ComponentStyle, DeviceKind } from "./schema";

export interface RenderTarget {
  selector: string;
  node: HTMLElement;
}

const CSS_PROPS: Record<string, string> = {
  width: "width", height: "height", minWidth: "min-width", maxWidth: "max-width", minHeight: "min-height", maxHeight: "max-height",
  top: "top", right: "right", bottom: "bottom", left: "left", position: "position", zIndex: "z-index", display: "display",
  flexDirection: "flex-direction", alignItems: "align-items", justifyContent: "justify-content", gridTemplateColumns: "grid-template-columns",
  overflow: "overflow", background: "background", backgroundImage: "background-image", color: "color", opacity: "opacity", filter: "filter",
  backdropFilter: "backdrop-filter", border: "border", borderWidth: "border-width", borderColor: "border-color", borderStyle: "border-style",
  borderRadius: "border-radius", borderTopLeftRadius: "border-top-left-radius", borderTopRightRadius: "border-top-right-radius",
  borderBottomRightRadius: "border-bottom-right-radius", borderBottomLeftRadius: "border-bottom-left-radius", boxShadow: "box-shadow",
  transform: "transform", translate: "translate", fontFamily: "font-family", fontSize: "font-size", fontWeight: "font-weight",
  fontStyle: "font-style", lineHeight: "line-height", letterSpacing: "letter-spacing", textAlign: "text-align", textTransform: "text-transform",
  textDecoration: "text-decoration", textShadow: "text-shadow", objectFit: "object-fit", objectPosition: "object-position", gap: "gap",
  rowGap: "row-gap", columnGap: "column-gap", padding: "padding", margin: "margin",
};

function cssValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return `${value}px`;
  return String(value);
}

function applyStyle(node: HTMLElement, style: ComponentStyle) {
  for (const [key, value] of Object.entries(style)) {
    const property = CSS_PROPS[key];
    if (!property) continue;
    const normalized = cssValue(value);
    if (normalized === null) node.style.removeProperty(property);
    else node.style.setProperty(property, normalized, "important");
  }
}

function breakpoint(device: DeviceKind): string | null {
  if (device === "mobile") return null;
  if (device === "tablet") return "(min-width: 768px) and (max-width: 1023px)";
  return "(min-width: 1024px)";
}

export function createProductionRenderer(config: AppPageConfig) {
  const cleanup: (() => void)[] = [];

  const render = (root: ParentNode = document) => {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-jalwa-component-id]"));
    for (const node of nodes) {
      const id = node.dataset.jalwaComponentId;
      if (!id) continue;
      const component = findComponent(config.sections, id);
      if (!component) continue;
      if (component.visible === false) node.style.setProperty("display", "none", "important");
      if (component.style) applyStyle(node, resolveTokenStyles(component.style, config));
      if (component.action?.type) node.dataset.jalwaStudioAction = component.action.type;
      if (component.action?.value) node.dataset.jalwaStudioActionValue = component.action.value;
      applyResponsive(node, component, config);
      applyContent(node, component);
    }
    for (const override of config.runtimeOverrides ?? []) applySelectorOverride(override.selector, override.style, override.visible !== false);
    applyTokenVariables(config);
  };

  render();
  const observer = new MutationObserver(() => render());
  observer.observe(document.body, { childList: true, subtree: true });
  cleanup.push(() => observer.disconnect());

  return () => cleanup.splice(0).forEach(fn => fn());
}

function findComponent(nodes: AppComponentNode[], id: string): AppComponentNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findComponent(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function resolveTokenStyles(style: ComponentStyle, config: AppPageConfig): ComponentStyle {
  const colors = config.tokens?.colors ?? {};
  const out = { ...style };
  for (const key of ["background", "color", "borderColor"] as const) {
    const value = out[key];
    if (typeof value === "string" && value.startsWith("token:")) {
      const token = value.slice(6);
      out[key] = colors[token] ?? value;
    }
  }
  return out;
}

function applyResponsive(node: HTMLElement, component: AppComponentNode, config: AppPageConfig) {
  const responsive = component.responsive;
  if (!responsive) return;
  const styleTag = document.getElementById("jalwa-studio-responsive");
  const tag = styleTag ?? Object.assign(document.createElement("style"), { id: "jalwa-studio-responsive" });
  if (!styleTag) document.head.appendChild(tag);
  const base = `[data-jalwa-component-id="${CSS.escape(component.id)}"]`;
  const chunks: string[] = [];
  for (const device of ["tablet", "desktop"] as DeviceKind[]) {
    const rule = responsive[device];
    const media = breakpoint(device);
    if (!rule || !media) continue;
    const declarations = Object.entries(rule.style ?? {}).map(([key, value]) => {
      const property = CSS_PROPS[key];
      const normalized = cssValue(value);
      return property && normalized !== null ? `${property}:${normalized} !important;` : "";
    }).filter(Boolean).join("");
    if (rule.visible === false) chunks.push(`@media ${media}{${base}{display:none!important;}}`);
    if (declarations) chunks.push(`@media ${media}{${base}{${declarations}}}`);
  }
  tag.textContent = chunks.join("\n");
}

function applyContent(node: HTMLElement, component: AppComponentNode) {
  const props = component.props ?? {};
  if (typeof props.text === "string" && node.dataset.jalwaStudioText !== "preserve") node.textContent = props.text;
  if (typeof props.src === "string" && node instanceof HTMLImageElement) node.src = props.src;
  if (typeof props.alt === "string" && node instanceof HTMLImageElement) node.alt = props.alt;
}

function applySelectorOverride(selector: string, style: ComponentStyle, visible: boolean) {
  let nodes: NodeListOf<Element>;
  try { nodes = document.querySelectorAll(selector); } catch { return; }
  nodes.forEach(element => {
    if (!(element instanceof HTMLElement)) return;
    if (!visible) element.style.setProperty("display", "none", "important");
    applyStyle(element, style);
  });
}

function applyTokenVariables(config: AppPageConfig) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(config.tokens?.colors ?? {})) root.style.setProperty(`--jalwa-${key}`, value);
  for (const [key, value] of Object.entries(config.tokens?.spacing ?? {})) root.style.setProperty(`--jalwa-spacing-${key}`, cssValue(value) ?? String(value));
  for (const [key, value] of Object.entries(config.tokens?.radius ?? {})) root.style.setProperty(`--jalwa-radius-${key}`, cssValue(value) ?? String(value));
}
