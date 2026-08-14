import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ChevronRight, Copy, Download, Eye, FileJson, Grid3X3, Layers3, Monitor, Plus, Redo2, Save, Search, Smartphone, Tablet, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';

type Device = 'mobile' | 'tablet' | 'desktop';
type NodeType = 'text' | 'heading' | 'button' | 'image' | 'video' | 'icon' | 'avatar' | 'card' | 'input' | 'search' | 'navbar' | 'bottom-navigation' | 'tabs' | 'modal' | 'popup' | 'banner' | 'list' | 'grid' | 'container' | 'section' | 'divider' | 'spacer';
type Node = { id: string; type: NodeType; name: string; parentId: string | null; children: string[]; x: number; y: number; width: number; height: number; text?: string; src?: string; visible: boolean; z: number; style: Record<string, string | number>; };
type Page = { id: string; name: string; rootId: string; };
type Project = { version: 1; pages: Page[]; nodes: Record<string, Node>; activePageId: string; settings: { grid: number; snap: boolean; device: Device; }; };

const COMPONENTS: Array<{ type: NodeType; label: string }> = [
  ['text','Text'],['heading','Heading'],['button','Button'],['image','Image'],['video','Video'],['icon','Icon'],['avatar','Avatar'],['card','Card'],['input','Input'],['search','Search'],['navbar','Navbar'],['bottom-navigation','Bottom navigation'],['tabs','Tabs'],['modal','Modal'],['popup','Popup'],['banner','Banner'],['list','List'],['grid','Grid'],['container','Container'],['section','Section'],['divider','Divider'],['spacer','Spacer']
].map(([type,label]) => ({ type: type as NodeType, label: label as string }));

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const deviceWidth: Record<Device, number> = { mobile: 390, tablet: 768, desktop: 1024 };

function makeNode(type: NodeType, x = 24, y = 24): Node {
  const labels: Record<NodeType,string> = { text:'Text',heading:'Heading',button:'Button',image:'Image',video:'Video',icon:'Icon',avatar:'Avatar',card:'Card',input:'Input',search:'Search',navbar:'Navbar', 'bottom-navigation':'Bottom Navigation',tabs:'Tabs',modal:'Modal',popup:'Popup',banner:'Banner',list:'List',grid:'Grid',container:'Container',section:'Section',divider:'Divider',spacer:'Spacer' };
  const text = type === 'heading' ? 'Heading' : type === 'button' ? 'Button' : type === 'text' ? 'Text' : undefined;
  const width = type === 'button' ? 140 : type === 'divider' ? 300 : type === 'spacer' ? 300 : 300;
  const height = type === 'heading' ? 52 : type === 'button' ? 48 : type === 'text' ? 40 : type === 'divider' ? 2 : type === 'spacer' ? 24 : 120;
  return { id: uid(), type, name: labels[type], parentId: null, children: [], x, y, width, height, text, visible: true, z: 1, style: { background: type === 'button' ? '#ec0099' : '#17131d', color: '#ffffff', borderRadius: type === 'button' ? 12 : 8, padding: 12, opacity: 1 } };
}

function initialProject(): Project {
  const root = makeNode('section', 0, 0); root.id = 'root-home'; root.name = 'Home'; root.width = 390; root.height = 760; root.parentId = null; root.style = { background: '#09070c', color: '#fff' };
  const header = makeNode('navbar', 16, 16); header.name = 'Header'; header.width = 358; header.height = 64; header.parentId = root.id;
  const banner = makeNode('banner', 16, 96); banner.name = 'Banner'; banner.width = 358; banner.height = 150; banner.parentId = root.id;
  const content = makeNode('container', 16, 262); content.name = 'Content'; content.width = 358; content.height = 360; content.parentId = root.id;
  const bottom = makeNode('bottom-navigation', 16, 680); bottom.width = 358; bottom.height = 64; bottom.parentId = root.id;
  root.children = [header.id,banner.id,content.id,bottom.id];
  return { version: 1, pages: [{ id:'home', name:'Home', rootId:root.id }], nodes: { [root.id]:root,[header.id]:header,[banner.id]:banner,[content.id]:content,[bottom.id]:bottom }, activePageId:'home', settings:{ grid:8, snap:true, device:'mobile' } };
}

