import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlignCenter, AlignLeft, AlignRight, Box, ChevronDown, ChevronRight, Copy, Download, Eye, FileJson, Grid3X3,
  Layers3, Monitor, Move, Plus, Redo2, Save, Search, Smartphone, Tablet, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut,
} from 'lucide-react';

type Device = 'mobile' | 'tablet' | 'desktop';
type ComponentType =
  | 'text' | 'heading' | 'button' | 'image' | 'video' | 'icon' | 'avatar' | 'card' | 'input' | 'search' | 'navbar'
  | 'bottom-navigation' | 'tabs' | 'modal' | 'popup' | 'banner' | 'list' | 'grid' | 'container' | 'section' | 'divider' | 'spacer';

type Rect = { x: number; y: number; width: number; height: number };
type Responsive = Partial<Record<Device, Partial<Rect & Record<string, string>>>>;
type BuilderComponent = {
  id: string; type: ComponentType; name: string; parentId: string | null; rect: Rect; props: Record<string, any>;
  styles: Record<string, string>; responsive: Responsive; visible: boolean; locked: boolean; zIndex: number;
};
type Page = { id: string; name: string; path: string; components: BuilderComponent[] };
type Project = { version: 1; pages: Page[]; activePageId: string; settings: { grid: number; snap: boolean; background: string } };

type Tool = { type: ComponentType; label: string; icon: string; defaultW: number; defaultH: number };
const TOOLS: Tool[] = [
  ['text','Text','T',160,42], ['heading','Heading','H',220,54], ['button','Button','B',150,48], ['image','Image','IMG',220,140],
  ['video','Video','▶',260,150], ['icon','Icon','★',56,56], ['avatar','Avatar','●',64,64], ['card','Card','▣',280,160],
  ['input','Input','⌨',240,48], ['search','Search','⌕',240,48], ['navbar','Navbar','≡',340,64], ['bottom-navigation','Bottom navigation','≡',340,64],
  ['tabs','Tabs','☰',300,48], ['modal','Modal','□',280,180], ['popup','Popup','□',240,140], ['banner','Banner','▰',340,120], ['list','List','☷',300,160],
  ['grid','Grid','▦',300,180], ['container','Container','◇',340,220], ['section','Section','▤',340,240], ['divider','Divider','—',300,4], ['spacer','Spacer','↕',300,32],
] as Tool[];

const [TEXT,HEADING,BUTTON,IMAGE,VIDEO,ICON,AVATAR,CARD,INPUT,SEARCH,NAVBAR,BOTTOM,TABS,MODAL,POPUP,BANNER,LIST,GRID,CONTAINER,SECTION,DIVIDER,SPACER] = TOOLS;

const makeId = (prefix = 'c') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function defaultProject(): Project {
  const homeId = makeId('page');
  return {
    version: 1,
    activePageId: homeId,
    settings: { grid: 8, snap: true, background: '#0b0b10' },
    pages: [{ id: homeId, name: 'Home', path: '/', components: [] }],
  };
}

function defaultProps(type: ComponentType): Record<string, any> {
  const map: Record<ComponentType, Record<string, any>> = {
    text: { text: 'Text' }, heading: { text: 'Heading' }, button: { text: 'Button' }, image: { src: '', alt: 'Image' },
    video: { src: '', poster: '' }, icon: { glyph: '★' }, avatar: { src: '', alt: 'Avatar' }, card: { text: 'Card content' },
    input: { placeholder: 'Enter text' }, search: { placeholder: 'Search...' }, navbar: { title: 'App', items: ['Home','Profile'] },
    'bottom-navigation': { items: ['Home','Rank','Create','Chat','Me'] }, tabs: { items: ['All','Live','Voice'] }, modal: { title: 'Modal', text: 'Modal content' },
    popup: { title: 'Popup', text: 'Popup content' }, banner: { text: 'Banner' }, list: { items: ['Item 1','Item 2','Item 3'] },
    grid: { items: ['1','2','3','4'] }, container: {}, section: {}, divider: {}, spacer: {},
  };
  return clone(map[type]);
}

