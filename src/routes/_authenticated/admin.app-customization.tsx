import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { toast } from 'sonner';
import {
  Archive, Box, ChevronDown, ChevronRight, Copy, Download, Eye, FileJson, ImagePlus,
  Layers3, Lock, Monitor, Palette, Plus, Redo2, Save, Search, Smartphone, Sparkles,
  Tablet, Trash2, Undo2, Unlock, Upload, Wand2, X
} from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomizationStudio });

type Device = 'mobile' | 'tablet' | 'desktop';
type Tab = 'pages' | 'components' | 'sections' | 'assets' | 'themes' | 'navigation' | 'layouts' | 'versions' | 'settings';
type Node = {
  id: string;
  type: string;
  name: string;
  visible: boolean;
  locked: boolean;
  props: Record<string, any>;
  style: Record<string, any>;
  responsive?: Record<string, Record<string, any>>;
  conditions?: any[];
  actions?: Record<string, any>;
};
type PageConfig = {
  page: string;
  theme: Record<string, any>;
  navigation: Record<string, any>;
  sections: Node[];
  settings: Record<string, any>;
};
type Page = { id: string; page_key: string; name: string; description: string | null; route_pattern: string; is_enabled: boolean; sort_order: number };
type Version = { id: string; version: number; status: string; config: PageConfig; created_at: string; updated_at: string };

const PAGE_FALLBACKS = [
  ['home', 'Home Page'], ['discover', 'Discover Page'], ['live', 'Live Page'], ['voice-room', 'Voice Room'],
  ['video-room', 'Video Room'], ['pk-battle', 'PK Battle'], ['profile', 'Profile'], ['wallet', 'Wallet'],
  ['recharge', 'Recharge'], ['gifts', 'Gifts'], ['ranking', 'Ranking'], ['chat', 'Chat'], ['messages', 'Messages'],
  ['notifications', 'Notifications'], ['settings', 'Settings'], ['login', 'Login'], ['register', 'Register'], ['splash', 'Splash Screen'],
];

const LIBRARY: Array<{ type: string; label: string; group: string }> = [
  ['section', 'Section', 'Layout'], ['container', 'Container', 'Layout'], ['grid', 'Grid', 'Layout'], ['columns', 'Columns', 'Layout'],
  ['spacer', 'Spacer', 'Layout'], ['divider', 'Divider', 'Layout'], ['text', 'Text', 'Basic'], ['heading', 'Heading', 'Basic'],
  ['image', 'Image', 'Basic'], ['button', 'Button', 'Basic'], ['card', 'Card', 'Basic'], ['banner', 'Banner', 'Basic'],
  ['carousel', 'Carousel', 'Basic'], ['tabs', 'Tabs', 'Basic'], ['modal', 'Popup / Modal', 'Overlay'], ['drawer', 'Drawer', 'Overlay'],
  ['header', 'Header', 'Navigation'], ['bottom-navigation', 'Bottom Navigation', 'Navigation'], ['menu', 'Menu', 'Navigation'],
  ['user-profile-card', 'Profile Card', 'Jalwa'], ['live-room-card', 'Live Room Card', 'Jalwa'], ['voice-room-card', 'Voice Room Card', 'Jalwa'],
  ['video-room-card', 'Video Room Card', 'Jalwa'], ['pk-battle-card', 'PK Battle Card', 'Jalwa'], ['gift-grid', 'Gift Grid', 'Jalwa'],
  ['coin-balance', 'Coin Balance', 'Jalwa'], ['diamond-balance', 'Diamond Balance', 'Jalwa'], ['ranking-list', 'Ranking List', 'Jalwa'],
  ['leaderboard', 'Leaderboard', 'Jalwa'], ['vip-badge', 'VIP Badge', 'Jalwa'], ['level-progress', 'Level Progress', 'Jalwa'],
  ['friend-list', 'Friend List', 'Jalwa'], ['chat-list', 'Chat List', 'Jalwa'], ['notification-list', 'Notification List', 'Jalwa'],
  ['room-seat-layout', 'Room Seat Layout', 'Room'], ['room-header', 'Room Header', 'Room'], ['room-chat', 'Room Chat', 'Room'],
  ['room-gifts', 'Room Gifts', 'Room'], ['room-toolbar', 'Room Toolbar', 'Room'], ['pk-score', 'PK Score', 'Room'], ['pk-timer', 'PK Timer', 'Room'],
  ['form', 'Form', 'Forms'], ['input', 'Input', 'Forms'], ['search', 'Search', 'Forms'], ['toast', 'Toast', 'Overlay'],
  ['animation', 'Animation Wrapper', 'Effects'], ['custom-css', 'Custom Style', 'Advanced'],
];

