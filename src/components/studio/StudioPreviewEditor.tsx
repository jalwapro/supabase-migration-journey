import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePageConfig, type AppPageConfig, type AppPageKey, type ComponentStyle, type StudioRuntimeOverride } from "@/lib/app-customization/schema";
import { snapPosition, snapSize } from "@/lib/app-customization/studio-snap";
import { toast } from "sonner";

const EDITABLE = ["background", "color", "fontSize", "fontWeight", "borderRadius", "padding", "margin", "opacity", "display", "width", "height", "translate"] as const;
type EditableProperty = typeof EDITABLE[number];
type Interaction = { mode: "drag" | "resize"; startX: number; startY: number; startWidth: number; startHeight: number; startTx: number; startTy: number };
type Selected = { selector: string; tag: string; text: string };

function pageFromPath(path: string): AppPageKey | null {
  if (path === "/") return "home"; if (path === "/rooms") return "rooms"; if (path === "/wallet") return "wallet"; if (path === "/messages") return "messages"; if (path === "/rank") return "ranking"; if (path === "/gifts") return "gifts"; if (path === "/notifications") return "notifications"; if (path === "/settings") return "settings"; if (path === "/me" || path.startsWith("/profile/")) return "profile"; if (path === "/recharge") return "recharge"; if (path === "/recharge-history") return "recharge-history"; if (path === "/withdraw") return "withdraw"; if (path === "/gallery") return "gallery"; if (path === "/visitors") return "visitors"; if (path === "/games") return "games"; if (path === "/privacy") return "privacy"; if (path.startsWith("/room/")) return "voice-room"; if (path.startsWith("/pk/")) return "pk-battle"; return null;
}

function selectorFor(el: Element) {
  const html = el as HTMLElement;
  if (html.id) return `#${CSS.escape(html.id)}`;
  const parts: string[] = []; let cur: Element | null = el;
  while (cur && cur !== document.body && cur.parentElement) {
    const parent = cur.parentElement; const siblings = Array.from(parent.children).filter((x) => x.tagName === cur!.tagName); const index = siblings.indexOf(cur) + 1;
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${index})`); if (parent.id) { parts.unshift(`#${CSS.escape(parent.id)}`); break; } cur = parent;
  }
  return parts.join(" > ") || "body";
}