function defaultStyles(type: ComponentType): Record<string, string> {
  const base: Record<string, string> = { color: '#f8fafc', background: 'transparent', border: '0px solid #334155', borderRadius: '12px', padding: '8px', opacity: '1', fontFamily: 'Inter, sans-serif', fontSize: type === 'heading' ? '24px' : '14px', fontWeight: type === 'heading' ? '700' : '400', lineHeight: '1.35', textAlign: 'left', boxShadow: 'none', overflow: 'hidden' };
  if (['button','input','search','tabs'].includes(type)) Object.assign(base, { background: '#ec008c', borderRadius: '10px', padding: '12px 16px' });
  if (['card','modal','popup','banner','navbar','bottom-navigation','container','section'].includes(type)) Object.assign(base, { background: '#17171f', border: '1px solid #2b2b38' });
  if (type === 'image' || type === 'video' || type === 'avatar') Object.assign(base, { background: '#272733' });
  return base;
}

function newComponent(type: ComponentType, x = 24, y = 24, parentId: string | null = null): BuilderComponent {
  const tool = TOOLS.find(t => t[0] === type)!;
  return { id: makeId(), type, name: tool[1], parentId, rect: { x, y, width: tool[3], height: tool[4] }, props: defaultProps(type), styles: defaultStyles(type), responsive: {}, visible: true, locked: false, zIndex: 1 };
}

function getPage(project: Project) { return project.pages.find(p => p.id === project.activePageId) ?? project.pages[0]; }
function updatePage(project: Project, updater: (page: Page) => Page): Project {
  return { ...project, pages: project.pages.map(p => p.id === project.activePageId ? updater(p) : p) };
}
function childrenOf(page: Page, parentId: string | null) { return page.components.filter(c => c.parentId === parentId).sort((a,b) => a.zIndex - b.zIndex); }

function renderComponent(c: BuilderComponent, preview = false) {
  const s: any = { ...c.styles, width: c.rect.width, height: c.rect.height, position: 'absolute', left: c.rect.x, top: c.rect.y, zIndex: c.zIndex, boxSizing: 'border-box', userSelect: preview ? 'auto' : 'none' };
  const text = c.props.text ?? '';
  const common = { style: s as React.CSSProperties };
  switch (c.type) {
    case 'text': return <div {...common}>{text}</div>;
    case 'heading': return <div {...common}>{text}</div>;
    case 'button': return <button {...common}>{text}</button>;
    case 'image': return c.props.src ? <img {...common} src={c.props.src} alt={c.props.alt} /> : <div {...common} className="flex items-center justify-center text-xs text-zinc-500">Image</div>;
    case 'video': return <div {...common} className="flex items-center justify-center text-xl">▶</div>;
    case 'icon': return <div {...common} className="flex items-center justify-center text-2xl">{c.props.glyph}</div>;
    case 'avatar': return c.props.src ? <img {...common} src={c.props.src} className="rounded-full object-cover" alt={c.props.alt} /> : <div {...common} className="flex items-center justify-center rounded-full bg-zinc-700">●</div>;
    case 'card': return <div {...common}>{text}</div>;
    case 'input': return <input {...common} placeholder={c.props.placeholder} />;
    case 'search': return <div {...common} className="flex items-center gap-2"><span>⌕</span><span className="opacity-60">{c.props.placeholder}</span></div>;
    case 'navbar': return <div {...common} className="flex items-center justify-between"><b>{c.props.title}</b><span>⋯</span></div>;
    case 'bottom-navigation': return <div {...common} className="flex items-center justify-around">{c.props.items.map((x:string)=><span key={x} className="text-xs">{x}</span>)}</div>;
    case 'tabs': return <div {...common} className="flex items-center justify-around">{c.props.items.map((x:string)=><span key={x}>{x}</span>)}</div>;
    case 'modal': return <div {...common}><b>{c.props.title}</b><div className="mt-2 text-sm opacity-70">{c.props.text}</div></div>;
    case 'popup': return <div {...common}><b>{c.props.title}</b><div className="mt-2 text-sm opacity-70">{c.props.text}</div></div>;
    case 'banner': return <div {...common} className="flex items-center justify-center text-center">{text}</div>;
    case 'list': return <div {...common}>{c.props.items.map((x:string,i:number)=><div key={i} className="border-b border-white/10 p-2">{x}</div>)}</div>;
    case 'grid': return <div {...common} className="grid grid-cols-2 gap-2">{c.props.items.map((x:string,i:number)=><div key={i} className="rounded bg-white/5 p-3 text-center">{x}</div>)}</div>;
    case 'divider': return <div {...common} className="bg-white/20" />;
    case 'spacer': return <div {...common} className="border border-dashed border-white/10" />;
    case 'container': return <div {...common} className="border border-dashed border-white/20" />;
    case 'section': return <div {...common} className="border border-dashed border-white/10" />;
    default: return <div {...common}>{text}</div>;
  }
}

