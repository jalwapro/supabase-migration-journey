import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DEFAULT_APP_CONFIG, normalizePageConfig, type AppComponentNode, type AppPageConfig, type AppPageKey, type ComponentType, type DeviceKind } from "@/lib/app-customization/schema";
import { Monitor, Smartphone, Tablet, Undo2, Redo2, Save, Upload, Layers3, Box, Palette, Trash2, Lock, Unlock, Search, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/app-customization")({ component: AppCustomizationStudio });

type PageRow = { id: string; page_key: AppPageKey; name: string; description: string | null; sort_order: number };

type CatalogItem = { type: ComponentType; label: string; group: string };
const COMPONENTS: CatalogItem[] = [
  ["container","Container","Basic"],["heading","Heading","Basic"],["text","Text","Basic"],["image","Image","Basic"],["button","Button","Basic"],["card","Card","Basic"],["banner","Banner","Basic"],["carousel","Carousel","Basic"],["grid","Grid","Basic"],["tabs","Tabs","Basic"],["avatar","Avatar","Basic"],["progress","Progress","Basic"],["counter","Counter","Basic"],
  ["header","Header","Navigation"],["bottom-navigation","Bottom Navigation","Navigation"],
  ["user-profile-card","User Profile Card","Jalwa"],["live-room-card","Live Room Card","Jalwa"],["voice-room-card","Voice Room Card","Jalwa"],["video-room-card","Video Room Card","Jalwa"],["pk-battle-card","PK Battle Card","Jalwa"],["gift-grid","Gift Grid","Jalwa"],["coin-balance","Coin Balance","Jalwa"],["diamond-balance","Diamond Balance","Jalwa"],["ranking-list","Ranking List","Jalwa"],["leaderboard","Leaderboard","Jalwa"],["vip-badge","VIP Badge","Jalwa"],["level-progress","Level Progress","Jalwa"],["friend-list","Friend List","Jalwa"],["chat-list","Chat List","Jalwa"],["notification-list","Notification List","Jalwa"],
  ["follow-button","Follow Button","Actions"],["live-button","Go Live Button","Actions"],["create-room-button","Create Room Button","Actions"],["pk-battle-button","PK Battle Button","Actions"],["recharge-packages","Recharge Packages","Commerce"],["gift-card","Gift Card","Commerce"],["room-seat-layout","Room Seat Layout","Room"],
].map(([type,label,group]) => ({ type: type as ComponentType, label, group }));

function newNode(type: ComponentType, index: number): AppComponentNode {
  const label = COMPONENTS.find((x) => x.type === type)?.label ?? type;
  return { id: `${type}-${Date.now()}-${index}`, type, name: label, visible: true, locked: false, props: { label }, style: { width: "100%", minHeight: 64, padding: "12px", borderRadius: 14, background: "var(--card)" } };
}

function AppCustomizationStudio() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pageKey, setPageKey] = useState<AppPageKey>("home");
  const [config, setConfig] = useState<AppPageConfig>({ ...DEFAULT_APP_CONFIG, page: "home" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceKind>("mobile");
  const [history, setHistory] = useState<AppPageConfig[]>([]);
  const [future, setFuture] = useState<AppPageConfig[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => config.sections.find((x) => x.id === selectedId) ?? null, [config, selectedId]);
  const catalog = useMemo(() => COMPONENTS.filter((x) => x.label.toLowerCase().includes(search.toLowerCase())), [search]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("app_customization_pages").select("id,page_key,name,description,sort_order").eq("is_enabled", true).order("sort_order");
      if (error) { toast.error(error.message); setLoading(false); return; }
      const rows = (data ?? []) as PageRow[];
      setPages(rows);
      if (!rows.some((x) => x.page_key === pageKey) && rows[0]) setPageKey(rows[0].page_key);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const page = pages.find((x) => x.page_key === pageKey);
    if (!page) return;
    void (async () => {
      const { data, error } = await supabase.from("app_customization_versions").select("config").eq("page_id", page.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
      if (error) { toast.error(error.message); return; }
      setConfig(normalizePageConfig(data?.config, pageKey)); setSelectedId(null); setHistory([]); setFuture([]);
    })();
  }, [pageKey, pages]);

  function commit(next: AppPageConfig) { setHistory((h) => [...h.slice(-39), config]); setFuture([]); setConfig(next); }
  function add(type: ComponentType) { const node = newNode(type, config.sections.length); commit({ ...config, sections: [...config.sections, node] }); setSelectedId(node.id); }
  function updateNode(id: string, patch: Partial<AppComponentNode>) { commit({ ...config, sections: config.sections.map((x) => x.id === id ? { ...x, ...patch } : x) }); }
  function remove() { if (!selectedId) return; commit({ ...config, sections: config.sections.filter((x) => x.id !== selectedId) }); setSelectedId(null); }
  function undo() { const prev = history.at(-1); if (!prev) return; setHistory((h) => h.slice(0,-1)); setFuture((f) => [config, ...f]); setConfig(prev); }
  function redo() { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setHistory((h) => [...h, config]); setConfig(next); }

  async function saveDraft(showToast = true) {
    const page = pages.find((x) => x.page_key === pageKey); if (!page) return false;
    setSaving(true);
    const { data: draft, error: findError } = await supabase.from("app_customization_versions").select("id,version").eq("page_id", page.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
    if (findError) { toast.error(findError.message); setSaving(false); return false; }
    let error;
    if (draft?.id) ({ error } = await supabase.from("app_customization_versions").update({ config }).eq("id", draft.id));
    else ({ error } = await supabase.from("app_customization_versions").insert({ page_id: page.id, version: (draft?.version ?? 0) + 1, status: "draft", config }));
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    if (showToast) toast.success(`${page.name} draft saved`);
    return true;
  }

  async function publish() {
    const page = pages.find((x) => x.page_key === pageKey); if (!page) return;
    if (!(await saveDraft(false))) return;
    setSaving(true);
    const { data: latest, error: latestError } = await supabase.from("app_customization_versions").select("version").eq("page_id", page.id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latestError) { toast.error(latestError.message); setSaving(false); return; }
    const version = (latest?.version ?? 0) + 1;
    const { data: publishedVersion, error: versionError } = await supabase.from("app_customization_versions").insert({ page_id: page.id, version, status: "published", config, published_at: new Date().toISOString() }).select("id").single();
    if (versionError || !publishedVersion) { toast.error(versionError?.message ?? "Publish failed"); setSaving(false); return; }
    const { error: clearError } = await supabase.from("app_customization_published").update({ is_current: false }).eq("page_id", page.id).eq("is_current", true);
    if (clearError) { toast.error(clearError.message); setSaving(false); return; }
    const { error: pubError } = await supabase.from("app_customization_published").insert({ page_id: page.id, version_id: publishedVersion.id, config, version, published_at: new Date().toISOString(), is_current: true });
    setSaving(false);
    if (pubError) toast.error(pubError.message); else toast.success(`${page.name} published successfully`);
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground">Loading App Studio…</div>;

  return <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
    <div className="border-b border-border bg-background px-4 py-3 md:px-6">
      <AdminPageHeader title="App Studio" subtitle="Customize the app visually. Save drafts, preview layouts, and publish page-by-page without changing business logic." right={<div className="flex flex-wrap gap-2"><button className="rounded-lg border p-2 disabled:opacity-40" onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4" /></button><button className="rounded-lg border p-2 disabled:opacity-40" onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4" /></button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => toast.info("The canvas is your live draft preview.")}><Eye className="mr-1 inline h-4 w-4" />Preview</button><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" onClick={() => void saveDraft()} disabled={saving}><Save className="mr-1 inline h-4 w-4" />Save Draft</button><button className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void publish()} disabled={saving}><Upload className="mr-1 inline h-4 w-4" />Publish</button></div>} />
      <div className="flex gap-2">{(["mobile","tablet","desktop"] as DeviceKind[]).map((x) => <button key={x} onClick={() => setDevice(x)} className={`rounded-full px-3 py-1.5 text-xs ${device === x ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{x === "mobile" ? <Smartphone className="mr-1 inline h-3.5 w-3.5" /> : x === "tablet" ? <Tablet className="mr-1 inline h-3.5 w-3.5" /> : <Monitor className="mr-1 inline h-3.5 w-3.5" />}{x}</button>)}</div>
    </div>
    <div className="grid min-h-[calc(100vh-190px)] grid-cols-1 lg:grid-cols-[260px_minmax(420px,1fr)_300px]">
      <aside className="border-b border-border bg-background p-3 lg:border-b-0 lg:border-r"><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pages</p><div className="space-y-1">{pages.map((p) => <button key={p.page_key} onClick={() => setPageKey(p.page_key)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${p.page_key === pageKey ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>{p.name}</button>)}</div><div className="mt-5 border-t pt-4"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Components</p><div className="relative mt-2"><Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full rounded-lg border bg-background py-2 pl-7 pr-2 text-xs" /></div><div className="mt-2 max-h-[50vh] space-y-1 overflow-y-auto">{catalog.map((x) => <button key={x.type} onClick={() => add(x.type)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-muted"><Box className="h-3.5 w-3.5" />{x.label}<span className="ml-auto text-[9px] text-muted-foreground">{x.group}</span></button>)}</div></div></aside>
      <section className="overflow-auto bg-muted/30 p-4 md:p-8"><div className="mx-auto" style={{ width: device === "mobile" ? 390 : device === "tablet" ? 768 : "100%", maxWidth: "100%" }}><div className="mb-2 flex justify-between text-[10px] text-muted-foreground"><span>{pageKey}</span><span>{device}</span></div><div className="min-h-[720px] rounded-[28px] border-2 border-dashed border-border bg-background p-4 shadow-xl" onClick={() => setSelectedId(null)}>{config.sections.length === 0 ? <div className="grid min-h-[650px] place-items-center text-center text-muted-foreground"><div><Layers3 className="mx-auto mb-3 h-9 w-9" /><p className="text-sm font-semibold">Start customizing this page</p><p className="mt-1 text-xs">Choose components from the left panel.</p></div></div> : <div className="space-y-3">{config.sections.map((node) => <button key={node.id} disabled={node.locked} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`relative w-full text-left transition ${selectedId === node.id ? "ring-2 ring-primary ring-offset-2" : ""} ${node.visible === false ? "opacity-30" : ""}`} style={{ ...node.style, ...(node.responsive?.[device] ?? {}) }}><span className="font-medium">{String(node.props?.label ?? node.name ?? node.type)}</span><span className="absolute right-2 top-2 text-[9px] opacity-50">{node.type}</span></button>)}</div>}</div></div></section>
      <aside className="border-t border-border bg-background p-4 lg:border-l lg:border-t-0"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Palette className="h-4 w-4" />Properties</div>{selected ? <PropertyEditor node={selected} onChange={(patch) => updateNode(selected.id, patch)} onDelete={remove} /> : <div className="rounded-xl border p-4 text-xs text-muted-foreground">Select an element on the canvas to edit its text, size, colors, spacing, visibility, and lock state.</div>}</aside>
    </div>
  </div>;
}

function PropertyEditor({ node, onChange, onDelete }: { node: AppComponentNode; onChange: (patch: Partial<AppComponentNode>) => void; onDelete: () => void }) {
  const style = node.style ?? {};
  const setStyle = (patch: AppComponentNode["style"]) => onChange({ style: { ...style, ...patch } });
  return <div className="space-y-3 text-xs"><div className="flex items-center justify-between"><div><p className="font-semibold">{node.name}</p><p className="text-[10px] text-muted-foreground">{node.type}</p></div><button className="rounded border p-1.5" onClick={() => onChange({ locked: !node.locked })}>{node.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button></div><label className="block">Name<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={node.name ?? ""} onChange={(e) => onChange({ name: e.target.value })} /></label><label className="block">Text / Label<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={String(node.props?.label ?? "")} onChange={(e) => onChange({ props: { ...node.props, label: e.target.value } })} /></label><div className="grid grid-cols-2 gap-2"><label>Width<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.width ?? "")} onChange={(e) => setStyle({ width: e.target.value })} /></label><label>Height<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.minHeight ?? "")} onChange={(e) => setStyle({ minHeight: e.target.value })} /></label></div><label className="block">Background<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={String(style.background ?? "")} onChange={(e) => setStyle({ background: e.target.value })} /></label><div className="grid grid-cols-2 gap-2"><label>Text color<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.color ?? "")} onChange={(e) => setStyle({ color: e.target.value })} /></label><label>Radius<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.borderRadius ?? "")} onChange={(e) => setStyle({ borderRadius: e.target.value })} /></label></div><label className="block">Padding<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={String(style.padding ?? "")} onChange={(e) => setStyle({ padding: e.target.value })} /></label><label className="flex items-center justify-between rounded-lg border px-3 py-2">Visible<input type="checkbox" checked={node.visible !== false} onChange={(e) => onChange({ visible: e.target.checked })} /></label><button onClick={onDelete} className="w-full rounded-lg border border-destructive/40 px-3 py-2 text-destructive"><Trash2 className="mr-1 inline h-4 w-4" />Delete element</button></div>;
}
