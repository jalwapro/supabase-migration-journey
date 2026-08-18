import type { DesignTokens } from "./schema";
import { DEFAULT_TOKENS } from "./schema";

export type TokenCategory = keyof DesignTokens;

export function mergeDesignTokens(base: DesignTokens = DEFAULT_TOKENS, overrides?: Partial<DesignTokens>): DesignTokens {
  return {
    colors: { ...base.colors, ...(overrides?.colors ?? {}) },
    typography: { ...base.typography, ...(overrides?.typography ?? {}) },
    spacing: { ...base.spacing, ...(overrides?.spacing ?? {}) },
    radius: { ...base.radius, ...(overrides?.radius ?? {}) },
    shadows: { ...base.shadows, ...(overrides?.shadows ?? {}) },
    fonts: Array.from(new Set([...(base.fonts ?? []), ...(overrides?.fonts ?? [])])),
  };
}

export function resolveToken(value: unknown, tokens: DesignTokens, fallback?: string): string {
  if (typeof value !== "string") return fallback ?? "";
  const match = value.match(/^token\((colors|spacing|radius|shadows|fonts)\.([\w-]+)\)$/);
  if (!match) return value;
  const category = match[1] as keyof DesignTokens;
  const key = match[2];
  const bucket = tokens[category] as Record<string, unknown> | string[] | undefined;
  if (Array.isArray(bucket)) return bucket.includes(key) ? key : (fallback ?? "");
  const resolved = bucket?.[key];
  return resolved == null ? (fallback ?? "") : String(resolved);
}

export function tokenRef(category: Exclude<TokenCategory, "typography">, key: string) { return `token(${category}.${key})`; }
