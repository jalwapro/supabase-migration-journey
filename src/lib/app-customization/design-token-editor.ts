import { DEFAULT_TOKENS, mergeDesignTokens, type DesignTokens } from "./design-system";
import { supabase } from "@/integrations/supabase/client";

export function normalizeDesignTokens(value: unknown): DesignTokens {
  if (!value || typeof value !== "object") return DEFAULT_TOKENS;
  return mergeDesignTokens(DEFAULT_TOKENS, value as Partial<DesignTokens>);
}

export async function saveDesignTokenDraft(tokens: DesignTokens, projectKey = "jalwa") {
  const normalized = normalizeDesignTokens(tokens);
  const { data: latest } = await supabase
    .from("app_studio_design_tokens")
    .select("version")
    .eq("project_key", projectKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = Number(latest?.version ?? 0) + 1;
  return supabase.from("app_studio_design_tokens").insert({
    project_key: projectKey,
    name: "Default",
    tokens: normalized,
    status: "draft",
    version,
  }).select("id, version, status, updated_at").single();
}

export async function publishDesignTokenDraft(id: string) {
  const { data: draft, error } = await supabase
    .from("app_studio_design_tokens")
    .select("project_key, tokens, version")
    .eq("id", id)
    .eq("status", "draft")
    .single();
  if (error || !draft) return { data: null, error: error ?? new Error("Draft not found") };

  await supabase.from("app_studio_design_tokens")
    .update({ status: "archived" })
    .eq("project_key", draft.project_key)
    .eq("status", "published");

  return supabase.from("app_studio_design_tokens")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, version, status, updated_at")
    .single();
}
