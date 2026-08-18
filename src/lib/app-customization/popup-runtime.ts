import { supabase } from "@/integrations/supabase/client";
import { normalizePopup, type PopupConfig } from "./popup-manager";

function safePopup(value: unknown, index: number): PopupConfig | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id : `popup-${index}`;
  const name = typeof item.name === "string" ? item.name : id;
  const kind = ["popup", "modal", "dialog", "bottom-sheet", "drawer"].includes(String(item.kind))
    ? item.kind as PopupConfig["kind"] : "modal";
  return normalizePopup({ ...item as Partial<PopupConfig>, id, name, kind });
}

export async function loadPublishedPopups(): Promise<PopupConfig[]> {
  const { data: page, error: pageError } = await supabase
    .from("app_customization_pages")
    .select("id")
    .eq("page_key", "home")
    .eq("is_enabled", true)
    .maybeSingle();
  if (pageError || !page?.id) return [];

  const { data, error } = await supabase
    .from("app_customization_published")
    .select("config")
    .eq("page_id", page.id)
    .eq("is_current", true)
    .maybeSingle();
  if (error || !data?.config || typeof data.config !== "object") return [];

  const config = data.config as Record<string, unknown>;
  const raw = Array.isArray(config.popups) ? config.popups : [];
  return raw.map(safePopup).filter((item): item is PopupConfig => !!item);
}

export function popupStyle(config: PopupConfig): Record<string, string | number> {
  const style: Record<string, string | number> = {};
  if (config.width != null) style.width = String(config.width);
  if (config.height != null) style.height = String(config.height);
  if (config.minWidth != null) style.minWidth = String(config.minWidth);
  if (config.maxWidth != null) style.maxWidth = String(config.maxWidth);
  if (config.minHeight != null) style.minHeight = String(config.minHeight);
  if (config.maxHeight != null) style.maxHeight = String(config.maxHeight);
  if (config.radius != null) style.borderRadius = String(config.radius);
  if (config.blur != null) style.backdropFilter = `blur(${Number(config.blur)}px)`;
  return style;
}
