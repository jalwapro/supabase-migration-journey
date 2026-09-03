import { DEFAULT_TOKENS, mergeDesignTokens, resolveToken, type DesignTokens } from "./design-system";
import type { ComponentStyle } from "./schema";
import { supabase } from "@/integrations/supabase/client";

export async function loadPublishedDesignTokens(projectKey = "jalwa"): Promise<DesignTokens> {
  const { data, error } = await supabase
    .from("app_studio_design_tokens")
    .select("tokens")
    .eq("project_key", projectKey)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.tokens || typeof data.tokens !== "object") return DEFAULT_TOKENS;
  return mergeDesignTokens(DEFAULT_TOKENS, data.tokens as Partial<DesignTokens>);
}

const TOKEN_FIELDS: Array<keyof ComponentStyle> = [
  "background", "color", "borderColor", "borderRadius", "boxShadow", "fontFamily",
  "fontSize", "fontWeight", "lineHeight", "letterSpacing", "padding", "margin", "gap",
];

export function resolveStyleTokens(style: ComponentStyle = {}, tokens: DesignTokens): ComponentStyle {
  const next = { ...style };
  for (const field of TOKEN_FIELDS) {
    const value = next[field];
    if (typeof value === "string") next[field] = resolveToken(value, tokens, value) as never;
  }
  return next;
}

export function tokenCssVariables(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  Object.entries(tokens.colors).forEach(([k, v]) => { vars[`--jalwa-color-${k}`] = String(v); });
  Object.entries(tokens.spacing).forEach(([k, v]) => { vars[`--jalwa-space-${k}`] = String(v); });
  Object.entries(tokens.radius).forEach(([k, v]) => { vars[`--jalwa-radius-${k}`] = String(v); });
  Object.entries(tokens.shadows).forEach(([k, v]) => { vars[`--jalwa-shadow-${k}`] = String(v); });
  Object.entries(tokens.typography).forEach(([name, spec]) => {
    Object.entries(spec as Record<string, unknown>).forEach(([prop, value]) => { vars[`--jalwa-type-${name}-${prop}`] = String(value); });
  });
  return vars;
}