function parseTranslate(value: unknown): [number, number] { const n = typeof value === "string" ? value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [] : []; return [n[0] ?? 0, n[1] ?? 0]; }
function computedStyle(el: Element): ComponentStyle { const s = getComputedStyle(el); return { background: s.backgroundColor, color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, borderRadius: s.borderRadius, padding: s.padding, margin: s.margin, opacity: Number(s.opacity), display: s.display, width: s.width, height: s.height, translate: s.translate && s.translate !== "none" ? s.translate : "0px 0px" }; }
function applyOverride(o: StudioRuntimeOverride) { let nodes: NodeListOf<Element>; try { nodes = document.querySelectorAll(o.selector); } catch { return; } nodes.forEach((node) => { const el = node as HTMLElement; for (const [key, value] of Object.entries(o.style ?? {})) { if (!EDITABLE.includes(key as EditableProperty)) continue; const css = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`); if (value == null || value === "") el.style.removeProperty(css); else el.style.setProperty(css, String(value), "important"); } if (o.visible === false) el.style.setProperty("display", "none", "important"); }); }
function applyAll(config: AppPageConfig) { (config.runtimeOverrides ?? []).forEach(applyOverride); }

export function StudioPreviewEditor() {
  const page = useMemo(() => pageFromPath(window.location.pathname), []);
  const [config, setConfig] = useState<AppPageConfig | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [draft, setDraft] = useState<ComponentStyle>({});
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [grid, setGrid] = useState(8);
  const [snapOn, setSnapOn] = useState(true);
  const [guides, setGuides] = useState(true);
  const [handle, setHandle] = useState({ left: -100, top: -100 });
  const selectedRef = useRef<HTMLElement | null>(null);
  const history = useRef<ComponentStyle[]>([]);
  const redo = useRef<ComponentStyle[]>([]);

  const load = useCallback(async () => {
    if (!page) return;
    const { data: p } = await supabase.from("app_customization_pages").select("id").eq("page_key", page).eq("is_enabled", true).maybeSingle();
    if (!p) return;
    const { data } = await supabase.from("app_customization_versions").select("config").eq("page_id", p.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
    const next = normalizePageConfig(data?.config, page); setConfig(next); applyAll(next);
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!config) return; applyAll(config); const observer = new MutationObserver(() => applyAll(config)); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, [config]);

  const refreshHandle = useCallback(() => { const el = selectedRef.current; if (!el) return setHandle({ left: -100, top: -100 }); const r = el.getBoundingClientRect(); setHandle({ left: Math.max(4, r.right - 6), top: Math.max(4, r.bottom - 6) }); }, []);
  useEffect(() => { refreshHandle(); window.addEventListener("resize", refreshHandle); window.addEventListener("scroll", refreshHandle, true); return () => { window.removeEventListener("resize", refreshHandle); window.removeEventListener("scroll", refreshHandle, true); }; }, [refreshHandle, draft]);

  useEffect(() => {
    const click = (event: MouseEvent) => { const target = event.target as HTMLElement | null; if (!target || target.closest("[data-studio-editor-ui]") || ["HTML", "BODY", "SCRIPT", "STYLE", "LINK", "IFRAME"].includes(target.tagName)) return; event.preventDefault(); event.stopPropagation(); const selector = selectorFor(target); selectedRef.current = target; const existing = (config?.runtimeOverrides ?? []).find((x) => x.selector === selector); setSelected({ selector, tag: target.tagName.toLowerCase(), text: (target.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 90) }); setDraft(existing?.style ?? computedStyle(target)); history.current = []; redo.current = []; requestAnimationFrame(refreshHandle); };
    document.addEventListener("click", click, true); return () => document.removeEventListener("click", click, true);
  }, [config, refreshHandle]);

  const setStyle = useCallback((key: EditableProperty, value: string, record = true) => { setDraft((prev) => { if (record) { history.current.push(prev); if (history.current.length > 100) history.current.shift(); redo.current = []; } return { ...prev, [key]: value }; }); }, []);
  const undo = () => { const prev = history.current.pop(); if (!prev) return; setDraft((cur) => { redo.current.push(cur); return prev; }); };
  const redoNow = () => { const next = redo.current.pop(); if (!next) return; setDraft((cur) => { history.current.push(cur); return next; }); };

  useEffect(() => {
    const move = (e: PointerEvent) => { const d = interaction; const el = selectedRef.current; if (!d || !el) return; const dx = e.clientX - d.startX, dy = e.clientY - d.startY; const rect = el.getBoundingClientRect();
      if (d.mode === "drag") {
        const parent = el.parentElement?.getBoundingClientRect(); const viewport = { width: parent?.width ?? window.innerWidth, height: parent?.height ?? window.innerHeight };
        const rawX = d.startTx + dx, rawY = d.startTy + dy; const result = snapPosition({ left: 0, top: 0, width: rect.width, height: rect.height }, rawX, rawY, { grid, threshold: Math.max(4, grid * 0.75), viewport, snapToViewport: snapOn, snapToCenter: snapOn });
        setStyle("translate", `${result.x}px ${result.y}px`, false); setGuides(result.guides.length > 0);
      } else { const size = snapSize(d.startWidth + dx, d.startHeight + dy, { grid, minWidth: 24, minHeight: 24 }); setStyle("width", `${size.width}px`, false); setStyle("height", `${size.height}px`, false); }
    };
    const up = () => setInteraction(null); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [interaction, grid, snapOn, setStyle]);

  useEffect(() => { if (!selectedRef.current) return; for (const [key, value] of Object.entries(draft)) { if (!EDITABLE.includes(key as EditableProperty)) continue; const css = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`); if (value == null || value === "") selectedRef.current.style.removeProperty(css); else selectedRef.current.style.setProperty(css, String(value), "important"); } refreshHandle(); }, [draft, refreshHandle]);

  useEffect(() => { const key = (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey)) return; if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redoNow(); } else if (e.key.toLowerCase() === "s") { e.preventDefault(); void saveDraft(); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); });

  const startDrag = (e: React.PointerEvent) => { if (!selectedRef.current) return; e.preventDefault(); e.stopPropagation(); const [tx, ty] = parseTranslate(draft.translate); history.current.push(draft); setInteraction({ mode: "drag", startX: e.clientX, startY: e.clientY, startWidth: selectedRef.current.getBoundingClientRect().width, startHeight: selectedRef.current.getBoundingClientRect().height, startTx: tx, startTy: ty }); };
  const startResize = (e: React.PointerEvent) => { if (!selectedRef.current) return; e.preventDefault(); e.stopPropagation(); const r = selectedRef.current.getBoundingClientRect(); history.current.push(draft); setInteraction({ mode: "resize", startX: e.clientX, startY: e.clientY, startWidth: r.width, startHeight: r.height, startTx: 0, startTy: 0 }); };

  const buildConfig = () => { if (!config || !selected) return config; const existing = config.runtimeOverrides ?? []; const override: StudioRuntimeOverride = { id: existing.find((x) => x.selector === selected.selector)?.id ?? `dom-${Date.now()}`, selector: selected.selector, style: draft, visible: true }; return { ...config, runtimeOverrides: [...existing.filter((x) => x.selector !== selected.selector), override] }; };
  async function saveDraft() { if (!page || !config) return; setSaving(true); const next = buildConfig(); const { data: p, error: pe } = await supabase.from("app_customization_pages").select("id").eq("page_key", page).maybeSingle(); if (pe || !p) { toast.error(pe?.message ?? "Page not found"); setSaving(false); return; } const { data: d } = await supabase.from("app_customization_versions").select("id").eq("page_id", p.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle(); const result = d?.id ? await supabase.from("app_customization_versions").update({ config: next }).eq("id", d.id) : await supabase.from("app_customization_versions").insert({ page_id: p.id, version: 1, status: "draft", config: next }); setSaving(false); if (result.error) toast.error(result.error.message); else { setConfig(next); toast.success("Draft saved"); } }
  async function publish() { if (!page || !config) return; setSaving(true); const next = buildConfig(); const { data: p, error: pe } = await supabase.from("app_customization_pages").select("id,name").eq("page_key", page).maybeSingle(); if (pe || !p) { toast.error(pe?.message ?? "Page not found"); setSaving(false); return; } const { data: latest } = await supabase.from("app_customization_versions").select("version").eq("page_id", p.id).order("version", { ascending: false }).limit(1).maybeSingle(); const version = (latest?.version ?? 0) + 1; const { data: pv, error: ve } = await supabase.from("app_customization_versions").insert({ page_id: p.id, version, status: "published", config: next, published_at: new Date().toISOString() }).select("id").single(); if (ve || !pv) { toast.error(ve?.message ?? "Publish failed"); setSaving(false); return; } await supabase.from("app_customization_published").update({ is_current: false }).eq("page_id", p.id).eq("is_current", true); const { error } = await supabase.from("app_customization_published").insert({ page_id: p.id, version_id: pv.id, config: next, version, published_at: new Date().toISOString(), is_current: true }); setSaving(false); if (error) toast.error(error.message); else { setConfig(next); toast.success(`${p.name} published`); } }
  function reset() { if (!selected || !config) return; const next = { ...config, runtimeOverrides: (config.runtimeOverrides ?? []).filter((x) => x.selector !== selected.selector) }; setConfig(next); setDraft(computedStyle(selectedRef.current ?? document.body)); }

  if (!page) return null;
  return <>
    {selected && <div data-studio-editor-ui onPointerDown={startResize} className="fixed z-[2147483647] h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-primary shadow-lg" style={{ left: handle.left, top: handle.top, touchAction: "none" }} />}
    {selected && <div data-studio-editor-ui onPointerDown={startDrag} className="fixed z-[2147483646] -mt-7 rounded-md bg-primary px-2 py-1 text-[9px] text-white shadow-lg" style={{ left: Math.max(4, handle.left - 28), top: handle.top, cursor: "move", touchAction: "none" }}>MOVE</div>}
    <div data-studio-editor-ui className="fixed right-3 top-3 z-[2147483647] w-[350px] rounded-2xl border border-white/15 bg-black/90 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between"><div><div className="text-xs font-bold">Jalwa App Studio</div><div className="text-[10px] text-white/50">Real page editor · {page}</div></div><button data-studio-editor-ui className="rounded bg-white/10 px-2 py-1 text-[10px]" onClick={() => setCollapsed((v) => !v)}>{collapsed ? "Open" : "Hide"}</button></div>
      {!collapsed && <>
        <div className="mt-2 grid grid-cols-3 gap-1"><button data-studio-editor-ui className={`rounded px-2 py-1.5 text-[9px] ${snapOn ? "bg-primary" : "bg-white/10"}`} onClick={() => setSnapOn((v) => !v)}>Snap {snapOn ? "ON" : "OFF"}</button><button data-studio-editor-ui className={`rounded px-2 py-1.5 text-[9px] ${guides ? "bg-primary" : "bg-white/10"}`} onClick={() => setGuides((v) => !v)}>Guides {guides ? "ON" : "OFF"}</button><select data-studio-editor-ui value={grid} onChange={(e) => setGrid(Number(e.target.value))} className="rounded bg-white/10 px-1 text-[9px]"><option value="4">4px Grid</option><option value="8">8px Grid</option><option value="10">10px Grid</option><option value="16">16px Grid</option></select></div>
        <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-[10px] text-white/65">Drag selected elements with MOVE. Resize with the corner handle. Position and size snap to grid, viewport edges and center. Changes stay in draft until Publish.</div>
        {selected ? <>
          <div className="mt-3 rounded-lg bg-white/5 p-2"><div className="font-mono text-[10px] text-cyan-300">{selected.tag}</div><div className="truncate text-[10px] text-white/60">{selected.text || selected.selector}</div></div>
          <div className="mt-2 grid grid-cols-2 gap-2">{(["width","height","translate","background","color","fontSize","fontWeight","borderRadius","padding","margin","opacity"] as EditableProperty[]).map((key) => <label key={key} className="text-[9px] text-white/55"><span className="mb-1 block">{key}</span><input data-studio-editor-ui className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white outline-none" value={String(draft[key] ?? "")} onChange={(e) => setStyle(key, e.target.value)} /></label>)}</div>
          <div className="mt-3 grid grid-cols-4 gap-1"><button data-studio-editor-ui onClick={undo} className="rounded bg-white/10 px-2 py-1.5 text-[9px]">Undo</button><button data-studio-editor-ui onClick={redoNow} className="rounded bg-white/10 px-2 py-1.5 text-[9px]">Redo</button><button data-studio-editor-ui onClick={() => setStyle("translate", "0px 0px")} className="rounded bg-white/10 px-2 py-1.5 text-[9px]">Center</button><button data-studio-editor-ui onClick={reset} className="rounded bg-white/10 px-2 py-1.5 text-[9px]">Reset</button></div>
          <div className="mt-3 flex gap-2"><button data-studio-editor-ui disabled={saving} onClick={() => void saveDraft()} className="flex-1 rounded-lg bg-white/10 px-2 py-2 text-[10px]">{saving ? "Saving…" : "Save Draft"}</button><button data-studio-editor-ui disabled={saving} onClick={() => void publish()} className="flex-1 rounded-lg bg-primary px-2 py-2 text-[10px]">Publish</button></div>
        </> : <div className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-[10px] text-white/45">Select an element on the real page to begin editing.</div>}
      </>}
    </div>
  </>;
}
