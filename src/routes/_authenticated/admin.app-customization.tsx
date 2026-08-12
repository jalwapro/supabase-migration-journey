import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { normalizePageConfig, type AppComponentNode, type AppPageConfig, type AppPageKey, type ComponentType, DEFAULT_APP_CONFIG } from '@/lib/app-customization/schema';
import { toast } from 'sonner';
import { Monitor, Smartphone, Tablet, Undo2, Redo2, Save, Eye, Upload, Layers3, Box, ImagePlus, Navigation, Palette, Plus, Trash2, Lock, Unlock, ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomizationStudio });

type PageRow = { id: string; page_key: AppPageKey; name: string; description: string | null; route_pattern: string; is_enabled: boolean; sort_order: number };

const COMPONENTS: { type: ComponentType; label: string; group: string }[] = [
  { type: 'container', label: 'Container', group: 'Basic' },
  { type: 'text', label: 'Text', group: 'Basic' },
  { type: 'heading', label: 'Heading', group: 'Basic' },
  { type: 'image', label: 'Image', group: 'Basic' },
  { type: 'button', label: 'Button', group: 'Basic' },
  { type: 'card', label: 'Card', group: 'Basic' },
  { type: 'banner', label: 'Banner', group: 'Basic' },
  { type: 'carousel', label: 'Carousel', group: 'Basic' },
  { type: 'grid', label: 'Grid', group: 'Basic' },
  { type: 'tabs', label: 'Tabs', group: 'Basic' },
  { type: 'user-profile-card', label: 'User Profile Card', group: 'Jalwa' },
  { type: 'live-room-card', label: 'Live Room Card', group: 'Jalwa' },
  { type: 'voice-room-card', label: 'Voice Room Card', group: 'Jalwa' },
  { type: 'video-room-card', label: 'Video Room Card', group: 'Jalwa' },
  { type: 'pk-battle-card', label: 'PK Battle Card', group: 'Jalwa' },
  { type: 'gift-grid', label: 'Gift Grid', group: 'Jalwa' },
  { type: 'coin-balance', label: 'Coin Balance', group: 'Jalwa' },
  { type: 'diamond-balance', label: 'Diamond Balance', group: 'Jalwa' },
  { type: 'ranking-list', label: 'Ranking List', group: 'Jalwa' },
  { type: 'leaderboard', label: 'Leaderboard', group: 'Jalwa' },
  { type: 'vip-badge', label: 'VIP Badge', group: 'Jalwa' },
  { type: 'level-progress', label: 'Level Progress', group: 'Jalwa' },
  { type: 'friend-list', label: 'Friend List', group: 'Jalwa' },
  { type: 'chat-list', label: 'Chat List', group: 'Jalwa' },
  { type: 'notification-list', label: 'Notification List', group: 'Jalwa' },
  { type: 'room-seat-layout', label: 'Room Seat Layout', group: 'Room' },
  { type: 'header', label: 'Header', group: 'Navigation' },
  { type: 'bottom-navigation', label: 'Bottom Navigation', group: 'Navigation' },
];

function createNode(type: ComponentType, index: number): AppComponentNode {
  const label = COMPONENTS.find((item) => item.type === type)?.label ?? type;
  return { id: `${type}-${Date.now()}-${index}`, type, name: label, visible: true, locked: false, props: { label }, style: { width: '100%', minHeight: 64, padding: '12px', borderRadius: 12, background: 'var(--card)' } };
}

