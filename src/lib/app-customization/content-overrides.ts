import type { ContentOverride } from "./schema";

export function resolveContentOverride(overrides: ContentOverride[] | undefined, id: string, key: string, fallback: string, locale = "default") {
  const exact = overrides?.find(item => item.id === id && item.key === key && (item.locale ?? "default") === locale);
  if (exact) return exact.value;
  const global = overrides?.find(item => item.id === "*" && item.key === key && (item.locale ?? "default") === locale);
  return global?.value ?? fallback;
}

export function upsertContentOverride(overrides: ContentOverride[], next: ContentOverride) {
  const copy = [...overrides];
  const index = copy.findIndex(item => item.id === next.id && item.key === next.key && (item.locale ?? "default") === (next.locale ?? "default"));
  if (index === -1) copy.push(next); else copy[index] = next;
  return copy;
}