export function AppBuilderV2() {
  const [project, setProject] = useState<Project>(() => { try { const raw = localStorage.getItem('jalwa-visual-project-v2'); return raw ? JSON.parse(raw) : initialProject(); } catch { return initialProject(); } });
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'components'|'layers'|'pages'>('components');
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState(0.9);
  const [search, setSearch] = useState('');
  const dragRef = useRef<{ id:string; startX:number; startY:number; x:number; y:number } | null>(null);
  const resizeRef = useRef<{ id:string; startX:number; startY:number; w:number; h:number } | null>(null);

  const activePage = project.pages.find(p => p.id === project.activePageId) || project.pages[0];
  const root = activePage ? project.nodes[activePage.rootId] : undefined;
  const visibleNodes = useMemo(() => Object.values(project.nodes).filter(n => n.parentId === root?.id && n.visible).sort((a,b) => a.z-b.z), [project.nodes, root?.id]);
  const selectedNode = selected.length === 1 ? project.nodes[selected[0]] : undefined;

  const commit = useCallback((updater: (p: Project) => Project) => {
    setProject(prev => { const next = updater(prev); setHistory(h => [...h.slice(-49), prev]); setFuture([]); return next; });
  }, []);

  const updateNode = useCallback((id:string, patch:Partial<Node>) => commit(p => ({ ...p, nodes:{ ...p.nodes, [id]:{ ...p.nodes[id], ...patch } } })), [commit]);

  const addNode = useCallback((type:NodeType, x=24, y=24) => commit(p => {
    const n = makeNode(type, x, y); const parent = p.nodes[p.pages.find(pg => pg.id === p.activePageId)!.rootId]; n.parentId = parent.id;
    return { ...p, nodes:{ ...p.nodes, [n.id]:n, [parent.id]:{ ...parent, children:[...parent.children,n.id] } } };
  }), [commit]);

  const deleteSelected = useCallback(() => commit(p => {
    const ids = new Set(selected); const nodes = { ...p.nodes };
    ids.forEach(id => { const n=nodes[id]; if (!n) return; if (n.parentId && nodes[n.parentId]) nodes[n.parentId]={...nodes[n.parentId],children:nodes[n.parentId].children.filter(c=>c!==id)}; delete nodes[id]; });
    return { ...p, nodes };
  }), [commit, selected]);

  const duplicateSelected = useCallback(() => {
    if (!selected.length) return;
    commit(p => { const nodes={...p.nodes}; const newIds:string[]=[]; selected.forEach(id=>{const old=nodes[id]; if(!old)return; const n={...old,id:uid(),name:`${old.name} Copy`,x:old.x+16,y:old.y+16,children:[]}; nodes[n.id]=n; if(n.parentId&&nodes[n.parentId])nodes[n.parentId]={...nodes[n.parentId],children:[...nodes[n.parentId].children,n.id]}; newIds.push(n.id);}); return {...p,nodes}; });
  }, [commit, selected]);

  useEffect(() => { const key=(e:KeyboardEvent)=>{ if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();setHistory(h=>{const prev=h.at(-1);if(!prev)return h;setFuture(f=>[project,...f]);setProject(prev);return h.slice(0,-1);});} if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();setFuture(f=>{const next=f.at(-1);if(!next)return f;setHistory(h=>[...h,project]);setProject(next);return f.slice(0,-1);});} if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();duplicateSelected();} if(e.key==='Delete')deleteSelected();}; window.addEventListener('keydown',key); return()=>window.removeEventListener('keydown',key); }, [project, duplicateSelected, deleteSelected]);

  const onPointerMove = (e:React.PointerEvent) => {
    if(dragRef.current){ const d=dragRef.current; const dx=(e.clientX-d.startX)/zoom,dy=(e.clientY-d.startY)/zoom; let x=d.x+dx,y=d.y+dy; if(project.settings.snap){x=Math.round(x/project.settings.grid)*project.settings.grid;y=Math.round(y/project.settings.grid)*project.settings.grid;} updateNode(d.id,{x,y}); }
    if(resizeRef.current){ const r=resizeRef.current; updateNode(r.id,{width:Math.max(24,r.w+(e.clientX-r.startX)/zoom),height:Math.max(16,r.h+(e.clientY-r.startY)/zoom)}); }
  };
  const stopPointer = () => { dragRef.current=null; resizeRef.current=null; };

  const save = () => { localStorage.setItem('jalwa-visual-project-v2', JSON.stringify(project)); toast.success('Project saved'); };
  const exportJson = () => { const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jalwa-project.json';a.click();URL.revokeObjectURL(a.href); };
  const importJson = (file:File) => { const r=new FileReader();r.onload=()=>{try{setProject(JSON.parse(String(r.result)));setSelected([]);toast.success('Project imported');}catch{toast.error('Invalid project JSON');}};r.readAsText(file); };
  const addPage = () => { const root=makeNode('section',0,0);root.id=uid();root.name=`Page ${project.pages.length+1}`;root.width=deviceWidth[project.settings.device];root.height=760;const page={id:uid(),name:`Page ${project.pages.length+1}`,rootId:root.id};setProject(p=>({...p,pages:[...p.pages,page],activePageId:page.id,nodes:{...p.nodes,[root.id]:root}})); };
  const renamePage=()=>{if(!activePage)return;const name=window.prompt('Page name',activePage.name);if(name)commit(p=>({...p,pages:p.pages.map(pg=>pg.id===activePage.id?{...pg,name}:pg)}));};
  const deletePage=()=>{if(project.pages.length<=1)return toast.error('Keep at least one page');commit(p=>{const rest=p.pages.filter(pg=>pg.id!==activePage.id);return {...p,pages:rest,activePageId:rest[0].id};});setSelected([]);};

  const filtered = COMPONENTS.filter(c => c.label.toLowerCase().includes(search.toLowerCase()));
  if(preview) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black"><div className="relative h-screen w-full max-w-[1024px] overflow-auto bg-black">{root && visibleNodes.map(n=><RenderNode key={n.id} node={n} />)}<button onClick={()=>setPreview(false)} className="fixed right-5 top-5 rounded-lg bg-white px-4 py-2 text-black">Exit Preview</button></div></div>;

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#09070c] text-white" onPointerMove={onPointerMove} onPointerUp={stopPointer}>
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4"><div className="flex items-center gap-3"><strong className="text-lg">Customization Studio</strong><span className="rounded bg-white/5 px-2 py-1 text-xs">Visual App Builder</span></div><div className="flex items-center gap-1"><button title="Undo" onClick={()=>setHistory(h=>{const p=h.at(-1);if(!p)return h;setFuture(f=>[project,...f]);setProject(p);return h.slice(0,-1);})} className="p-2"><Undo2 size={16}/></button><button title="Redo" onClick={()=>setFuture(f=>{const p=f.at(-1);if(!p)return f;setHistory(h=>[...h,project]);setProject(p);return f.slice(0,-1);})} className="p-2"><Redo2 size={16}/></button><button onClick={save} className="rounded bg-fuchsia-600 px-3 py-2 text-sm"><Save size={15} className="mr-1 inline"/>Save</button><button onClick={()=>setPreview(true)} className="rounded border border-white/10 px-3 py-2 text-sm"><Eye size={15} className="mr-1 inline"/>Preview</button></div></header>
    <div className="flex min-h-0 flex-1">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-white/10 p-3"><div className="mb-3 flex gap-1"><button onClick={()=>setActiveTab('components')} className={`flex-1 rounded p-2 text-xs ${activeTab==='components'?'bg-fuchsia-600':'bg-white/5'}`}>Components</button><button onClick={()=>setActiveTab('layers')} className={`flex-1 rounded p-2 text-xs ${activeTab==='layers'?'bg-fuchsia-600':'bg-white/5'}`}>Layers</button><button onClick={()=>setActiveTab('pages')} className={`flex-1 rounded p-2 text-xs ${activeTab==='pages'?'bg-fuchsia-600':'bg-white/5'}`}>Pages</button></div>
        {activeTab==='components' && <><div className="mb-3 flex items-center gap-2 rounded border border-white/10 px-2"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search components" className="w-full bg-transparent py-2 text-xs outline-none"/></div><div className="grid grid-cols-2 gap-2">{filtered.map(c=><button key={c.type} draggable onDragStart={e=>e.dataTransfer.setData('component-type',c.type)} onClick={()=>addNode(c.type)} className="rounded-lg border border-white/10 bg-white/[.03] p-2 text-left text-xs hover:border-fuchsia-500">{c.label}</button>)}</div></>}
        {activeTab==='layers' && <LayerTree node={root} nodes={project.nodes} selected={selected} setSelected={setSelected} />}
        {activeTab==='pages' && <div className="space-y-2">{project.pages.map(p=><button key={p.id} onClick={()=>{setProject(x=>({...x,activePageId:p.id}));setSelected([])}} className={`w-full rounded p-2 text-left text-sm ${p.id===project.activePageId?'bg-fuchsia-600':'bg-white/5'}`}>{p.name}</button>)}<div className="flex gap-2"><button onClick={addPage} className="flex-1 rounded bg-white/10 p-2 text-xs"><Plus size={13} className="mr-1 inline"/>Page</button><button onClick={renamePage} className="rounded bg-white/10 p-2 text-xs">Rename</button><button onClick={deletePage} className="rounded bg-red-500/20 p-2 text-xs">Delete</button></div></div>}
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col items-center overflow-auto bg-[#0d0b12] p-8"><div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 p-1"><button onClick={()=>setProject(p=>({...p,settings:{...p.settings,device:'mobile'}}))} className={`rounded-full p-2 ${project.settings.device==='mobile'?'bg-fuchsia-600':''}`}><Smartphone size={15}/></button><button onClick={()=>setProject(p=>({...p,settings:{...p.settings,device:'tablet'}}))} className={`rounded-full p-2 ${project.settings.device==='tablet'?'bg-fuchsia-600':''}`}><Tablet size={15}/></button><button onClick={()=>setProject(p=>({...p,settings:{...p.settings,device:'desktop'}}))} className={`rounded-full p-2 ${project.settings.device==='desktop'?'bg-fuchsia-600':''}`}><Monitor size={15}/></button><span className="mx-2 text-xs text-white/50">{deviceWidth[project.settings.device]}px</span><button onClick={()=>setZoom(z=>Math.max(.4,z-.1))}><ZoomOut size={14}/></button><span className="text-xs">{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}><ZoomIn size={14}/></button></div>
        <div className="relative shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-[#09070c] shadow-2xl" style={{width:deviceWidth[project.settings.device]*zoom,height:(root?.height||760)*zoom}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const type=e.dataTransfer.getData('component-type') as NodeType;if(type)addNode(type,24,24)}}>{project.settings.grid>0 && <div className="pointer-events-none absolute inset-0 opacity-20" style={{backgroundImage:`linear-gradient(#ffffff 1px,transparent 1px),linear-gradient(90deg,#ffffff 1px,transparent 1px)`,backgroundSize:`${project.settings.grid*zoom}px ${project.settings.grid*zoom}px`}}/>}{root && visibleNodes.map(n=><div key={n.id} className={`absolute ${selected.includes(n.id)?'ring-2 ring-fuchsia-500':''}`} style={{left:n.x*zoom,top:n.y*zoom,width:n.width*zoom,height:n.height*zoom,zIndex:n.z,opacity:Number(n.style.opacity ?? 1),background:String(n.style.background||'transparent'),borderRadius:Number(n.style.borderRadius||0)}} onPointerDown={e=>{e.stopPropagation();setSelected(s=>e.ctrlKey||e.metaKey?(s.includes(n.id)?s.filter(x=>x!==n.id):[...s,n.id]):[n.id]);dragRef.current={id:n.id,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y};}}>{n.type==='image'?<div className="flex h-full items-center justify-center text-xs text-white/40">Image</div>:n.type==='video'?<div className="flex h-full items-center justify-center text-xs text-white/40">Video</div>:<div className="flex h-full items-center justify-center overflow-hidden px-2 text-center text-sm" style={{color:String(n.style.color||'#fff'),fontSize:Number(n.style.fontSize||14),fontWeight:Number(n.style.fontWeight||400)}}>{n.text || n.name}</div>}{selected.includes(n.id)&&<div onPointerDown={e=>{e.stopPropagation();resizeRef.current={id:n.id,startX:e.clientX,startY:e.clientY,w:n.width,h:n.height}}} className="absolute bottom-[-5px] right-[-5px] h-3 w-3 cursor-se-resize rounded-full bg-fuchsia-500"/>}</div>)}</div>
      </main>
      <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 p-4"><div className="mb-4 flex items-center gap-2"><Layers3 size={16}/><strong>Properties</strong></div>{selectedNode ? <div className="space-y-3 text-xs"><Field label="X" value={selectedNode.x} onChange={v=>updateNode(selectedNode.id,{x:v})}/><Field label="Y" value={selectedNode.y} onChange={v=>updateNode(selectedNode.id,{y:v})}/><Field label="Width" value={selectedNode.width} onChange={v=>updateNode(selectedNode.id,{width:Math.max(1,v)})}/><Field label="Height" value={selectedNode.height} onChange={v=>updateNode(selectedNode.id,{height:Math.max(1,v)})}/>{selectedNode.text!==undefined&&<label className="block"><span className="mb-1 block text-white/50">Text</span><textarea value={selectedNode.text} onChange={e=>updateNode(selectedNode.id,{text:e.target.value})} className="w-full rounded border border-white/10 bg-white/5 p-2"/></label>}<div className="grid grid-cols-2 gap-2"><button onClick={duplicateSelected} className="rounded bg-white/10 p-2"><Copy size={14} className="mr-1 inline"/>Duplicate</button><button onClick={deleteSelected} className="rounded bg-red-500/20 p-2"><Trash2 size={14} className="mr-1 inline"/>Delete</button></div><label className="flex items-center justify-between rounded bg-white/5 p-2">Visible<input type="checkbox" checked={selectedNode.visible} onChange={e=>updateNode(selectedNode.id,{visible:e.target.checked})}/></label><Field label="Z-index" value={selectedNode.z} onChange={v=>updateNode(selectedNode.id,{z:v})}/></div> : <div className="rounded border border-dashed border-white/10 p-6 text-center text-sm text-white/40">Select a component</div>}<div className="mt-6 space-y-2"><button onClick={exportJson} className="w-full rounded bg-white/5 p-2 text-left text-xs"><Download size={14} className="mr-2 inline"/>Export JSON</button><label className="block w-full cursor-pointer rounded bg-white/5 p-2 text-left text-xs"><Upload size={14} className="mr-2 inline"/>Import JSON<input type="file" accept="application/json" className="hidden" onChange={e=>e.target.files?.[0]&&importJson(e.target.files[0])}/></label><button onClick={()=>{setProject(initialProject());setSelected([])}} className="w-full rounded bg-red-500/10 p-2 text-left text-xs">Reset project</button></div></aside>
    </div>
  </div>;
}

function Field({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){return <label className="block"><span className="mb-1 block text-white/50">{label}</span><input type="number" value={Math.round(value)} onChange={e=>onChange(Number(e.target.value)||0)} className="w-full rounded border border-white/10 bg-white/5 p-2 outline-none focus:border-fuchsia-500"/></label>}

function LayerTree({node,nodes,selected,setSelected}:{node?:Node;nodes:Record<string,Node>;selected:string[];setSelected:(v:string[])=>void}){if(!node)return null;return <div className="space-y-1">{node.children.map(id=>{const n=nodes[id];if(!n)return null;return <div key={id}><button onClick={()=>setSelected([id])} className={`flex w-full items-center gap-1 rounded p-2 text-left text-xs ${selected.includes(id)?'bg-fuchsia-600':'bg-white/5'}`}><ChevronRight size={12}/>{n.name}</button>{n.children.length>0&&<div className="ml-3 border-l border-white/10 pl-2"><LayerTree node={n} nodes={nodes} selected={selected} setSelected={setSelected}/></div>}</div>})}</div>}

function RenderNode({node}:{node:Node}){return <div className="absolute" style={{left:node.x,top:node.y,width:node.width,height:node.height,zIndex:node.z,background:String(node.style.background||'transparent'),color:String(node.style.color||'#fff'),borderRadius:Number(node.style.borderRadius||0)}}>{node.text||node.name}</div>}