function AppCustomizationStudio() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pageKey, setPageKey] = useState<AppPageKey>('home');
  const [config, setConfig] = useState<AppPageConfig>({ ...DEFAULT_APP_CONFIG, page: 'home' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AppPageConfig[]>([]);
  const [future, setFuture] = useState<AppPageConfig[]>([]);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => config.sections.find((node) => node.id === selectedId) ?? null, [config, selectedId]);
  const visibleComponents = useMemo(() => COMPONENTS.filter((item) => item.label.toLowerCase().includes(search.toLowerCase())), [search]);

  async function loadPages() {
    setLoading(true);
    const { data, error } = await supabase.from('app_customization_pages').select('id,page_key,name,description,route_pattern,is_enabled,sort_order').order('sort_order');
    if (error) { toast.error(error.message); setLoading(false); return; }
    setPages((data ?? []) as PageRow[]);
    const initial = (data ?? []).find((row) => row.page_key === pageKey) ?? data?.[0];
    if (initial) setPageKey(initial.page_key as AppPageKey);
    setLoading(false);
  }

  async function loadPageConfig(key: AppPageKey) {
    const page = pages.find((item) => item.page_key === key);
    if (!page) return;
    const { data, error } = await supabase.from('app_customization_versions').select('config,status,version').eq('page_id', page.id).eq('status', 'draft').order('version', { ascending: false }).limit(1).maybeSingle();
    if (error) { toast.error(error.message); return; }
    const next = normalizePageConfig(data?.config, key);
    setConfig(next);
    setSelectedId(null);
    setHistory([]);
    setFuture([]);
  }

  useEffect(() => { void loadPages(); }, []);
  useEffect(() => { if (pages.length) void loadPageConfig(pageKey); }, [pageKey, pages]);

  function commit(next: AppPageConfig) {
    setHistory((items) => [...items.slice(-39), config]);
    setFuture([]);
    setConfig(next);
  }

  function updateNode(id: string, patch: Partial<AppComponentNode>) {
    commit({ ...config, sections: config.sections.map((node) => node.id === id ? { ...node, ...patch } : node) });
  }

  function addComponent(type: ComponentType) {
    const node = createNode(type, config.sections.length);
    commit({ ...config, sections: [...config.sections, node] });
    setSelectedId(node.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    commit({ ...config, sections: config.sections.filter((node) => node.id !== selectedId) });
    setSelectedId(null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [config, ...items]);
    setConfig(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, config]);
    setConfig(next);
  }

  async function saveDraft() {
    const page = pages.find((item) => item.page_key === pageKey);
    if (!page) return;
    setSaving(true);
    const { data: draft, error: draftError } = await supabase.from('app_customization_versions').select('id').eq('page_id', page.id).eq('status', 'draft').order('version', { ascending: false }).limit(1).maybeSingle();
    if (draftError) { toast.error(draftError.message); setSaving(false); return; }
    let error;
    if (draft?.id) {
      ({ error } = await supabase.from('app_customization_versions').update({ config }).eq('id', draft.id));
    } else {
      const { data: latest } = await supabase.from('app_customization_versions').select('version').eq('page_id', page.id).order('version', { ascending: false }).limit(1).maybeSingle();
      ({ error } = await supabase.from('app_customization_versions').insert({ page_id: page.id, version: (latest?.version ?? 0) + 1, status: 'draft', config }));
    }
    if (error) toast.error(error.message); else toast.success(`${page.name} draft saved`);
    setSaving(false);
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground">Loading App Customization Studio…</div>;

  return (
    <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
      <div className="border-b border-border bg-background px-4 py-3 md:px-6">
        <AdminPageHeader title="Jalwa App Builder" subtitle="Wix-style visual customization — presentation only, business logic stays protected." right={
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-lg border px-2.5 py-2 disabled:opacity-40" onClick={undo} disabled={!history.length} title="Undo"><Undo2 className="h-4 w-4" /></button>
            <button className="rounded-lg border px-2.5 py-2 disabled:opacity-40" onClick={redo} disabled={!future.length} title="Redo"><Redo2 className="h-4 w-4" /></button>
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => toast.info('Preview uses the current draft configuration.')}><Eye className="mr-1.5 inline h-4 w-4" />Preview</button>
            <button className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={saveDraft} disabled={saving}><Save className="mr-1.5 inline h-4 w-4" />{saving ? 'Saving…' : 'Save Draft'}</button>
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => toast.info('Publish is intentionally page-scoped; the next step wires this draft to the existing live renderer.')}><Upload className="mr-1.5 inline h-4 w-4" />Publish</button>
          </div>
        } />
        <div className="flex flex-wrap items-center gap-2">
          {(['mobile','tablet','desktop'] as const).map((item) => <button key={item} onClick={() => setDevice(item)} className={`rounded-full px-3 py-1.5 text-xs ${device === item ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>{item === 'mobile' ? <Smartphone className="mr-1 inline h-3.5 w-3.5" /> : item === 'tablet' ? <Tablet className="mr-1 inline h-3.5 w-3.5" /> : <Monitor className="mr-1 inline h-3.5 w-3.5" />}{item}</button>)}
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-190px)] grid-cols-1 lg:grid-cols-[260px_minmax(420px,1fr)_300px]">
        <aside className="border-b border-border bg-background p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pages</span><button className="rounded-md border p-1.5" onClick={() => toast.info('Custom pages will use the same controlled schema.') }><Plus className="h-4 w-4" /></button></div>
          <div className="space-y-1">
            {pages.map((page) => <button key={page.page_key} onClick={() => setPageKey(page.page_key)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${page.page_key === pageKey ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}><span>{page.name}</span><ChevronRight className="h-3.5 w-3.5 opacity-50" /></button>)}
          </div>
          <div className="mt-6 border-t pt-4"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Components</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components…" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none" />
            <div className="mt-2 max-h-[48vh] space-y-1 overflow-y-auto">{visibleComponents.map((item) => <button key={item.type} onClick={() => addComponent(item.type)} className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs hover:border-border hover:bg-muted"><Box className="h-3.5 w-3.5" />{item.label}<span className="ml-auto text-[9px] text-muted-foreground">{item.group}</span></button>)}</div>
          </div>
        </aside>

        <section className="overflow-auto bg-muted/30 p-4 md:p-8">
          <div className="mx-auto" style={{ width: device === 'mobile' ? 390 : device === 'tablet' ? 768 : '100%', maxWidth: '100%' }}>
            <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{pageKey}</span><span>{device}</span></div>
            <div className="min-h-[720px] rounded-[28px] border-2 border-dashed border-border bg-background p-4 shadow-xl" onClick={() => setSelectedId(null)}>
              {config.sections.length === 0 ? <div className="grid min-h-[650px] place-items-center text-center text-sm text-muted-foreground"><div><Layers3 className="mx-auto mb-3 h-8 w-8" /><p>Start building this page</p><p className="mt-1 text-xs">Drag-style controls will be expanded around these real components.</p></div></div> : <div className="space-y-3">{config.sections.map((node) => <button key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`relative w-full text-left ${selectedId === node.id ? 'ring-2 ring-primary ring-offset-2' : ''} ${node.visible === false ? 'opacity-40' : ''}`} disabled={node.locked} style={{ ...node.style, ...(node.responsive?.[device] ?? {}) }}>{node.name ?? node.type}<span className="absolute right-2 top-2 text-[9px] opacity-50">{node.type}</span></button>)}</div>}
            </div>
          </div>
        </section>

        <aside className="border-t border-border bg-background p-4 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Palette className="h-4 w-4" />Properties</div>
          {!selected ? <div className="space-y-3 text-xs text-muted-foreground"><div className="rounded-xl border p-3"><Layers3 className="mb-2 h-5 w-5" /><p>Select an element in the canvas to edit its properties.</p></div><div className="rounded-xl border p-3"><Navigation className="mb-2 h-5 w-5" /><p>Page navigation and global theme controls will use the same configuration layer.</p></div><div className="rounded-xl border p-3"><ImagePlus className="mb-2 h-5 w-5" /><p>Asset manager will reuse the existing storage system.</p></div></div> : <PropertyEditor node={selected} onChange={(patch) => updateNode(selected.id, patch)} onDelete={removeSelected} />}
        </aside>
      </div>
    </div>
  );
}

function PropertyEditor({ node, onChange, onDelete }: { node: AppComponentNode; onChange: (patch: Partial<AppComponentNode>) => void; onDelete: () => void }) {
  const style = node.style ?? {};
  const setStyle = (patch: AppComponentNode['style']) => onChange({ style: { ...style, ...patch } });
  return <div className="space-y-4 text-xs">
    <div className="flex items-center justify-between"><div><p className="font-semibold">{node.name}</p><p className="text-[10px] text-muted-foreground">{node.type}</p></div><button className="rounded-md border p-1.5" onClick={() => onChange({ locked: !node.locked })}>{node.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button></div>
    <label className="block">Name<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={node.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} /></label>
    <label className="block">Text / Label<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={String(node.props?.label ?? '')} onChange={(e) => onChange({ props: { ...node.props, label: e.target.value } })} /></label>
    <div className="grid grid-cols-2 gap-2"><label>Width<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.width ?? '')} onChange={(e) => setStyle({ width: e.target.value })} /></label><label>Height<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.height ?? '')} onChange={(e) => setStyle({ height: e.target.value })} /></label></div>
    <label className="block">Background<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={String(style.background ?? '')} onChange={(e) => setStyle({ background: e.target.value })} /></label>
    <div className="grid grid-cols-2 gap-2"><label>Text color<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.color ?? '')} onChange={(e) => setStyle({ color: e.target.value })} /></label><label>Radius<input className="mt-1 w-full rounded-lg border px-2 py-2" value={String(style.borderRadius ?? '')} onChange={(e) => setStyle({ borderRadius: e.target.value })} /></label></div>
    <label className="block">Padding<input className="mt-1 w-full rounded-lg border px-2.5 py-2" value={String(style.padding ?? '')} onChange={(e) => setStyle({ padding: e.target.value })} /></label>
    <label className="flex items-center justify-between rounded-lg border px-3 py-2">Visible<input type="checkbox" checked={node.visible !== false} onChange={(e) => onChange({ visible: e.target.checked })} /></label>
    <button onClick={onDelete} className="w-full rounded-lg border border-destructive/40 px-3 py-2 text-destructive"><Trash2 className="mr-1.5 inline h-4 w-4" />Delete element</button>
  </div>;
}