export function AppBuilder() {
  const [project, setProject] = useState<Project>(() => defaultProject());
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [device, setDevice] = useState<Device>('mobile');
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(8);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origin: Rect } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origin: Rect } | null>(null);
  const [copied, setCopied] = useState<BuilderComponent[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const page = getPage(project);
  const canvasWidth = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1180;
  const canvasHeight = device === 'mobile' ? 780 : 760;
  const visibleTools = useMemo(() => TOOLS.filter(t => t[1].toLowerCase().includes(search.toLowerCase())), [search]);

  const commit = useCallback((next: Project) => { setHistory(h => [...h.slice(-49), clone(project)]); setFuture([]); setProject(next); }, [project]);
  const setPageComponents = (fn: (cs: BuilderComponent[]) => BuilderComponent[]) => commit(updatePage(project, p => ({ ...p, components: fn(p.components) })));
  const selectedComponents = page.components.filter(c => selected.includes(c.id));

  useEffect(() => { void loadProject(); }, []);
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { setCopied(selectedComponents.map(clone)); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selected.length) { e.preventDefault(); deleteSelected(); } }
      if (e.key === 'Escape') setSelected([]);
    };
    window.addEventListener('keydown', keyHandler); return () => window.removeEventListener('keydown', keyHandler);
  });
  useEffect(() => {
    if (!dragging && !resizing) return;
    const move = (e: PointerEvent) => {
      const state = dragging ?? resizing!; const dx = (e.clientX - state.startX) / zoom; const dy = (e.clientY - state.startY) / zoom;
      let nextRect = dragging ? { ...state.origin, x: state.origin.x + dx, y: state.origin.y + dy } : { ...state.origin, width: state.origin.width + dx, height: state.origin.height + dy };
      if (snap) { nextRect.x = Math.round(nextRect.x / grid) * grid; nextRect.y = Math.round(nextRect.y / grid) * grid; nextRect.width = Math.max(24, Math.round(nextRect.width / grid) * grid); nextRect.height = Math.max(12, Math.round(nextRect.height / grid) * grid); }
      nextRect.x = clamp(nextRect.x, 0, canvasWidth - 24); nextRect.y = clamp(nextRect.y, 0, canvasHeight - 12); nextRect.width = clamp(nextRect.width, 24, canvasWidth - nextRect.x); nextRect.height = clamp(nextRect.height, 12, canvasHeight - nextRect.y);
      setProject(current => updatePage(current, p => ({ ...p, components: p.components.map(c => c.id === state.id ? { ...c, rect: nextRect } : c) })));
    };
    const up = () => { setDragging(null); setResizing(null); setHistory(h => [...h.slice(-49), clone(project)]); setFuture([]); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dragging, resizing, zoom, snap, grid, canvasWidth, canvasHeight, project]);

  async function loadProject() {
    setLoading(true);
    try {
      const { data: pages } = await supabase.from('app_customization_pages').select('id,page_key,name,route_pattern').order('sort_order');
      const home = pages?.find((p:any) => p.page_key === 'home') ?? pages?.[0];
      if (home) {
        const { data: draft } = await supabase.from('app_customization_drafts').select('config').eq('page_id', home.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (draft?.config?.pages) setProject(draft.config as Project);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function saveProject() {
    setSaving(true);
    try {
      const { data: home } = await supabase.from('app_customization_pages').select('id').eq('page_key','home').maybeSingle();
      const user = (await supabase.auth.getUser()).data.user;
      if (!home?.id) throw new Error('Home customization page is missing');
      const { data: existing } = await supabase.from('app_customization_drafts').select('id').eq('page_id',home.id).eq('is_active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      const payload = { config: project, name: 'Visual Builder Draft', status: 'draft', created_by: user?.id, is_active: true };
      const result = existing?.id ? await supabase.from('app_customization_drafts').update({ config: project, name: payload.name, status: 'draft' }).eq('id',existing.id) : await supabase.from('app_customization_drafts').insert({ page_id: home.id, ...payload });
      if (result.error) throw result.error;
      toast.success('Project saved');
    } catch (e:any) { toast.error(e.message ?? 'Save failed'); }
    setSaving(false);
  }

  async function publishProject() {
    setSaving(true);
    try {
      const { data: home } = await supabase.from('app_customization_pages').select('id').eq('page_key','home').maybeSingle();
      const user = (await supabase.auth.getUser()).data.user;
      if (!home?.id) throw new Error('Home customization page is missing');
      const { data: last } = await supabase.from('app_customization_versions').select('version').eq('page_id',home.id).order('version',{ascending:false}).limit(1).maybeSingle();
      const version = Number(last?.version ?? 0) + 1;
      const { data: ver, error } = await supabase.from('app_customization_versions').insert({ page_id:home.id, version, status:'published', config:project, change_description:'Visual builder publish', created_by:user?.id, published_at:new Date().toISOString() }).select('id').single();
      if (error || !ver) throw error ?? new Error('Version failed');
      await supabase.from('app_customization_published').update({ is_current:false }).eq('page_id',home.id).eq('is_current',true);
      const { error: pe } = await supabase.from('app_customization_published').insert({ page_id:home.id, version_id:ver.id, config:project, version, published_by:user?.id, is_current:true, notes:'Visual builder publish' });
      if (pe) throw pe;
      toast.success('Project published');
    } catch (e:any) { toast.error(e.message ?? 'Publish failed'); }
    setSaving(false);
  }

  function add(type: ComponentType, x = 24, y = 24) { const c = newComponent(type, x, y, null); setPageComponents(cs => [...cs, c]); setSelected([c.id]); }
  function updateComponent(id:string, patch:Partial<BuilderComponent>) { setPageComponents(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c)); }
  function updateStyle(key:string, value:string) { if (!selected[0]) return; updateComponent(selected[0], { styles:{...selectedComponents[0].styles,[key]:value} }); }
  function updateProp(key:string, value:any) { if (!selected[0]) return; updateComponent(selected[0], { props:{...selectedComponents[0].props,[key]:value} }); }
  function deleteSelected() { setPageComponents(cs => cs.filter(c => !selected.includes(c.id))); setSelected([]); }
  function duplicateSelected() { const copies = selectedComponents.map(c => ({...clone(c), id:makeId(), name:`${c.name} copy`, rect:{...c.rect,x:c.rect.x+16,y:c.rect.y+16}})); setPageComponents(cs => [...cs,...copies]); setSelected(copies.map(c=>c.id)); }
  function paste() { if (!copied.length) return; const copies=copied.map(c=>({...clone(c),id:makeId(),name:`${c.name} copy`,rect:{...c.rect,x:c.rect.x+24,y:c.rect.y+24}})); setPageComponents(cs=>[...cs,...copies]); setSelected(copies.map(c=>c.id)); }
  function undo() { const prev=history.at(-1); if(!prev)return; setFuture(f=>[clone(project),...f]); setProject(prev); setHistory(h=>h.slice(0,-1)); setSelected([]); }
  function redo() { const next=future[0]; if(!next)return; setHistory(h=>[...h,clone(project)]); setProject(next); setFuture(f=>f.slice(1)); setSelected([]); }
  function startDrag(e:React.PointerEvent,c:BuilderComponent){ if(c.locked||preview)return; e.stopPropagation(); setSelected(s=>e.shiftKey||e.ctrlKey?[...new Set([...s,c.id])]:[c.id]); if(!e.shiftKey&&!e.ctrlKey)setDragging({id:c.id,startX:e.clientX,startY:e.clientY,origin:{...c.rect}}); }
  function startResize(e:React.PointerEvent,c:BuilderComponent){ if(c.locked||preview)return; e.stopPropagation(); setSelected([c.id]); setResizing({id:c.id,startX:e.clientX,startY:e.clientY,origin:{...c.rect}}); }
  function onDrop(e:React.DragEvent){ e.preventDefault(); const type=e.dataTransfer.getData('builder-type') as ComponentType; if(!type)return; const r=canvasRef.current?.getBoundingClientRect(); if(!r)return; add(type, clamp((e.clientX-r.left)/zoom-60,0,canvasWidth-60), clamp((e.clientY-r.top)/zoom-20,0,canvasHeight-20)); }
  function addPage(){ const p:Page={id:makeId('page'),name:`Page ${project.pages.length+1}`,path:`/page-${project.pages.length+1}`,components:[]}; commit({...project,pages:[...project.pages,p],activePageId:p.id}); setSelected([]); }
  function renamePage(){ const p=prompt('Page name',page.name); if(!p)return; commit({...project,pages:project.pages.map(x=>x.id===page.id?{...x,name:p}:x)}); }
  function duplicatePage(){ const p={...clone(page),id:makeId('page'),name:`${page.name} copy`,path:`${page.path}-copy`,components:page.components.map(c=>({...c,id:makeId()}))}; commit({...project,pages:[...project.pages,p],activePageId:p.id}); }
  function deletePage(){ if(project.pages.length===1)return toast.error('At least one page is required'); const remaining=project.pages.filter(p=>p.id!==page.id); commit({...project,pages:remaining,activePageId:remaining[0].id}); setSelected([]); }
  function exportJson(){ const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jalwa-app-builder.json';a.click();URL.revokeObjectURL(a.href); }
  function importJson(e:React.ChangeEvent<HTMLInputElement>){ const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const next=JSON.parse(String(reader.result));if(!next.pages)throw new Error('Invalid project');commit(next);toast.success('Project imported')}catch(err:any){toast.error(err.message)}};reader.readAsText(file);e.target.value=''; }
  function generateCode(){ const code=`import React from 'react';\n\nexport default function GeneratedApp(){\n  return (\n    <div style={{position:'relative',minHeight:'100vh',overflow:'hidden'}}>\n${page.components.map(c=>`      <div style={{position:'absolute',left:${c.rect.x},top:${c.rect.y},width:${c.rect.width},height:${c.rect.height}}}>${JSON.stringify(c.props.text ?? c.props.title ?? c.name)}</div>`).join('\n')}\n    </div>\n  );\n}`; const blob=new Blob([code],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${page.name.toLowerCase().replace(/\s+/g,'-')}.tsx`;a.click();URL.revokeObjectURL(a.href); }

  if(loading) return <div className="flex h-[calc(100vh-80px)] items-center justify-center text-sm text-muted-foreground">Loading builder…</div>;
  if(preview) return <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-zinc-950 p-6"><div style={{width:canvasWidth,height:canvasHeight,background:project.settings.background,transform:`scale(${zoom})`,transformOrigin:'center'}} className="relative overflow-hidden rounded-2xl shadow-2xl">{childrenOf(page,null).filter(c=>c.visible).map(c=><div key={c.id}>{renderComponent(c,true)}</div>)}</div><button onClick={()=>setPreview(false)} className="fixed right-6 top-6 rounded-lg bg-white px-4 py-2 text-sm text-black">Exit preview</button></div>;

  return <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0d] text-white">
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#111116] px-3">
      <div className="flex items-center gap-2 font-semibold"><Layers3 className="h-5 w-5 text-fuchsia-500"/> App Builder</div>
      <select value={page.id} onChange={e=>{setProject({...project,activePageId:e.target.value});setSelected([])}} className="rounded-md border border-white/10 bg-black px-2 py-1.5 text-xs">{project.pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <button onClick={addPage} className="rounded-md border border-white/10 px-2 py-1.5 text-xs"><Plus className="mr-1 inline h-3 w-3"/>Page</button><button onClick={renamePage} className="rounded-md border border-white/10 px-2 py-1.5 text-xs">Rename</button><button onClick={duplicatePage} className="rounded-md border border-white/10 px-2 py-1.5 text-xs">Duplicate</button><button onClick={deletePage} className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-red-300">Delete</button>
      <div className="ml-auto flex items-center gap-1"><button onClick={undo} disabled={!history.length} className="rounded p-2 hover:bg-white/10 disabled:opacity-30"><Undo2 className="h-4 w-4"/></button><button onClick={redo} disabled={!future.length} className="rounded p-2 hover:bg-white/10 disabled:opacity-30"><Redo2 className="h-4 w-4"/></button><button onClick={()=>setPreview(true)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs"><Eye className="mr-1 inline h-4 w-4"/>Preview</button><button onClick={saveProject} disabled={saving} className="rounded-md bg-white px-3 py-1.5 text-xs text-black"><Save className="mr-1 inline h-4 w-4"/>Save</button><button onClick={publishProject} disabled={saving} className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs">Publish</button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-[#111116] p-3"><div className="mb-3 flex items-center justify-between"><b className="text-sm">Components</b><span className="text-[10px] text-zinc-500">Drag to canvas</span></div><div className="relative mb-3"><Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-zinc-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" className="w-full rounded-md border border-white/10 bg-black py-2 pl-7 pr-2 text-xs outline-none"/></div><div className="grid grid-cols-2 gap-2">{visibleTools.map(t=><div key={t[0]} draggable onDragStart={e=>e.dataTransfer.setData('builder-type',t[0])} onDoubleClick={()=>add(t[0])} className="cursor-grab rounded-lg border border-white/10 bg-white/[.03] p-2 hover:border-fuchsia-500/50"><div className="mb-1 flex h-8 items-center justify-center rounded bg-white/5 text-sm font-bold text-fuchsia-300">{t[2]}</div><div className="text-[11px]">{t[1]}</div></div>)}</div><div className="mt-5 rounded-lg border border-white/10 p-3 text-[10px] text-zinc-400">Tip: double-click adds. Drag adds at the drop position. Shift/Ctrl-click multi-selects.</div></aside>
      <main className="min-w-0 flex-1 overflow-auto bg-[#08080b] p-6"><div className="mb-3 flex items-center justify-center gap-2"><button onClick={()=>setDevice('mobile')} className={`rounded-md px-2 py-1 text-xs ${device==='mobile'?'bg-fuchsia-600':'bg-white/5'}`}><Smartphone className="mr-1 inline h-3.5 w-3.5"/>Mobile</button><button onClick={()=>setDevice('tablet')} className={`rounded-md px-2 py-1 text-xs ${device==='tablet'?'bg-fuchsia-600':'bg-white/5'}`}><Tablet className="mr-1 inline h-3.5 w-3.5"/>Tablet</button><button onClick={()=>setDevice('desktop')} className={`rounded-md px-2 py-1 text-xs ${device==='desktop'?'bg-fuchsia-600':'bg-white/5'}`}><Monitor className="mr-1 inline h-3.5 w-3.5"/>Desktop</button><button onClick={()=>setSnap(!snap)} className={`rounded-md px-2 py-1 text-xs ${snap?'bg-fuchsia-600':'bg-white/5'}`}><Grid3X3 className="mr-1 inline h-3.5 w-3.5"/>Snap {snap?'On':'Off'}</button><button onClick={()=>setZoom(z=>clamp(z-.1,.5,1.5))} className="rounded-md bg-white/5 p-1.5"><ZoomOut className="h-4 w-4"/></button><span className="w-10 text-center text-xs">{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>clamp(z+.1,.5,1.5))} className="rounded-md bg-white/5 p-1.5"><ZoomIn className="h-4 w-4"/></button></div>
        <div className="flex justify-center"><div ref={canvasRef} onDragOver={e=>e.preventDefault()} onDrop={onDrop} onPointerDown={e=>{if(e.target===e.currentTarget)setSelected([])}} style={{width:canvasWidth,height:canvasHeight,backgroundColor:project.settings.background,transform:`scale(${zoom})`,transformOrigin:'top center',backgroundImage:`linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)`,backgroundSize:`${grid}px ${grid}px`}} className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
          {childrenOf(page,null).filter(c=>c.visible).map(c=><div key={c.id} onPointerDown={e=>startDrag(e,c)} className={`absolute ${selected.includes(c.id)?'ring-2 ring-fuchsia-500 ring-offset-1 ring-offset-zinc-950':''}`} style={{left:c.rect.x,top:c.rect.y,width:c.rect.width,height:c.rect.height,zIndex:c.zIndex}}>{renderComponent(c)}{selected.includes(c.id)&&<><div onPointerDown={e=>startResize(e,c)} className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm bg-fuchsia-500"/><div className="absolute -top-5 left-0 rounded bg-fuchsia-600 px-1 text-[9px]">{c.name}</div></>}</div>)}
          {!page.components.length&&<div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">Drag a component here to start building</div>}
        </div></div>
      </main>
      <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#111116] p-3">
        <div className="mb-3 flex items-center gap-1"><button className="flex-1 rounded-md bg-fuchsia-600 px-2 py-2 text-xs">Properties</button><button onClick={()=>setCopied(selectedComponents.map(clone))} className="rounded-md border border-white/10 p-2" title="Copy"><Copy className="h-4 w-4"/></button><button onClick={duplicateSelected} className="rounded-md border border-white/10 p-2" title="Duplicate"><Box className="h-4 w-4"/></button><button onClick={deleteSelected} className="rounded-md border border-white/10 p-2 text-red-300" title="Delete"><Trash2 className="h-4 w-4"/></button></div>
        {selectedComponents.length===1 ? <PropertyPanel component={selectedComponents[0]} device={device} updateStyle={updateStyle} updateProp={updateProp} updateRect={(r)=>updateComponent(selectedComponents[0].id,{rect:r})} /> : <LayersPanel page={page} selected={selected} setSelected={setSelected} onReorder={(ids)=>setPageComponents(cs=>ids.map(id=>cs.find(c=>c.id===id)!).filter(Boolean))}/>} 
        <div className="mt-4 border-t border-white/10 pt-3"><div className="mb-2 text-xs font-semibold">Project</div><div className="flex gap-2"><button onClick={exportJson} className="flex-1 rounded-md border border-white/10 px-2 py-2 text-xs"><Download className="mr-1 inline h-3.5 w-3.5"/>Export JSON</button><button onClick={()=>importRef.current?.click()} className="flex-1 rounded-md border border-white/10 px-2 py-2 text-xs"><Upload className="mr-1 inline h-3.5 w-3.5"/>Import JSON</button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importJson}/></div><button onClick={generateCode} className="mt-2 w-full rounded-md border border-white/10 px-2 py-2 text-xs"><FileJson className="mr-1 inline h-3.5 w-3.5"/>Generate frontend code</button></div>
      </aside>
    </div>
  </div>;
}

function PropertyPanel({component:c,device,updateStyle,updateProp,updateRect}:{component:BuilderComponent;device:Device;updateStyle:(k:string,v:string)=>void;updateProp:(k:string,v:any)=>void;updateRect:(r:Rect)=>void}){
  const input=(label:string,value:any,onChange:(v:string)=>void)=><label className="block"><span className="mb-1 block text-[10px] text-zinc-400">{label}</span><input value={value??''} onChange={e=>onChange(e.target.value)} className="w-full rounded-md border border-white/10 bg-black px-2 py-1.5 text-xs"/></label>;
  return <div className="space-y-4"><div><div className="text-sm font-semibold">{c.name}</div><div className="text-[10px] text-zinc-500">{c.type} · {device}</div></div><div className="grid grid-cols-2 gap-2">{input('X',c.rect.x,v=>updateRect({...c.rect,x:Number(v)||0}))}{input('Y',c.rect.y,v=>updateRect({...c.rect,y:Number(v)||0}))}{input('Width',c.rect.width,v=>updateRect({...c.rect,width:Math.max(24,Number(v)||24)}))}{input('Height',c.rect.height,v=>updateRect({...c.rect,height:Math.max(12,Number(v)||12)}))}</div><div className="border-t border-white/10 pt-3"><div className="mb-2 text-xs font-semibold">Spacing & surface</div><div className="grid grid-cols-2 gap-2">{input('Margin',c.styles.margin||'',v=>updateStyle('margin',v))}{input('Padding',c.styles.padding||'',v=>updateStyle('padding',v))}{input('Border',c.styles.border||'',v=>updateStyle('border',v))}{input('Radius',c.styles.borderRadius||'',v=>updateStyle('borderRadius',v))}{input('Shadow',c.styles.boxShadow||'',v=>updateStyle('boxShadow',v))}{input('Opacity',c.styles.opacity||'1',v=>updateStyle('opacity',v))}{input('Background',c.styles.background||'',v=>updateStyle('background',v))}{input('Z-index',c.zIndex,v=>updateStyle('zIndex',v))}</div></div><div className="border-t border-white/10 pt-3"><div className="mb-2 text-xs font-semibold">Typography</div><div className="grid grid-cols-2 gap-2">{input('Font',c.styles.fontFamily||'',v=>updateStyle('fontFamily',v))}{input('Size',c.styles.fontSize||'',v=>updateStyle('fontSize',v))}{input('Weight',c.styles.fontWeight||'',v=>updateStyle('fontWeight',v))}{input('Color',c.styles.color||'',v=>updateStyle('color',v))}{input('Line height',c.styles.lineHeight||'',v=>updateStyle('lineHeight',v))}{input('Letter spacing',c.styles.letterSpacing||'',v=>updateStyle('letterSpacing',v))}</div><div className="mt-2 flex gap-1"><button onClick={()=>updateStyle('textAlign','left')} className="rounded border border-white/10 p-2"><AlignLeft className="h-4 w-4"/></button><button onClick={()=>updateStyle('textAlign','center')} className="rounded border border-white/10 p-2"><AlignCenter className="h-4 w-4"/></button><button onClick={()=>updateStyle('textAlign','right')} className="rounded border border-white/10 p-2"><AlignRight className="h-4 w-4"/></button></div></div><div className="border-t border-white/10 pt-3"><div className="mb-2 text-xs font-semibold">Content</div>{['text','title','placeholder','src','alt'].filter(k=>k in c.props).map(k=>input(k,c.props[k],v=>updateProp(k,v)))}</div><div className="border-t border-white/10 pt-3"><label className="flex items-center justify-between text-xs"><span>Visible</span><input type="checkbox" checked={c.visible} onChange={e=>updateStyle('opacity',e.target.checked?'1':'0')}/></label><label className="mt-2 flex items-center justify-between text-xs"><span>Locked</span><input type="checkbox" checked={c.locked} onChange={e=>updateProp('__locked',e.target.checked)}/></label></div></div>;
}

function LayersPanel({page,selected,setSelected,onReorder}:{page:Page;selected:string[];setSelected:(v:string[])=>void;onReorder:(ids:string[])=>void}){
  const [open,setOpen]=useState<Record<string,boolean>>({});
  const root=childrenOf(page,null); const [dragId,setDragId]=useState<string|null>(null);
  const row=(c:BuilderComponent,depth=0)=><div key={c.id} draggable onDragStart={()=>setDragId(c.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(!dragId||dragId===c.id)return;const ids=page.components.map(x=>x.id);const from=ids.indexOf(dragId),to=ids.indexOf(c.id);ids.splice(from,1);ids.splice(to,0,dragId);onReorder(ids);setDragId(null)}} className={`mb-1 rounded-md border border-white/5 px-2 py-2 text-xs ${selected.includes(c.id)?'bg-fuchsia-600/20 border-fuchsia-500/50':''}`} style={{marginLeft:depth*12}} onClick={()=>setSelected([c.id])}><span className="mr-1 text-zinc-500">{open[c.id]?<ChevronDown className="inline h-3 w-3"/>:<ChevronRight className="inline h-3 w-3"/>}</span>{c.name}</div>;
  return <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Layers</span><span className="text-[10px] text-zinc-500">{page.components.length}</span></div>{root.map(c=>row(c))}</div>;
}
