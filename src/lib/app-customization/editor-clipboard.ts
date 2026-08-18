import type { AppComponentNode, ComponentStyle } from "./schema";

export interface ClipboardPayload { kind: "component" | "style"; component?: AppComponentNode; style?: ComponentStyle; }

export function cloneComponent(component: AppComponentNode, parentId: string | null = component.parentId ?? null): AppComponentNode {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${component.id}-copy-${Date.now()}`;
  return { ...structuredClone(component), id, parentId, name: component.name ? `${component.name} Copy` : undefined, children: component.children?.map(child => cloneComponent(child, id)) };
}

export function copyStyle(component: AppComponentNode): ClipboardPayload { return { kind: "style", style: structuredClone(component.style ?? {}) }; }
export function pasteStyle(component: AppComponentNode, payload: ClipboardPayload): AppComponentNode { if (payload.kind !== "style" || !payload.style) return component; return { ...component, style: { ...(component.style ?? {}), ...structuredClone(payload.style) } }; }
export function copyComponent(component: AppComponentNode): ClipboardPayload { return { kind: "component", component: structuredClone(component) }; }
export function pasteComponent(payload: ClipboardPayload, parentId: string | null): AppComponentNode | null { return payload.kind === "component" && payload.component ? cloneComponent(payload.component, parentId) : null; }
