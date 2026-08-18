import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageConfig, type AppPageKey, type ComponentStyle, type StudioRuntimeOverride } from "@/lib/app-customization/schema";
import { toast } from "sonner";

const EDITABLE_PROPERTIES = ["background", "color", "fontSize", "fontWeight", "borderRadius", "padding", "margin", "opacity", "display", "width", "height", "translate"] as const;
type EditableProperty = typeof EDITABLE_PROPERTIES[number];
type SelectedElement = { selector: string; tag: string; text: string; style: ComponentStyle };
type Interaction = { mode: "drag" | "resize"; startX: number; startY: number; startWidth: number; startHeight: number; startTranslateX: number; startTranslateY: number };

function pageFromPath(pathname: string): AppPageKey | null {
  if (pathname === "/") return "home";
  if (pathname === "/rooms") return "rooms";
  if (pathname === "/wallet") return "wallet";
  if (pathname === "/messages") return "messages";
  if (pathname === "/rank") return "ranking";
  if (pathname === "/gifts") return "gifts";
  if (pathname === "/notifications") return "notifications";
  if (pathname === "/settings") return "settings";
  if (pathname === "/me" || pathname.startsWith("/profile/")) return "profile";
  if (pathname === "/recharge") return "recharge";
  if (pathname === "/recharge-history") return "recharge-history";
  if (pathname === "/withdraw") return "withdraw";
  if (pathname === "/gallery") return "gallery";
  if (pathname === "/visitors") return "visitors";
  if (pathname === "/games") return "games";
  if (pathname === "/privacy") return "privacy";
  if (pathname.startsWith("/room/")) return "voice-room";
  if (pathname.startsWith("/pk/")) return "pk-battle";
  return null;
}

function selectorFor(element: Element): string {
  const html = element as HTMLElement;
  if (html.id) return `#${CSS.escape(html.id)}`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && current.parentElement) {
    const parent = current.parentElement;
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current!.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`);
    if (parent.id) { parts.unshift(`#${CSS.escape(parent.id)}`); break; }
    current = parent;
  }
  return parts.join(" > ") || "body";
}

function computedStyleOf(element: Element): ComponentStyle {
  const style = window.getComputedStyle(element);
  const translate = style.translate && style.translate !== "none" ? style.translate : "0px 0px";
  return { background: style.backgroundColor, color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, borderRadius: style.borderRadius, padding: style.padding, margin: style.margin, opacity: Number(style.opacity), display: style.display, width: style.width, height: style.height, translate };
}

function parseTranslate(value: unknown): [number, number] {
  if (typeof value !== "string") return [0, 0];
  const nums = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return [nums[0] ?? 0, nums[1] ?? 0];
}

function applyOverride(override: StudioRuntimeOverride) {
  let nodes: NodeListOf<Element>;
  try { nodes = document.querySelectorAll(override.selector); } catch { return; }
  nodes.forEach((node) => {
    const element = node as HTMLElement;
    for (const [key, value] of Object.entries(override.style ?? {})) {
      if (!EDITABLE_PROPERTIES.includes(key as EditableProperty)) continue;
      const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      if (value === undefined || value === null || value === "") element.style.removeProperty(cssKey);
      else element.style.setProperty(cssKey, String(value), "important");
    }
    if (override.visible === false) element.style.setProperty("display", "none", "important");
  });
}

function applyAll(config: AppPageConfig) { (config.runtimeOverrides ?? []).forEach(applyOverride); }