function emptyConfig(page: string): PageConfig {
  return { page, theme: { primary: '#d4af37', background: '#0b0b0f', card: '#15151b', text: '#ffffff', muted: '#a1a1aa', radius: 14, fontFamily: 'Inter' }, navigation: { header: true, bottomNavigation: true, items: [] }, sections: [], settings: { title: '', description: '', seoTitle: '', seoDescription: '', backgroundImage: '' } };
}

function node(type: string, index: number): Node {
  const label = LIBRARY.find((x) => x[0] === type)?.[1] ?? type;
  return {
    id: `${type}-${Date.now()}-${index}`, type, name: label, visible: true, locked: false,
    props: { text: label, image: '', href: '', variant: 'default' },
    style: { width: '100%', minHeight: type === 'spacer' ? 24 : 72, padding: 16, margin: 0, background: 'var(--builder-card)', color: 'var(--builder-text)', borderRadius: 14, borderWidth: 0, opacity: 1, rotate: 0, scale: 1, shadow: 'none', align: 'left' },
    responsive: {}, conditions: [], actions: {},
  };
}

function AppCustomizationStudio() {
  const [pages, setPages] = useState<Page[]>([]);
  const [pageKey, setPageKey] = useState('home');
  const [config, setConfig] = useState<PageConfig>(emptyConfig('home'));
  const [history, setHistory] = useState<PageConfig[]>([]);
  const [future, setFuture] = useState<PageConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pages');
  const [device, setDevice] = useState<Device>('mobile');
  const [query, setQuery] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [assetUrl, setAssetUrl] = useState('');
  const [versionName, setVersionName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const selected = config.sections.find((x) => x.id === selectedId) ?? null;
  const filteredLibrary = useMemo(() => LIBRARY.filter((x) => `${x[1]} ${x[2]}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => { void loadPages(); }, []);
  useEffect(() => { if (pages.length) void loadPage(pageKey); }, [pageKey, pages]);

  async function loadPages() {
    setLoading(true);
    const { data, error } = await supabase.from('app_customization_pages').select('id,page_key,name,description,route_pattern,is_enabled,sort_order').order('sort_order');
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as Page[];
    if (!rows.length) {
      setPages(PAGE_FALLBACKS.map(([key, name], i) => ({ id: '', page_key: key, name, description: null, route_pattern: `/${key}`, is_enabled: true, sort_order: i })));
    } else {
      setPages(rows);
      if (!rows.some((p) => p.page_key === pageKey)) setPageKey(rows[0].page_key);
    }
    setLoading(false);
  }

  async function loadPage(key: string) {
    const page = pages.find((p) => p.page_key === key);
    if (!page?.id) { setConfig(emptyConfig(key)); setVersions([]); return; }
    const { data, error } = await supabase.from('app_customization_drafts').select('config').eq('page_id', page.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { toast.error(error.message); return; }
    setConfig((data?.config as PageConfig) ?? emptyConfig(key));
    setSelectedId(null); setHistory([]); setFuture([]);
    const { data: historyRows } = await supabase.from('app_customization_versions').select('id,version,status,config,created_at,updated_at').eq('page_id', page.id).order('version', { ascending: false }).limit(30);
    setVersions((historyRows ?? []) as Version[]);
  }

  function commit(next: PageConfig) { setHistory((h) => [...h.slice(-49), config]); setFuture([]); setConfig(next); }

  function add(type: string) { const n = node(type, config.sections.length); commit({ ...config, sections: [...config.sections, n] }); setSelectedId(n.id); }
  function update(id: string, patch: Partial<Node>) { commit({ ...config, sections: config.sections.map((n) => n.id === id ? { ...n, ...patch } : n) }); }
  function updateStyle(id: string, key: string, value: any) { const n = config.sections.find((x) => x.id === id); if (!n) return; update(id, { style: { ...n.style, [key]: value } }); }
  function remove() { if (!selectedId) return; commit({ ...config, sections: config.sections.filter((n) => n.id !== selectedId) }); setSelectedId(null); }
  function duplicate() { if (!selected) return; const copy = { ...selected, id: `${selected.type}-${Date.now()}`, name: `${selected.name} Copy` }; commit({ ...config, sections: [...config.sections, copy] }); setSelectedId(copy.id); }
  function undo() { const p = history.at(-1); if (!p) return; setHistory((h) => h.slice(0, -1)); setFuture((f) => [config, ...f]); setConfig(p); }
  function redo() { const n = future[0]; if (!n) return; setFuture((f) => f.slice(1)); setHistory((h) => [...h, config]); setConfig(n); }

  async function saveDraft() {
    const page = pages.find((p) => p.page_key === pageKey);
    if (!page?.id) { toast.error('This page is not seeded in the customization database yet.'); return; }
    setSaving(true);
    const { data: existing } = await supabase.from('app_customization_drafts').select('id').eq('page_id', page.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    let error: any = null;
    if (existing?.id) ({ error } = await supabase.from('app_customization_drafts').update({ config, name: versionName || `${page.name} Draft` }).eq('id', existing.id));
    else ({ error } = await supabase.from('app_customization_drafts').insert({ page_id: page.id, config, name: versionName || `${page.name} Draft`, created_by: (await supabase.auth.getUser()).data.user?.id }));
    if (error) toast.error(error.message); else toast.success(`${page.name} draft saved — user app unchanged`);
    setSaving(false); await loadPage(pageKey);
  }

  async function publishConfig() {
    const page = pages.find((p) => p.page_key === pageKey);
    if (!page?.id) { toast.error('This page is not seeded in the customization database yet.'); return; }
    const user = (await supabase.auth.getUser()).data.user;
    const latest = versions[0]?.version ?? 0;
    const { data: version, error } = await supabase.from('app_customization_versions').insert({ page_id: page.id, version: latest + 1, status: 'published', config, created_by: user?.id }).select('id').single();
    if (error) { toast.error(error.message); return; }
    const { error: pubError } = await supabase.from('app_customization_published').upsert({ page_id: page.id, version_id: version.id, config, published_by: user?.id, notes: 'Admin Studio publish; not connected to user app in this phase.' }, { onConflict: 'page_id' });
    if (pubError) { toast.error(pubError.message); return; }
    toast.success(`${page.name} published to customization storage only`); await loadPage(pageKey);
  }

  async function duplicateVersion(v: Version) {
    const page = pages.find((p) => p.page_key === pageKey); if (!page?.id) return;
    const user = (await supabase.auth.getUser()).data.user;
    const next = Math.max(...versions.map((x) => x.version), 0) + 1;
    const { error } = await supabase.from('app_customization_versions').insert({ page_id: page.id, version: next, status: 'draft', config: v.config, created_by: user?.id });
    if (error) toast.error(error.message); else toast.success(`Version ${v.version} duplicated as draft`);
    await loadPage(pageKey);
  }

  async function archiveVersion(v: Version) {
    const { error } = await supabase.from('app_customization_versions').update({ status: 'archived' }).eq('id', v.id);
    if (error) toast.error(error.message); else toast.success(`Version ${v.version} archived`); await loadPage(pageKey);
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${pageKey}-customization.json`; a.click(); URL.revokeObjectURL(url);
  }

  function importConfig(file?: File) {
    if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const next = JSON.parse(String(reader.result)); commit({ ...emptyConfig(pageKey), ...next, page: pageKey }); toast.success('Configuration imported into draft canvas'); } catch { toast.error('Invalid customization JSON'); } }; reader.readAsText(file);
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground">Loading Admin Customization Studio…</div>;

  const page = pages.find((p) => p.page_key === pageKey);
  const previewWidth = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1180;

  return (
    <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
      <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <AdminPageHeader title="App Customization Studio" subtitle="Admin-only Wix-style builder. Drafts and published configurations stay isolated from the user app." right={
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border px-2.5 py-2" onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4" /></button>
            <button className="rounded-lg border px-2.5 py-2" onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4" /></button>
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setPreview(true)}><Eye className="mr-1 inline h-4 w-4" />Preview</button>
            <button className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={saveDraft} disabled={saving}><Save className="mr-1 inline h-4 w-4" />{saving ? 'Saving…' : 'Save Draft'}</button>
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={publishConfig}><Upload className="mr-1 inline h-4 w-4" />Publish</button>
          </div>
        } />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['mobile','tablet','desktop'] as Device[]).map((d) => <button key={d} onClick={() => setDevice(d)} className={`rounded-full px-3 py-1.5 text-xs ${device === d ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{d === 'mobile' ? <Smartphone className="mr-1 inline h-3.5 w-3.5" /> : d === 'tablet' ? <Tablet className="mr-1 inline h-3.5 w-3.5" /> : <Monitor className="mr-1 inline h-3.5 w-3.5" />}{d}</button>)}
          <input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Draft/version name" className="ml-auto rounded-lg border bg-background px-3 py-1.5 text-xs" />
          <button className="rounded-lg border p-2" onClick={exportConfig} title="Export"><Download className="h-4 w-4" /></button>
          <button className="rounded-lg border p-2" onClick={() => importRef.current?.click()} title="Import"><FileJson className="h-4 w-4" /></button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => importConfig(e.target.files?.[0])} />
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 lg:grid-cols-[250px_minmax(480px,1fr)_330px]">
        <aside className="border-b bg-background p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(['pages','components','sections','assets','themes','navigation','layouts','versions','settings'] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-2 py-2 text-[10px] font-semibold capitalize ${tab === t ? 'bg-background shadow' : 'text-muted-foreground'}`}>{t}</button>)}
          </div>

          {tab === 'pages' && <div className="space-y-1">{pages.map((p) => <button key={p.page_key} onClick={() => setPageKey(p.page_key)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${p.page_key === pageKey ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}><span>{p.name}</span><ChevronRight className="h-3.5 w-3.5" /></button>)}</div>}

          {tab === 'components' && <div><div className="relative mb-2"><Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search components" className="w-full rounded-lg border py-2 pl-7 pr-2 text-xs" /></div><div className="max-h-[62vh] space-y-1 overflow-y-auto">{filteredLibrary.map(([type,label,group]) => <button key={type} onClick={() => add(type)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-muted"><Box className="h-3.5 w-3.5" />{label}<span className="ml-auto text-[9px] text-muted-foreground">{group}</span></button>)}</div></div>}

          {tab === 'sections' && <div className="space-y-2"><button onClick={() => add('section')} className="w-full rounded-lg border px-3 py-2 text-sm"><Plus className="mr-1 inline h-4 w-4" />Add Section</button>{config.sections.filter((n) => ['section','container','grid','columns'].includes(n.type)).map((n) => <div key={n.id} className="rounded-lg border p-2 text-xs">{n.name}<div className="mt-2 flex gap-1"><button onClick={() => setSelectedId(n.id)} className="rounded border px-2 py-1">Edit</button><button onClick={() => update(n.id,{visible:!n.visible})} className="rounded border px-2 py-1">{n.visible?'Hide':'Show'}</button></div></div>)}</div>}

          {tab === 'assets' && <div className="space-y-3"><div className="rounded-xl border p-3 text-xs"><ImagePlus className="mb-2 h-5 w-5" /><b>Admin Asset Library</b><p className="mt-1 text-muted-foreground">Store asset references in the customization workspace only.</p></div><input value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} placeholder="Image / video URL" className="w-full rounded-lg border px-3 py-2 text-xs" /><button onClick={() => { if (assetUrl) { setConfig((c) => ({...c, settings:{...c.settings, lastAsset:assetUrl}})); setAssetUrl(''); toast.success('Asset reference added to draft'); } }} className="w-full rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">Add Asset Reference</button></div>}

          {tab === 'themes' && <ThemePanel config={config} setConfig={(c) => commit(c)} />}
          {tab === 'navigation' && <NavigationPanel config={config} setConfig={(c) => commit(c)} />}
          {tab === 'layouts' && <LayoutPanel config={config} setConfig={(c) => commit(c)} />}
          {tab === 'versions' && <VersionPanel versions={versions} onDuplicate={duplicateVersion} onArchive={archiveVersion} onRestore={(v) => { commit(v.config); toast.success(`Version ${v.version} loaded into draft canvas`); }} />}
          {tab === 'settings' && <SettingsPanel config={config} setConfig={(c) => commit(c)} />}
        </aside>

        <main className="overflow-auto bg-[#09090b] p-4 md:p-8">
          <div className="mx-auto transition-all" style={{ width: Math.min(previewWidth, 1180), maxWidth: '100%' }}>
            <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-400"><span>{page?.name ?? pageKey} • ADMIN PREVIEW ONLY</span><span>{device} • {config.sections.length} elements</span></div>
            <div className="min-h-[760px] overflow-hidden rounded-[28px] border border-zinc-700 bg-[var(--builder-bg)] shadow-2xl" style={{ ['--builder-bg' as any]: config.theme.background, ['--builder-card' as any]: config.theme.card, ['--builder-text' as any]: config.theme.text, color: config.theme.text }} onClick={() => setSelectedId(null)}>
              {config.sections.length === 0 ? <BuilderEmptyState page={page?.name ?? pageKey} onAdd={() => setTab('components')} /> : <div className="space-y-3 p-4 md:p-6">{config.sections.map((n) => <BuilderNode key={n.id} node={n} selected={n.id === selectedId} device={device} onSelect={() => setSelectedId(n.id)} />)}</div>}
            </div>
          </div>
        </main>

        <aside className="border-t bg-background p-4 lg:border-l lg:border-t-0">
          <Properties node={selected} device={device} onUpdate={(patch) => selected && update(selected.id, patch)} onStyle={(key,value) => selected && updateStyle(selected.id,key,value)} onDelete={remove} onDuplicate={duplicate} />
        </aside>
      </div>

      {preview && <div className="fixed inset-0 z-50 bg-black/80 p-4 md:p-8"><div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-background"><div className="flex items-center justify-between border-b p-3"><div><b>Admin Preview</b><span className="ml-2 text-xs text-muted-foreground">No user app changes are made by this preview.</span></div><button onClick={() => setPreview(false)} className="rounded-lg border p-2"><X className="h-4 w-4" /></button></div><div className="flex-1 overflow-auto bg-zinc-950 p-6"><div className="mx-auto" style={{width:Math.min(previewWidth,1180),maxWidth:'100%'}}><div className="space-y-3 rounded-3xl p-5" style={{background:config.theme.background,color:config.theme.text}}>{config.sections.filter(n=>n.visible).map(n=><BuilderNode key={n.id} node={n} selected={false} device={device} onSelect={()=>undefined}/>)}</div></div></div></div></div>}
    </div>
  );
}

