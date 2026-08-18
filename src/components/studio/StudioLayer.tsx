import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageKey, type AppPageConfig, type AppComponentNode, type ComponentStyle, type DeviceKind } from "@/lib/app-customization/schema";
import { STUDIO_COMPONENT_ATTR, studioSelector } from "@/lib/app-customization/component-registry";
import { StudioPreviewEditor } from "./StudioPreviewEditor";

const PATH_TO_PAGE: Record<string, AppPageKey> = { "/":"home", "/rooms":"rooms", "/voice-room":"voice-room", "/video-room":"video-room", "/wallet":"wallet", "/messages":"messages", "/rank":"ranking", "/gifts":"gifts", "/notifications":"notifications", "/settings":"settings", "/recharge":"recharge", "/recharge-history":"recharge-history", "/withdraw":"withdraw", "/gallery":"gallery", "/visitors":"visitors", "/games":"games", "/privacy":"privacy", "/me":"profile" };
function pageForPath(pathname: string): AppPageKey | null { if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname]; if (pathname.startsWith("/room/")) return "voice-room"; if (pathname.startsWith("/pk/")) return "pk-battle"; if (pathname.startsWith("/profile/")) return "profile"; return null; }

const NON_STYLE_KEYS = new Set(["x","y","spacing"]);
function cssKey(key: string) { return key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`); }
function applyStyle(element: HTMLElement, style: ComponentStyle | undefined, important = true) {
  if (!style) return;
  for (const [key,value] of Object.entries(style)) {
    if (value === undefined || value === null || value === "" || NON_STYLE_KEYS.has(key)) continue;
    const css = cssKey(key); const rendered = typeof value === "number" && ["opacity","zIndex","fontWeight"].includes(key) ? String(value) : String(value);
    element.style.setProperty(css, rendered, important ? "important" : "");
  }
  if (style.x !== undefined) element.style.setProperty("left", String(style.x), "important");
  if (style.y !== undefined) element.style.setProperty("top", String(style.y), "important");
  if (style.spacing) {
    for (const [side,value] of Object.entries(style.spacing)) if (side !== "linked" && value !== undefined) element.style.setProperty(`padding-${side}`, String(value), "important");
  }
}
function setTokens(config: AppPageConfig) {
  const root = document.documentElement;
  for (const [name,value] of Object.entries(config.tokens?.colors ?? {})) root.style.setProperty(`--studio-color-${name}`, value);
  for (const [name,value] of Object.entries(config.tokens?.spacing ?? {})) root.style.setProperty(`--studio-space-${name}`, String(value));
  for (const [name,value] of Object.entries(config.tokens?.radius ?? {})) root.style.setProperty(`--studio-radius-${name}`, String(value));
  for (const [name,value] of Object.entries(config.tokens?.shadows ?? {})) root.style.setProperty(`--studio-shadow-${name}`, value);
  for (const [name,token] of Object.entries(config.tokens?.typography ?? {})) {
    if (token.fontSize !== undefined) root.style.setProperty(`--studio-type-${name}-size`, String(token.fontSize));
    if (token.fontWeight !== undefined) root.style.setProperty(`--studio-type-${name}-weight`, String(token.fontWeight));
    if (token.fontFamily !== undefined) root.style.setProperty(`--studio-type-${name}-font`, String(token.fontFamily));
  }
}
function applyContent(config: AppPageConfig) {
  for (const override of config.contentOverrides ?? []) {
    const nodes = document.querySelectorAll(studioSelector(override.id));
    nodes.forEach(node => {
      const el = node as HTMLElement & { value?: string; placeholder?: string; src?: string; alt?: string };
      if (override.key === "placeholder") el.setAttribute("placeholder", override.value);
      else if (override.key === "src" && "src" in el) el.src = override.value;
      else if (override.key === "alt") el.setAttribute("alt", override.value);
      else if (override.key === "label" || override.key === "text" || override.key === "textContent") el.textContent = override.value;
    });
  }
}
function applyRuntimeOverrides(config: AppPageConfig) {
  for (const override of config.runtimeOverrides ?? []) {
    let nodes: NodeListOf<Element>; try { nodes = document.querySelectorAll(override.selector); } catch { continue; }
    nodes.forEach(node => { const el=node as HTMLElement; applyStyle(el, override.style); if (override.visible === false) el.style.setProperty("display","none","important"); else if (override.visible === true) el.style.removeProperty("display"); });
  }
}
function applyNodes(nodes: AppComponentNode[], device: DeviceKind) {
  for (const node of nodes) {
    let elements: NodeListOf<Element>; try { elements = document.querySelectorAll(studioSelector(node.id)); } catch { elements = [] as unknown as NodeListOf<Element>; }
    elements.forEach(element => {
      const el = element as HTMLElement;
      const responsive = node.responsive?.[device];
      if (node.visible === false || responsive?.visible === false) el.style.setProperty("display","none","important");
      else if (node.visible === true || responsive?.visible === true) el.style.removeProperty("display");
      applyStyle(el, node.style);
      applyStyle(el, responsive?.style);
      if (node.locked) el.dataset.jalwaStudioLocked = "true";
    });
    if (node.children?.length) applyNodes(node.children, device);
  }
}
function detectDevice(): DeviceKind { const width=window.innerWidth; return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop"; }

function applyProductionConfig(config: AppPageConfig) {
  const device = detectDevice(); setTokens(config); applyNodes(config.sections, device); applyRuntimeOverrides(config); applyContent(config);
}

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
      if(studioPreview){
        const {data:draft}=await supabase.from("app_customization_versions").select("config").eq("page_id",pageRow.id).eq("status","draft").order("version",{ascending:false}).limit(1).maybeSingle();
        if(!cancelled)setConfig(normalizePageConfig(draft?.config,page)); return;
      }
      const {data:published}=await supabase.from("app_customization_published").select("config").eq("page_id",pageRow.id).eq("is_current",true).maybeSingle();
      if(!cancelled)setConfig(published?.config?normalizePageConfig(published.config,page):null);
    })();
    return()=>{cancelled=true;};
  },[page,studioPreview]);

  useEffect(()=>{
    if(!config)return;
    let raf=0; const render=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>applyProductionConfig(config));};
    render();
    const observer=new MutationObserver(render); observer.observe(document.body,{childList:true,subtree:true});
    const onResize=()=>render(); window.addEventListener("resize",onResize);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener("resize",onResize);};
  },[config]);

  if(!page)return null;
  return studioPreview ? <StudioPreviewEditor /> : null;
}