export function StudioPreviewEditor() {
  const page = useMemo(() => pageFromPath(window.location.pathname), []);
  const [config, setConfig] = useState<AppPageConfig | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [draft, setDraft] = useState<ComponentStyle>({});
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [handlePosition, setHandlePosition] = useState({ left: -100, top: -100 });
  const selectedRef = useRef<HTMLElement | null>(null);

  const loadConfig = useCallback(async () => {
    if (!page) return;
    const { data: pageRow } = await supabase.from("app_customization_pages").select("id").eq("page_key", page).eq("is_enabled", true).maybeSingle();
    if (!pageRow) return;
    const { data: draftRow } = await supabase.from("app_customization_versions").select("config").eq("page_id", pageRow.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
    const next = normalizePageConfig(draftRow?.config, page);
    setConfig(next);
    applyAll(next);
  }, [page]);

  useEffect(() => { void loadConfig(); }, [loadConfig]);
  useEffect(() => {
    if (!config) return;
    applyAll(config);
    const observer = new MutationObserver(() => applyAll(config));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [config]);

  const refreshHandle = useCallback(() => {
    const node = selectedRef.current;
    if (!node || !selected) return setHandlePosition({ left: -100, top: -100 });
    const rect = node.getBoundingClientRect();
    setHandlePosition({ left: Math.max(4, rect.right - 6), top: Math.max(4, rect.bottom - 6) });
  }, [selected]);

  useEffect(() => { refreshHandle(); window.addEventListener("resize", refreshHandle); window.addEventListener("scroll", refreshHandle, true); return () => { window.removeEventListener("resize", refreshHandle); window.removeEventListener("scroll", refreshHandle, true); }; }, [refreshHandle, draft]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-studio-editor-ui]") || !document.body.contains(target)) return;
      if (["HTML", "BODY", "SCRIPT", "STYLE", "LINK", "IFRAME"].includes(target.tagName)) return;
      event.preventDefault(); event.stopPropagation();
      const selector = selectorFor(target);
      selectedRef.current = target;
      const current = (config?.runtimeOverrides ?? []).find((item) => item.selector === selector);
      const style = current?.style ?? computedStyleOf(target);
      setSelected({ selector, tag: target.tagName.toLowerCase(), text: (target.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 90), style });
      setDraft(style);
      requestAnimationFrame(refreshHandle);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [config, refreshHandle]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!interaction || !selectedRef.current) return;
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      if (interaction.mode === "drag") {
        setStyleDirect("translate", `${Math.round(interaction.startTranslateX + dx)}px ${Math.round(interaction.startTranslateY + dy)}px`);
      } else {
        setStyleDirect("width", `${Math.max(24, Math.round(interaction.startWidth + dx))}px`);
        setStyleDirect("height", `${Math.max(24, Math.round(interaction.startHeight + dy))}px`);
      }
    };
    const onPointerUp = () => setInteraction(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => { window.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerup", onPointerUp); };
  }, [interaction]);

  useEffect(() => {
    if (!selected) return;
    const node = selectedRef.current;
    if (!node) return;
    for (const [key, value] of Object.entries(draft)) {
      if (!EDITABLE_PROPERTIES.includes(key as EditableProperty)) continue;
      const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      if (value === undefined || value === null || value === "") node.style.removeProperty(cssKey);
      else node.style.setProperty(cssKey, String(value), "important");
    }
    refreshHandle();
  }, [draft, selected, refreshHandle]);

  const setStyleDirect = (key: EditableProperty, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const setStyle = (key: EditableProperty, value: string) => setStyleDirect(key, value);

  const startDrag = (event: React.PointerEvent) => {
    if (!selectedRef.current || !selected) return;
    event.preventDefault(); event.stopPropagation();
    const [tx, ty] = parseTranslate(draft.translate);
    setInteraction({ mode: "drag", startX: event.clientX, startY: event.clientY, startWidth: selectedRef.current.getBoundingClientRect().width, startHeight: selectedRef.current.getBoundingClientRect().height, startTranslateX: tx, startTranslateY: ty });
  };
  const startResize = (event: React.PointerEvent) => {
    if (!selectedRef.current || !selected) return;
    event.preventDefault(); event.stopPropagation();
    const rect = selectedRef.current.getBoundingClientRect();
    const [tx, ty] = parseTranslate(draft.translate);
    setInteraction({ mode: "resize", startX: event.clientX, startY: event.clientY, startWidth: rect.width, startHeight: rect.height, startTranslateX: tx, startTranslateY: ty });
  };

  const buildConfig = () => {
    if (!selected || !config) return config;
    const existing = config.runtimeOverrides ?? [];
    const override: StudioRuntimeOverride = { id: existing.find((item) => item.selector === selected.selector)?.id ?? `dom-${Date.now()}`, selector: selected.selector, style: draft, visible: true };
    return { ...config, runtimeOverrides: [...existing.filter((item) => item.selector !== selected.selector), override] };
  };

  async function saveDraft() {
    if (!page || !config) return;
    const next = buildConfig(); setSaving(true);
    const { data: pageRow, error: pageError } = await supabase.from("app_customization_pages").select("id,name").eq("page_key", page).maybeSingle();
    if (pageError || !pageRow) { toast.error(pageError?.message ?? "Page not found"); setSaving(false); return; }
    const { data: draftRow } = await supabase.from("app_customization_versions").select("id").eq("page_id", pageRow.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
    const result = draftRow?.id ? await supabase.from("app_customization_versions").update({ config: next }).eq("id", draftRow.id) : await supabase.from("app_customization_versions").insert({ page_id: pageRow.id, version: 1, status: "draft", config: next });
    setSaving(false); if (result.error) toast.error(result.error.message); else { setConfig(next); toast.success("Draft saved"); }
  }

  async function publish() {
    if (!page || !config) return;
    const next = buildConfig(); setSaving(true);
    const { data: pageRow, error: pageError } = await supabase.from("app_customization_pages").select("id,name").eq("page_key", page).maybeSingle();
    if (pageError || !pageRow) { toast.error(pageError?.message ?? "Page not found"); setSaving(false); return; }
    const { data: latest, error: latestError } = await supabase.from("app_customization_versions").select("version").eq("page_id", pageRow.id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latestError) { toast.error(latestError.message); setSaving(false); return; }
    const version = (latest?.version ?? 0) + 1;
    const { data: publishedVersion, error: versionError } = await supabase.from("app_customization_versions").insert({ page_id: pageRow.id, version, status: "published", config: next, published_at: new Date().toISOString() }).select("id").single();
    if (versionError || !publishedVersion) { toast.error(versionError?.message ?? "Publish failed"); setSaving(false); return; }
    await supabase.from("app_customization_published").update({ is_current: false }).eq("page_id", pageRow.id).eq("is_current", true);
    const { error: pubError } = await supabase.from("app_customization_published").insert({ page_id: pageRow.id, version_id: publishedVersion.id, config: next, version, published_at: new Date().toISOString(), is_current: true });
    setSaving(false); if (pubError) toast.error(pubError.message); else { setConfig(next); toast.success(`${pageRow.name} published`); }
  }

  function removeOverride() {
    if (!selected || !config) return;
    const next = { ...config, runtimeOverrides: (config.runtimeOverrides ?? []).filter((item) => item.selector !== selected.selector) };
    setConfig(next);
    if (selectedRef.current) { for (const key of EDITABLE_PROPERTIES) selectedRef.current.style.removeProperty(key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)); }
    setDraft(computedStyleOf(selectedRef.current ?? document.body));
  }

  if (!page) return null;
  const dragging = interaction?.mode === "drag";
  return (
    <>
      {selected && <div data-studio-editor-ui onPointerDown={startDrag} className="fixed z-[2147483645] cursor-move border-2 border-primary/80 bg-primary/5" style={{ left: Math.max(0, handlePosition.left - 9999), top: Math.max(0, handlePosition.top - 9999), width: 1, height: 1, pointerEvents: "none" }} />}
      {selected && <div data-studio-editor-ui onPointerDown={startResize} className="fixed z-[2147483647] h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-primary shadow-lg" style={{ left: handlePosition.left, top: handlePosition.top, touchAction: "none" }} />}
      <div data-studio-editor-ui className={`fixed right-3 top-3 z-[2147483647] w-[330px] rounded-2xl border border-white/15 bg-black/90 p-3 text-white shadow-2xl backdrop-blur-xl ${dragging ? "ring-2 ring-primary/40" : ""}`}>
        <div className="flex items-center justify-between gap-2"><div><div className="text-xs font-bold">Jalwa App Studio</div><div className="text-[10px] text-white/50">Real page editor · {page}</div></div><button data-studio-editor-ui className="rounded-md bg-white/10 px-2 py-1 text-[10px]" onClick={() => setCollapsed((v) => !v)}>{collapsed ? "Open" : "Hide"}</button></div>
        {!collapsed && <>
          <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-[10px] text-white/65">Drag the selected element directly. Use the corner handle to resize. Changes stay in draft until Publish.</div>
          {selected ? <>
            <div className="mt-3 rounded-lg bg-white/5 p-2"><div className="font-mono text-[10px] text-cyan-300">{selected.tag}</div><div className="mt-1 truncate text-[10px] text-white/60">{selected.text || selected.selector}</div></div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["width","height","translate","background","color","fontSize","fontWeight","borderRadius","padding","margin","opacity"] as EditableProperty[]).map((key) => <label key={key} className="text-[9px] text-white/55"><span className="mb-1 block">{key}</span><input data-studio-editor-ui className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white outline-none" value={String(draft[key] ?? "")} onChange={(e) => setStyle(key, e.target.value)} /></label>)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2"><button data-studio-editor-ui onClick={() => setStyle("translate", "0px 0px")} className="rounded-lg bg-white/10 px-2 py-2 text-[10px]">Reset Position</button><button data-studio-editor-ui onClick={() => setStyle("width", "auto")} className="rounded-lg bg-white/10 px-2 py-2 text-[10px]">Auto Width</button><button data-studio-editor-ui onClick={() => setStyle("height", "auto")} className="rounded-lg bg-white/10 px-2 py-2 text-[10px]">Auto Height</button></div>
            <div className="mt-3 flex gap-2"><button data-studio-editor-ui onClick={() => void saveDraft()} disabled={saving} className="flex-1 rounded-lg bg-white/10 px-2 py-2 text-[10px] disabled:opacity-50">{saving ? "Saving…" : "Save Draft"}</button><button data-studio-editor-ui onClick={() => void publish()} disabled={saving} className="flex-1 rounded-lg bg-primary px-2 py-2 text-[10px] disabled:opacity-50">Publish</button></div>
            <button data-studio-editor-ui onClick={removeOverride} className="mt-2 w-full rounded-lg border border-red-400/20 px-2 py-1.5 text-[10px] text-red-200">Reset selected element</button>
          </> : <div className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-[10px] text-white/45">Select an element on the real page to begin editing.</div>}
        </>}
      </div>
    </>
  );
}