function BuilderEmptyState({ page, onAdd }: { page: string; onAdd: () => void }) {
  return <div className="grid min-h-[720px] place-items-center p-8 text-center"><div className="max-w-sm"><Wand2 className="mx-auto mb-4 h-12 w-12 text-yellow-400" /><h2 className="text-xl font-bold">Build {page}</h2><p className="mt-2 text-sm text-zinc-400">This is an isolated Admin Studio canvas. Add sections and components, style them, preview them, save drafts and publish configuration versions without changing the user app.</p><button onClick={onAdd} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"><Plus className="mr-1 inline h-4 w-4" />Open Component Library</button></div></div>;
}

function BuilderNode({ node, selected, device, onSelect }: { node: Node; selected: boolean; device: Device; onSelect: () => void }) {
  const responsive = node.responsive?.[device] ?? {};
  const style: any = { ...node.style, ...responsive, opacity: node.visible ? node.style.opacity ?? 1 : 0.3, transform: `rotate(${node.style.rotate ?? 0}deg) scale(${node.style.scale ?? 1})`, textAlign: node.style.align ?? 'left', background: node.style.background === 'var(--builder-card)' ? 'rgba(255,255,255,.06)' : node.style.background, color: node.style.color === 'var(--builder-text)' ? 'inherit' : node.style.color };
  return <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(); }} className={`relative block w-full text-left transition ${selected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-950' : ''}`} style={style} disabled={node.locked}><div className="flex items-center gap-2"><span className="text-xs font-semibold">{node.props.text || node.name}</span>{node.locked && <Lock className="h-3 w-3 opacity-60" />}</div><span className="absolute right-2 top-2 text-[9px] opacity-50">{node.type}</span></button>;
}

