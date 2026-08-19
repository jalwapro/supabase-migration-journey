import React, { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageKey, type AppPageConfig } from "@/lib/app-customization/schema";
import { createProductionRenderer } from "@/lib/app-customization/production-renderer";
import { StudioPreviewEditor } from "./StudioPreviewEditor";

const PATH_TO_PAGE: Record<string, AppPageKey> = { "/":"home", "/rooms":"rooms", "/voice-room":"voice-room", "/video-room":"video-room", "/wallet":"wallet", "/messages":"messages", "/rank":"ranking", "/gifts":"gifts", "/notifications":"notifications", "/settings":"settings", "/recharge":"recharge", "/recharge-history":"recharge-history", "/withdraw":"withdraw", "/gallery":"gallery", "/visitors":"visitors", "/games":"games", "/privacy":"privacy", "/me":"profile" };
function pageForPath(pathname: string): AppPageKey | null { if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname]; if (pathname.startsWith("/room/")) return "voice-room"; if (pathname.startsWith("/pk/")) return "pk-battle"; if (pathname.startsWith("/profile/")) return "profile"; return null; }

class StudioRuntimeBoundary extends Component<{ children: ReactNode; page: string | null }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: unknown) { return { hasError: true, message: error instanceof Error ? error.message : String(error) }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[JALWA_STUDIO_RUNTIME_ERROR]", { message: error?.message, stack: error?.stack, componentStack: info?.componentStack, page: this.props.page });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("jalwa-studio-runtime-error", { detail: { message: error?.message, stack: error?.stack, componentStack: info?.componentStack, page: this.props.page } }));
    }
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <div data-jalwa-studio-fallback className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl">
        <div className="text-sm font-semibold">Jalwa App Studio</div>
        <div className="mt-2 text-xs text-white/60">The editor hit an isolated runtime error. Your live-room application is still intact.</div>
        <div className="mt-3 rounded-lg bg-black/40 p-3 font-mono text-[10px] text-red-300 break-words">{this.state.message || "Unknown runtime error"}</div>
        <button className="mt-4 w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black" onClick={() => this.setState({ hasError: false, message: "" })}>Retry Studio</button>
      </div>
    </div>;
  }
}

export function StudioLayer() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [config,setConfig]=useState<AppPageConfig|null>(null);
  const page=useMemo(()=>pageForPath(pathname),[pathname]);
  const [studioPreview,setStudioPreview]=useState(false);
  const [runtimeError,setRuntimeError]=useState<string|null>(null);

  useEffect(()=>{ if(typeof window!=="undefined") setStudioPreview(new URLSearchParams(window.location.search).get("studioPreview")==="1"); },[pathname]);

  useEffect(()=>{
    if(typeof window === "undefined") return;
    const onError = (event: ErrorEvent) => {
      const target = event.error as Error | undefined;
      const message = target?.message || event.message || "Unknown runtime error";
      console.error("[JALWA_STUDIO_WINDOW_ERROR]", { message, stack: target?.stack, filename: event.filename, lineno: event.lineno, colno: event.colno });
      if (studioPreview && message.toLowerCase().includes("children")) setRuntimeError(message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "Unknown promise rejection");
      console.error("[JALWA_STUDIO_UNHANDLED_REJECTION]", { message, stack: reason?.stack });
      if (studioPreview) setRuntimeError(message);
    };
    window.addEventListener("error", onError); window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [studioPreview]);

  useEffect(()=>{
    let cancelled=false;
    if(!page){setConfig(null);return;}
    void (async()=>{
      try {
        const {data:pageRow,error:pageError}=await supabase.from("app_customization_pages").select("id").eq("page_key",page).eq("is_enabled",true).maybeSingle();
        if(pageError) console.error("[JALWA_STUDIO_PAGE_QUERY]", pageError);
        if(!pageRow||cancelled){setConfig(null);return;}
        const source=studioPreview
          ? await supabase.from("app_customization_versions").select("config").eq("page_id",pageRow.id).eq("status","draft").order("version",{ascending:false}).limit(1).maybeSingle()
          : await supabase.from("app_customization_published").select("config").eq("page_id",pageRow.id).eq("is_current",true).maybeSingle();
        if(cancelled)return;
        const raw=source.data?.config;
        try { setConfig(raw?normalizePageConfig(raw,page):null); } catch (error) { console.error("[JALWA_STUDIO_CONFIG_NORMALIZE]", error); setConfig(null); }
      } catch (error) {
        console.error("[JALWA_STUDIO_LOAD_ERROR]", error);
        if (!cancelled) setConfig(null);
      }
    })();
    return()=>{cancelled=true;};
  },[page,studioPreview]);

  useEffect(()=>{
    if(!config)return;
    try {
      const cleanup = createProductionRenderer(config);
      return typeof cleanup === "function" ? cleanup : undefined;
    } catch (error) {
      console.error("[JALWA_STUDIO_RENDERER_ERROR]", error);
      setRuntimeError(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  },[config]);

  if(!page)return null;
  if(studioPreview && runtimeError) return <div data-jalwa-studio-fallback className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black p-6 text-white"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-sm font-semibold">Jalwa App Studio</div><p className="mt-2 text-xs text-white/60">Studio runtime was isolated so the real application does not get replaced.</p><pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] text-red-300 whitespace-pre-wrap">{runtimeError}</pre><button className="mt-4 w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black" onClick={()=>setRuntimeError(null)}>Retry</button></div></div>;
  return <StudioRuntimeBoundary page={page}>{studioPreview ? <StudioPreviewEditor /> : null}</StudioRuntimeBoundary>;
}
