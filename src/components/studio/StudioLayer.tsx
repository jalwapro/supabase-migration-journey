import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageKey } from "@/lib/app-customization/schema";
import { StudioRenderer } from "./StudioRenderer";

const PATH_TO_PAGE: Record<string, AppPageKey> = {
  "/": "home",
  "/rooms": "rooms",
  "/voice-room": "voice-room",
  "/video-room": "video-room",
  "/pk-battle": "pk-battle",
  "/wallet": "wallet",
  "/messages": "messages",
  "/rank": "ranking",
  "/gifts": "gifts",
  "/notifications": "notifications",
  "/settings": "settings",
};

export function StudioLayer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [sections, setSections] = useState<ReturnType<typeof normalizePageConfig>["sections"]>([]);
  const page = PATH_TO_PAGE[pathname];

  useEffect(() => {
    let cancelled = false;
    if (!page) { setSections([]); return; }
    void (async () => {
      const { data: pageRow } = await supabase.from("app_customization_pages").select("id").eq("page_key", page).eq("is_enabled", true).maybeSingle();
      if (!pageRow || cancelled) { setSections([]); return; }
      const { data } = await supabase.from("app_customization_published").select("config").eq("page_id", pageRow.id).eq("is_current", true).maybeSingle();
      if (cancelled) return;
      setSections(normalizePageConfig(data?.config, page).sections);
    })();
    return () => { cancelled = true; };
  }, [page]);

  if (!page || sections.length === 0) return null;
  return <section aria-label="Published App Studio customization" className="w-full space-y-3 px-4 pb-4 pt-2">
    {sections.map((component) => <StudioRenderer key={component.id} component={component} />)}
  </section>;
}