function Properties({ node, device, onUpdate, onStyle, onDelete, onDuplicate }: { node: Node | null; device: Device; onUpdate: (p: Partial<Node>) => void; onStyle: (k:string,v:any)=>void; onDelete:()=>void; onDuplicate:()=>void }) {
  if (!node) return <div className="space-y-3 text-xs text-muted-foreground"><div className="rounded-xl border p-4"><Layers3 className="mb-2 h-5 w-5" /><b className="text-foreground">Properties</b><p className="mt-1">Select any element in the Admin canvas to edit its properties.</p></div><div className="rounded-xl border p-4"><Sparkles className="mb-2 h-5 w-5" /><b className="text-foreground">Presentation only</b><p className="mt-1">Nothing in this editor writes to the user-facing app.</p></div></div>;
  const field = (label:string,key:string,placeholder='') => <label className="block"><span className="mb-1 block text-[11px] font-medium">{label}</span><input value={node.style[key] ?? ''} onChange={e=>onStyle(key,e.target.value)} placeholder={placeholder} className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs" /></label>;
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><div className="text-sm font-bold">{node.name}</div><div className="text-[10px] text-muted-foreground">{node.type} • {device}</div></div><div className="flex gap-1"><button onClick={onDuplicate} className="rounded border p-1.5"><Copy className="h-3.5 w-3.5" /></button><button onClick={onDelete} className="rounded border p-1.5 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></div></div>
    <section className="space-y-2 rounded-xl border p-3"><b className="text-xs">Content</b><input value={node.props.text ?? ''} onChange={e=>onUpdate({props:{...node.props,text:e.target.value}})} placeholder="Text / label" className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs" /><input value={node.props.image ?? ''} onChange={e=>onUpdate({props:{...node.props,image:e.target.value}})} placeholder="Image URL" className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs" /><input value={node.props.href ?? ''} onChange={e=>onUpdate({props:{...node.props,href:e.target.value}})} placeholder="Action / link" className="w-full rounded-lg border bg-background px-2.5 py-2 text-xs" /></section>
    <section className="space-y-2 rounded-xl border p-3"><b className="text-xs">Layout</b>{field('Width','width','100%')}{field('Min Height','minHeight','72px')}{field('Padding','padding','16px')}{field('Margin','margin','0')}</section>
    <section className="space-y-2 rounded-xl border p-3"><b className="text-xs">Style</b>{field('Background','background','#15151b')}{field('Text Color','color','#ffffff')}{field('Border Radius','borderRadius','14px')}{field('Shadow','shadow','none')}{field('Opacity','opacity','1')}{field('Rotation','rotate','0')}{field('Scale','scale','1')}{field('Alignment','align','left')}</section>
    <section className="grid grid-cols-2 gap-2 rounded-xl border p-3"><button onClick={()=>onUpdate({visible:!node.visible})} className="rounded-lg border px-2 py-2 text-xs">{node.visible?'Hide':'Show'}</button><button onClick={()=>onUpdate({locked:!node.locked})} className="rounded-lg border px-2 py-2 text-xs">{node.locked?<Unlock className="mr-1 inline h-3.5 w-3.5"/>:<Lock className="mr-1 inline h-3.5 w-3.5"/>}{node.locked?'Unlock':'Lock'}</button></section>
    <section className="rounded-xl border p-3"><b className="text-xs">Responsive</b><p className="mt-1 text-[10px] text-muted-foreground">Changes can be stored per mobile/tablet/desktop breakpoint.</p></section>
    <section className="rounded-xl border p-3"><b className="text-xs">Conditions & Actions</b><p className="mt-1 text-[10px] text-muted-foreground">Stored in the customization configuration for later controlled runtime integration.</p></section>
  </div>;
}

