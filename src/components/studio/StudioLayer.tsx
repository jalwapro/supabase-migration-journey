import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageKey, type AppPageConfig } from "@/lib/app-customization/schema";
import { createProductionRenderer } from "@/lib/app-customization/production-renderer";
import { StudioPreviewEditor } from "./StudioPreviewEditor";

const PATH_TO_PAGE: Record<string, AppPageKey> = { "/":"home", "/rooms":"rooms", "/voice-room":"voice-room", "/video-room":"video-room", "/wallet":"wallet", "/messages":"messages", "/rank":"ranking", "/gifts":"gifts", "/notifications":"notifications", "/settings":"settings", "/recharge":"recharge", "/recharge-history":"recharge-history", "/withdraw":"withdraw", "/gallery":"gallery", "/visitors":"visitors", "/games":"games", "/privacy":"privacy", "/me":"profile" };
function pageForPath(pathname: string): AppPageKey | null { if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname]; if (pathname.startsWith("/room/")) return "voice-room"; if (pathname.startsWith("/pk/")) return "pk-battle"; if (pathname.startsWith("/profile/")) return "profile"; return null; }

export function StudioLayer() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [config,setConfig]=useState<AppPageConfig|null>(null);
  const page=useMemo(()=>pageForPath(pathname),[pathname]);
  const [studioPreview,setStudioPreview]=useState(false);

  useEffect(()=>{ if(typeof window!=="undefined") setStudioPreview(new URLSearchParams(window.location.search).get("studioPreview")==="1"); },[pathname]);
  useEffect(()=>{
    let cancelled=false;
    if(!page){setConfig(null);return;}
    void (async()=>{
      const {data:pageRow}=await supabase.from("app_customization_pages").select("id").eq("page_key",page).eq("is_enabled",true).maybeSingle();
      if(!pageRow||cancelled){setConfig(null);return;}
      const source=studioPreview
        ? await supabase.from("app_customization_versions").select("config").eq("page_id",pageRow.id).eq("status","draft").order("version",{ascending:false}).limit(1).maybeSingle()
        : await supabase.from("app_customization_published").select("config").eq("page_id",pageRow.id).eq("is_current",true).maybeSingle();
      if(cancelled)return;
      const raw=source.data?.config;
      setConfig(raw?normalizePageConfig(raw,page):null);
    })();
    return()=>{cancelled=true;};
  },[page,studioPreview]);

  useEffect(()=>{ if(!config)return; return createProductionRenderer(config); },[config]);
  if(!page)return null;
  return studioPreview ? <StudioPreviewEditor /> : null;
}
