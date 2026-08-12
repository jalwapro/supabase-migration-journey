import { useMemo, useState } from 'react';
import { Eye, EyeOff, GripVertical, Image, LayoutGrid, Lock, Plus, Square, Trash2, Type, Unlock } from 'lucide-react';
import type { AppComponentConfig, AppCustomizationConfig, AppPage } from '@/lib/app-customization';

const COMPONENTS = [
  { type: 'text', label: 'Text', icon: Type, width: 180, height: 60 },
  { type: 'image', label: 'Image', icon: Image, width: 220, height: 130 },
  { type: 'card', label: 'Card', icon: Square, width: 240, height: 140 },
  { type: 'grid', label: 'Room Grid', icon: LayoutGrid, width: 320, height: 180 },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function AppVisualBuilder({ config, page, onChange }: { config: AppCustomizationConfig; page: AppPage; onChange: (config: AppCustomizationConfig) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const components = config.pages[page].components;
  const selected = useMemo(() => components.find((item) => item.id === selectedId) ?? null, [components, selectedId]);

  const updateComponents = (next: AppComponentConfig[]) => onChange({ ...config, pages: { ...config.pages, [page]: { ...config.pages[page], components: next } } });

  const add = (type: string) => {
    const preset = COMPONENTS.find((item) => item.type === type) ?? COMPONENTS[0];
    const item: AppComponentConfig = { id: uid(), type: preset.type, page, x: 30 + (components.length % 3) * 30, y: 90 + components.length * 18, width: preset.width, height: preset.height, zIndex: components.length + 1, visible: true, locked: false, props: { text: preset.label } };
    updateComponents([...components, item]);
    setSelectedId(item.id);
  };

  const patch = (id: string, changes: Partial<AppComponentConfig>) => updateComponents(components.map((item) => item.id === id ? { ...item, ...changes } : item));
  const patchProps = (id: string, props: Record<string, unknown>) => updateComponents(components.map((item) => item.id === id ? { ...item, props: { ...item.props, ...props } } : item));

  const move = (id: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const item = components.find((value) => value.id === id);
    if (!item || item.locked) return;
    patch(id, { x: Math.max(0, Math.round(event.clientX - rect.left - item.width / 2)), y: Math.max(0, Math.round(event.clientY - rect.top - item.height / 2)) });
  };

  return <div className="grid grid-cols-[190px_minmax(390px,1fr)_260px] gap-3 h-[680px]">
    <aside className="rounded-xl border border-white/10 bg-black/20 p-3 overflow-auto">
      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Components</p>
      {COMPONENTS.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => add(type)} className="w-full flex items-center gap-2 rounded-lg px-3 py-3 mb-2 bg-white/5 hover:bg-white/10 text-left text-sm"><Icon className="w-4 h-4 text-violet-300"/>{label}<Plus className="w-3 h-3 ml-auto opacity-50"/></button>)}
      <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/40">Drag elements on the canvas. Select one to edit its properties.</div>
    </aside>
    <section className="rounded-xl border border-white/10 bg-black/30 overflow-auto p-8">
      <div className="mx-auto relative bg-[#0a0a0f] border border-white/15 rounded-2xl shadow-2xl" style={{ width: 390, minHeight: 620, background: config.pages[page].background }} onDragOver={(event) => event.preventDefault()}>
        <div className="absolute inset-x-0 top-0 h-12 border-b border-white/10 px-4 flex items-center text-xs text-white/40">LIVE CANVAS · {page.toUpperCase()}</div>
        {components.map((item) => <div key={item.id} draggable={!item.locked} onDragEnd={(event) => move(item.id, event)} onClick={() => setSelectedId(item.id)} className={`absolute cursor-move overflow-hidden rounded-xl border ${selectedId === item.id ? 'border-violet-400 ring-2 ring-violet-400/30' : 'border-white/10'} ${!item.visible ? 'opacity-30' : ''}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex }}>
          <div className="h-full w-full bg-white/[.05] p-3">
            {item.type === 'text' && <div className="font-semibold">{String(item.props.text ?? 'Text')}</div>}
            {item.type === 'image' && <div className="h-full flex items-center justify-center text-white/30"><Image className="w-8 h-8"/></div>}
            {item.type === 'card' && <div><div className="font-semibold">{String(item.props.text ?? 'Card')}</div><div className="text-xs text-white/40 mt-2">Custom content</div></div>}
            {item.type === 'grid' && <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-full bg-violet-500/20 border border-violet-300/20"/>)}</div>}
          </div>
          {selectedId === item.id && <div className="absolute left-1 top-1 text-[9px] bg-violet-600 rounded px-1">{item.locked ? 'LOCKED' : 'EDIT'}</div>}
        </div>)}
      </div>
    </section>
    <aside className="rounded-xl border border-white/10 bg-black/20 p-4 overflow-auto">
      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Properties</p>
      {!selected && <p className="text-sm text-white/40">Select a component.</p>}
      {selected && <div className="space-y-4">
        <div className="text-sm font-semibold capitalize">{selected.type}</div>
        <label className="block text-xs text-white/50">Text / Label<input className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm" value={String(selected.props.text ?? '')} onChange={(e) => patchProps(selected.id, { text: e.target.value })}/></label>
        <div className="grid grid-cols-2 gap-2">{(['x','y','width','height'] as const).map((key) => <label key={key} className="text-xs text-white/50">{key}<input type="number" className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm" value={selected[key]} onChange={(e) => patch(selected.id, { [key]: Number(e.target.value) })}/></label>)}</div>
        <label className="text-xs text-white/50">Z Index<input type="number" className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm" value={selected.zIndex} onChange={(e) => patch(selected.id, { zIndex: Number(e.target.value) })}/></label>
        <div className="flex gap-2"><button onClick={() => patch(selected.id, { visible: !selected.visible })} className="flex-1 rounded-md bg-white/5 py-2 text-xs">{selected.visible ? <Eye className="w-4 h-4 mx-auto"/> : <EyeOff className="w-4 h-4 mx-auto"/>}</button><button onClick={() => patch(selected.id, { locked: !selected.locked })} className="flex-1 rounded-md bg-white/5 py-2 text-xs">{selected.locked ? <Lock className="w-4 h-4 mx-auto"/> : <Unlock className="w-4 h-4 mx-auto"/>}</button><button onClick={() => { updateComponents(components.filter((item) => item.id !== selected.id)); setSelectedId(null); }} className="flex-1 rounded-md bg-red-500/10 text-red-300 py-2"><Trash2 className="w-4 h-4 mx-auto"/></button></div>
      </div>}
    </aside>
  </div>;
}
