import type { AppPageConfig, ContentOverride } from "./schema";

export type TextOverrideDraft = {
  pageId: string;
  config: AppPageConfig;
  overrides: ContentOverride[];
};

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function upsertTextOverride(
  config: AppPageConfig,
  input: Omit<ContentOverride, "id"> & { id?: string },
): AppPageConfig {
  const key = normalize(input.key);
  const current = Array.isArray(config.contentOverrides) ? [...config.contentOverrides] : [];
  const index = current.findIndex((item) => normalize(item.key) === key && (item.locale ?? "default") === (input.locale ?? "default"));
  const item: ContentOverride = {
    id: input.id ?? current[index]?.id ?? crypto.randomUUID(),
    key: input.key.trim(),
    value: input.value,
    ...(input.locale ? { locale: input.locale } : {}),
  };
  if (index >= 0) current[index] = item;
  else current.push(item);
  return { ...config, contentOverrides: current };
}

export function removeTextOverride(config: AppPageConfig, id: string): AppPageConfig {
  return { ...config, contentOverrides: (config.contentOverrides ?? []).filter((item) => item.id !== id) };
}

export function replaceTextOverride(config: AppPageConfig, from: string, to: string): AppPageConfig {
  const source = normalize(from);
  return {
    ...config,
    contentOverrides: (config.contentOverrides ?? []).map((item) =>
      normalize(item.key) === source ? { ...item, value: to } : item,
    ),
  };
}

export function findTextOverrides(config: AppPageConfig, query: string) {
  const q = normalize(query);
  if (!q) return config.contentOverrides ?? [];
  return (config.contentOverrides ?? []).filter((item) => normalize(item.key).includes(q) || normalize(item.value).includes(q));
}
