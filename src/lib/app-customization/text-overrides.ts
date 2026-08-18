export type TextOverride = {
  key: string;
  value: string;
  locale?: string;
  enabled?: boolean;
};

const normalizeKey = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export function createTextOverrideMap(overrides: TextOverride[] = [], locale = "default") {
  const map = new Map<string, string>();
  for (const override of overrides) {
    if (override.enabled === false) continue;
    if (override.locale && override.locale !== locale && override.locale !== "default") continue;
    map.set(normalizeKey(override.key), override.value);
  }
  return map;
}

export function resolveTextOverride(
  text: string,
  overrides: Map<string, string>,
) {
  return overrides.get(normalizeKey(text)) ?? text;
}

export function applyTextOverrides(
  root: ParentNode,
  overrides: Map<string, string>,
) {
  if (!overrides.size) return 0;
  let changed = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  for (const textNode of nodes) {
    const original = textNode.nodeValue ?? "";
    const trimmed = original.trim();
    if (!trimmed) continue;
    const replacement = resolveTextOverride(trimmed, overrides);
    if (replacement === trimmed) continue;
    const start = original.indexOf(trimmed);
    textNode.nodeValue = `${original.slice(0, start)}${replacement}${original.slice(start + trimmed.length)}`;
    changed++;
  }
  return changed;
}

export function applyElementTextOverride(
  element: HTMLElement,
  key: string,
  overrides: Map<string, string>,
) {
  const replacement = overrides.get(normalizeKey(key));
  if (replacement === undefined) return false;
  element.textContent = replacement;
  return true;
}
