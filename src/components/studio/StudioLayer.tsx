import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageKey, type AppPageConfig } from "@/lib/app-customization/schema";
import { StudioRenderer } from "./StudioRenderer";
import { StudioPreviewEditor } from "./StudioPreviewEditor";

const PATH_TO_PAGE: Record<string, AppPageKey> = {
  "/": "home",
  "/rooms": "rooms",
  "/voice-room": "voice-room",
  "/video-room": "video-room",
  "/wallet": "wallet",
  "/messages": "messages",
  "/rank": "ranking",
  "/gifts": "gifts",
  "/notifications": "notifications",
  "/settings": "settings",
  "/recharge": "recharge",
  "/recharge-history": "recharge-history",
  "/withdraw": "withdraw",
  "/gallery": "gallery",
  "/visitors": "visitors",
  "/games": "games",
  "/privacy": "privacy",
  "/me": "profile",
};

function pageForPath(pathname: string): AppPageKey | null {
  if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname];
  if (pathname.startsWith("/room/")) return "voice-room";
  if (pathname.startsWith("/pk/")) return "pk-battle";
  if (pathname.startsWith("/profile/")) return "profile";
  return null;
}

function applyRuntimeConfig(config: AppPageConfig) {
  for (const override of config.runtimeOverrides ?? []) {
    let nodes: NodeListOf<Element>;
    try { nodes = document.querySelectorAll(override.selector); } catch { continue; }
    nodes.forEach((node) => {
      const element = node as HTMLElement;
      for (const [key, value] of Object.entries(override.style ?? {})) {
        if (value === undefined || value === null || value === "") continue;
        const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        element.style.setProperty(cssKey, String(value), "important");
      }
      if (override.visible === false) element.style.setProperty("display", "none", "important");
    });
  }
}

export function StudioLayer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [config, setConfig] = useState<AppPageConfig | null>(null);
  const page = useMemo(() => pageForPath(pathname), [pathname]);
  const studioPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("studioPreview") === "1";

  useEffect(() => {
    let cancelled = false;
    if (!page) { setConfig(null); return; }
    void (async () => {
      const { data: pageRow } = await supabase.from("app_customization_pages").select("id").eq("page_key", page).eq("is_enabled", true).maybeSingle();
      if (!pageRow || cancelled) { setConfig(null); return; }

      if (studioPreview) {
        const { data: draft } = await supabase.from("app_customization_versions").select("config").eq("page_id", pageRow.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
        if (!cancelled) setConfig(normalizePageConfig(draft?.config, page));
        return;
      }

      const { data: published } = await supabase.from("app_customization_published").select("config").eq("page_id", pageRow.id).eq("is_current", true).maybeSingle();
      if (!cancelled) setConfig(normalizePageConfig(published?.config, page));
    })();
    return () => { cancelled = true; };
  }, [page, studioPreview]);

  useEffect(() => {
    if (!config) return;
    applyRuntimeConfig(config);
    const observer = new MutationObserver(() => applyRuntimeConfig(config));
    const start = window.setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 0);
    return () => { window.clearTimeout(start); observer.disconnect(); };
  }, [config]);

  if (!page || !config) return studioPreview ? <StudioPreviewEditor /> : null;

  return <>
    {studioPreview && <StudioPreviewEditor />}
    {config.sections.length > 0 && <section aria-label="Published App Studio customization" className="w-full space-y-3 px-4 pb-4 pt-2">
      {config.sections.map((component) => <StudioRenderer key={component.id} component={component} />)}
    </section>}
  </>;
}
