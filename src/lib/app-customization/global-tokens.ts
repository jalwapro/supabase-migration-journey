import { supabase } from "@/integrations/supabase/client";

export type GlobalDesignTokens = {
  colors: Record<string, string>;
  typography: Record<string, string | number>;
  spacing: Record<string, string | number>;
  radius: Record<string, string | number>;
  shadows: Record<string, string>;
  fonts: Record<string, string>;
  buttons?: Record<string, unknown>;
  cards?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  navigation?: Record<string, unknown>;
  popups?: Record<string, unknown>;
};

export const DEFAULT_GLOBAL_TOKENS: GlobalDesignTokens = {
  colors: {
    primary: "#8B5CF6",
    secondary: "#EC4899",
    accent: "#F59E0B",
    background: "#0B0712",
    surface: "#15101F",
    card: "#1D1729",
    textPrimary: "#FFFFFF",
    textSecondary: "#B8ADCB",
    muted: "#81758F",
    border: "#33283F",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },
  typography: {
    h1Size: "32px", h2Size: "26px", h3Size: "22px", bodySize: "15px", captionSize: "12px",
    bodyLineHeight: 1.5, headingWeight: 700, bodyWeight: 400, letterSpacing: "0px",
  },
  spacing: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", xxl: "32px" },
  radius: { none: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", xxl: "24px", pill: "9999px" },
  shadows: { none: "none", sm: "0 1px 3px rgba(0,0,0,.18)", md: "0 6px 18px rgba(0,0,0,.22)", lg: "0 16px 40px rgba(0,0,0,.28)" },
  fonts: { body: "Manrope", heading: "Sora", display: "Bebas Neue" },
};

export function mergeGlobalTokens(value: unknown): GlobalDesignTokens {
  const source = value && typeof value === "object" ? value as Partial<GlobalDesignTokens> : {};
  return {
    ...DEFAULT_GLOBAL_TOKENS,
    ...source,
    colors: { ...DEFAULT_GLOBAL_TOKENS.colors, ...(source.colors ?? {}) },
    typography: { ...DEFAULT_GLOBAL_TOKENS.typography, ...(source.typography ?? {}) },
    spacing: { ...DEFAULT_GLOBAL_TOKENS.spacing, ...(source.spacing ?? {}) },
    radius: { ...DEFAULT_GLOBAL_TOKENS.radius, ...(source.radius ?? {}) },
    shadows: { ...DEFAULT_GLOBAL_TOKENS.shadows, ...(source.shadows ?? {}) },
    fonts: { ...DEFAULT_GLOBAL_TOKENS.fonts, ...(source.fonts ?? {}) },
  };
}

export function tokensToCssVariables(tokens: GlobalDesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.colors)) vars[`--studio-color-${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`] = String(value);
  for (const [key, value] of Object.entries(tokens.typography)) vars[`--studio-type-${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`] = String(value);
  for (const [key, value] of Object.entries(tokens.spacing)) vars[`--studio-space-${key}`] = String(value);
  for (const [key, value] of Object.entries(tokens.radius)) vars[`--studio-radius-${key}`] = String(value);
  for (const [key, value] of Object.entries(tokens.shadows)) vars[`--studio-shadow-${key}`] = String(value);
  for (const [key, value] of Object.entries(tokens.fonts)) vars[`--studio-font-${key}`] = String(value);
  return vars;
}

export function applyGlobalTokens(tokens: GlobalDesignTokens) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokensToCssVariables(tokens))) root.style.setProperty(name, value);
}

export async function loadPublishedGlobalTokens(projectKey = "jalwa"): Promise<GlobalDesignTokens> {
  const { data, error } = await supabase.from("app_studio_design_tokens").select("tokens").eq("project_key", projectKey).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle();
  if (error || !data?.tokens) return DEFAULT_GLOBAL_TOKENS;
  return mergeGlobalTokens(data.tokens);
}

export async function saveDraftGlobalTokens(tokens: GlobalDesignTokens, projectKey = "jalwa", name = "Default") {
  const { data: current } = await supabase.from("app_studio_design_tokens").select("version").eq("project_key", projectKey).eq("name", name).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
  const version = Number(current?.version ?? 0) + 1;
  const { data, error } = await supabase.from("app_studio_design_tokens").insert({ project_key: projectKey, name, tokens: mergeGlobalTokens(tokens), status: "draft", version }).select("id,version,updated_at").single();
  if (error) throw error;
  return data;
}

export async function publishDraftGlobalTokens(projectKey = "jalwa", name = "Default") {
  const { data: draft, error: draftError } = await supabase.from("app_studio_design_tokens").select("id,tokens,version").eq("project_key", projectKey).eq("name", name).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
  if (draftError) throw draftError;
  if (!draft) throw new Error("No draft design tokens found");
  await supabase.from("app_studio_design_tokens").update({ status: "archived" }).eq("project_key", projectKey).eq("name", name).eq("status", "published");
  const { data, error } = await supabase.from("app_studio_design_tokens").insert({ project_key: projectKey, name, tokens: mergeGlobalTokens(draft.tokens), status: "published", version: draft.version }).select("id,version,updated_at").single();
  if (error) throw error;
  await supabase.from("app_studio_design_tokens").update({ status: "archived" }).eq("id", draft.id);
  return data;
}