function ThemePanel({ config, setConfig }: { config:PageConfig; setConfig:(c:PageConfig)=>void }) { const t=config.theme; const update=(k:string,v:any)=>setConfig({...config,theme:{...t,[k]:v}}); return <div className="space-y-3">{[['primary','Primary'],['background','Background'],['card','Card'],['text','Text'],['muted','Muted']].map(([k,l])=><label key={k} className="block text-xs"><span className="mb-1 block">{l}</span><input value={t[k]??''} onChange={e=>update(k,e.target.value)} className="w-full rounded-lg border px-2.5 py-2" /></label>)}<label className="block text-xs"><span className="mb-1 block">Font Family</span><input value={t.fontFamily??''} onChange={e=>update('fontFamily',e.target.value)} className="w-full rounded-lg border px-2.5 py-2" /></label></div>; }
function NavigationPanel({ config, setConfig }: { config:PageConfig; setConfig:(c:PageConfig)=>void }) { const n=config.navigation; return <div className="space-y-3 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={n.header!==false} onChange={e=>setConfig({...config,navigation:{...n,header:e.target.checked}})} />Header enabled</label><label className="flex items-center gap-2"><input type="checkbox" checked={n.bottomNavigation!==false} onChange={e=>setConfig({...config,navigation:{...n,bottomNavigation:e.target.checked}})} />Bottom navigation enabled</label><textarea value={JSON.stringify(n.items??[],null,2)} onChange={e=>{try{setConfig({...config,navigation:{...n,items:JSON.parse(e.target.value)}})}catch{}}} className="h-48 w-full rounded-lg border p-2 font-mono text-[10px]" /></div>; }
function LayoutPanel({ config, setConfig }: { config:PageConfig; setConfig:(c:PageConfig)=>void }) { return <div className="space-y-3 text-xs"><div className="rounded-lg border p-3">Global page layout</div><textarea value={JSON.stringify(config.settings.layout??{type:'stack',gap:12},null,2)} onChange={e=>{try{setConfig({...config,settings:{...config.settings,layout:JSON.parse(e.target.value)}})}catch{}}} className="h-56 w-full rounded-lg border p-2 font-mono text-[10px]" /><div className="rounded-lg border p-3 text-muted-foreground">Room layouts, responsive grids and section ordering are stored in the admin customization workspace.</div></div>; }
function SettingsPanel({ config, setConfig }: { config:PageConfig; setConfig:(c:PageConfig)=>void }) { const s=config.settings; const update=(k:string,v:any)=>setConfig({...config,settings:{...s,[k]:v}}); return <div className="space-y-3">{[['title','Page title'],['description','Description'],['seoTitle','SEO title'],['seoDescription','SEO description'],['backgroundImage','Background image URL']].map(([k,l])=><label key={k} className="block text-xs"><span className="mb-1 block">{l}</span><input value={s[k]??''} onChange={e=>update(k,e.target.value)} className="w-full rounded-lg border px-2.5 py-2" /></label>)}<div className="rounded-lg border p-3 text-[10px] text-muted-foreground">Advanced conditions, actions and animation definitions remain configuration-only in this phase.</div></div>; }
function VersionPanel({ versions, onDuplicate, onArchive, onRestore }: { versions:Version[]; onDuplicate:(v:Version)=>void; onArchive:(v:Version)=>void; onRestore:(v:Version)=>void }) { return <div className="space-y-2">{versions.length===0?<div className="rounded-lg border p-3 text-xs text-muted-foreground">No saved versions yet.</div>:versions.map(v=><div key={v.id} className="rounded-xl border p-3"><div className="flex items-center justify-between"><b className="text-xs">v{v.version}</b><span className="text-[10px] text-muted-foreground">{v.status}</span></div><div className="mt-2 flex flex-wrap gap-1"><button onClick={()=>onRestore(v)} className="rounded border px-2 py-1 text-[10px]">Restore to Draft</button><button onClick={()=>onDuplicate(v)} className="rounded border px-2 py-1 text-[10px]">Duplicate</button><button onClick={()=>onArchive(v)} className="rounded border px-2 py-1 text-[10px]">Archive</button></div></div>)}</div>; }
