import type { AppPageConfig } from "./schema";
import { upsertTextOverride } from "./text-persistence";

export type FindReplaceScope = "screen" | "selected" | "app";

export function buildFindReplaceChanges(
  config: AppPageConfig,
  find: string,
  replace: string,
  scope: FindReplaceScope = "screen",
  selectedIds: string[] = [],
) {
  const needle = find.trim().toLowerCase();
  if (!needle) return config;

  const allowed = new Set(selectedIds);
  const keys = new Set<string>();
  const walk = (nodes: AppPageConfig["sections"]) => {
    for (const node of nodes) {
      const props = node.props ?? {};
      for (const value of [props.text, props.label, props.title, props.placeholder]) {
        if (typeof value === "string" && value.trim().toLowerCase().includes(needle)) keys.add(value);
      }
      if (node.children) walk(node.children);
    }
  };
  if (scope !== "selected") walk(config.sections);

  let next = config;
  for (const override of config.contentOverrides ?? []) {
    if (!override.key.toLowerCase().includes(needle)) continue;
    if (scope === "selected" && !allowed.has(override.id)) continue;
    next = upsertTextOverride(next, { ...override, value: replace });
  }
  for (const key of keys) {
    next = upsertTextOverride(next, { key, value: key.replace(new RegExp(find, "gi"), replace) });
  }
  return next;
}
