import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageKey, type AppPageConfig } from "./schema";
import { createProductionRenderer } from "./production-renderer";
import { bindLiveRoomComponents } from "./live-room-runtime";

type PageRow = { id: string; page_key: AppPageKey; route_pattern: string | null; is_enabled?: boolean };

let cachedPages: PageRow[] | null = null;
const configCache = new Map<string, AppPageConfig>();

function routeMatches(pattern: string | null, pathname: string) {
  if (!pattern) return false;
  if (pattern === pathname) return true;
  const normalized = pattern.replace(/\\/g, "/").replace(/:([A-Za-z0-9_]+)/g, "[^/]+");
  try { return new RegExp(`^${normalized.replace(/\\*/g, ".*")}/?$`).test(pathname); } catch { return false; }
}

async function loadPages() {
  if (cachedPages) return cachedPages;
  const { data, error } = await supabase.from("app_customization_pages").select("id,page_key,route_pattern,is_enabled").eq("is_enabled", true);
  if (error) throw error;
  cachedPages = (data ?? []) as PageRow[];
  return cachedPages;
}

async function loadPublished(page: PageRow) {
  const cached = configCache.get(page.id);
  if (cached) return cached;
  const { data, error } = await supabase.from("app_customization_published").select("config").eq("page_id", page.id).eq("is_current", true).maybeSingle();
  if (error) throw error;
  if (!data?.config) return null;
  const config = normalizePageConfig(data.config, page.page_key);
  configCache.set(page.id, config);
  return config;
}

export async function applyCurrentPublishedConfig(pathname: string) {
  if (typeof window === "undefined") return () => undefined;
  const page = (await loadPages()).filter(p => p.route_pattern).sort((a, b) => (b.route_pattern?.length ?? 0) - (a.route_pattern?.length ?? 0)).find(p => routeMatches(p.route_pattern, pathname));
  if (!page) return () => undefined;
  const config = await loadPublished(page);
  if (!config) return () => undefined;
  const cleanupRenderer = createProductionRenderer(config);
  const cleanupRoomBinding = bindLiveRoomComponents(pathname, config);
  return () => { cleanupRenderer?.(); cleanupRoomBinding?.(); };
}

export function clearPublishedRuntimeCache() { cachedPages = null; configCache.clear(); }
