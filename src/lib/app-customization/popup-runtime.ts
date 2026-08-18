import { supabase } from "@/integrations/supabase/client";
import { normalizePopup, type PopupConfig } from "./popup-manager";

export async function loadPublishedPopups(): Promise<PopupConfig[]> {
  const { data, error } = await supabase
    .from("app_customization_published")
    .select("config")
    .eq("is_current", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.config) return [];
  const raw = (data.config as { popups?: unknown }).popups;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => normalizePopup({
      id: String(item.id ?? ""),
      name: String(item.name ?? item.id ?? "Popup"),
      kind: (item.kind as PopupConfig["kind"]) ?? "modal",
      ...(item as Partial<PopupConfig>),
    }))
    .filter((item) => item.id.length > 0);
}
