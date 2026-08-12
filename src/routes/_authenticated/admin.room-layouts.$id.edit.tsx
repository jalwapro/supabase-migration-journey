import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { publishRoomLayout } from '@/lib/room-layout-publishing';
import type { DevicePreset, ElementType, LayoutElement, LayoutJSON, RoomType } from '@/lib/room-layouts';
import { DEFAULT_PK_LAYOUT, DEFAULT_VIDEO_LAYOUT, DEFAULT_VOICE_LAYOUT, DEVICE_PRESETS } from '@/lib/room-layouts';
import { RoomStudioElementPreview } from '@/components/admin/RoomStudioElementPreview';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Grid3X3, Layers, Lock, Monitor, Palette, Play, Redo, Save, Settings2, Smartphone, Tablet, Trash2, Undo, Unlock, ZoomIn, ZoomOut } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/room-layouts/$id/edit')({
  validateSearch: (search: Record<string, unknown>) => ({ type: search.type === 'video' || search.type === 'pk' ? search.type : 'voice' }),
  component: RoomLayoutStudio,
});

type RoomLayoutRow = { id: string; name: string; type: RoomType; layout_json: LayoutJSON; status: string; version: number };

const PALETTE: { group: string; items: { type: ElementType; label: string }[] }[] = [
  { group: 'Room', items: [
    { type: 'room-header', label: 'Room Header' }, { type: 'room-title', label: 'Room Title' }, { type: 'room-id', label: 'Room ID' },
    { type: 'host-avatar', label: 'Host Avatar' }, { type: 'host-name', label: 'Host Name' }, { type: 'room-announcement', label: 'Announcement' },
  ]},
  { group: 'Voice', items: [
    { type: 'seat', label: 'Seat' }, { type: 'seat-avatar', label: 'Seat Avatar' }, { type: 'seat-frame', label: 'Seat Frame' }, { type: 'seat-number', label: 'Seat Number' },
    { type: 'seat-lock', label: 'Seat Lock' }, { type: 'mic-icon', label: 'Mic' }, { type: 'user-level', label: 'User Level' }, { type: 'user-name', label: 'User Name' }, { type: 'online-indicator', label: 'Online' },
  ]},
  { group: 'Chat & Gifts', items: [
    { type: 'chat-panel', label: 'Chat Panel' }, { type: 'chat-message', label: 'Chat Message' }, { type: 'gift-button', label: 'Gift Button' }, { type: 'gift-panel', label: 'Gift Panel' },
    { type: 'send-gift-button', label: 'Send Gift' }, { type: 'coin-balance', label: 'Coin Balance' },
  ]},
  { group: 'Controls', items: [
    { type: 'follow-button', label: 'Follow' }, { type: 'share-button', label: 'Share' }, { type: 'more-button', label: 'More' }, { type: 'close-button', label: 'Close' },
    { type: 'settings-button', label: 'Settings' }, { type: 'room-info', label: 'Room Info' }, { type: 'bottom-toolbar', label: 'Bottom Toolbar' },
    { type: 'beauty-filter-button', label: 'Beauty' }, { type: 'game-button', label: 'Game' }, { type: 'pk-button', label: 'PK' },
  ]},
  { group: 'Video & PK', items: [
    { type: 'video-participant', label: 'Video Participant' }, { type: 'video-frame', label: 'Video Frame' }, { type: 'pk-player', label: 'PK Player' }, { type: 'pk-vs-logo', label: 'PK VS' },
    { type: 'pk-score-bar', label: 'PK Score' }, { type: 'pk-progress-bar', label: 'PK Progress' }, { type: 'pk-timer', label: 'PK Timer' }, { type: 'pk-gift-score', label: 'Gift Score' },
    { type: 'pk-coin-score', label: 'Coin Score' }, { type: 'pk-battle-status', label: 'Battle Status' }, { type: 'pk-winner-area', label: 'Winner Area' },
  ]},
  { group: 'Design', items: [
    { type: 'custom-text', label: 'Text' }, { type: 'custom-image', label: 'Image' }, { type: 'badge', label: 'Badge' }, { type: 'divider', label: 'Divider' },
    { type: 'overlay', label: 'Overlay' }, { type: 'gradient', label: 'Gradient' }, { type: 'decorative-element', label: 'Decoration' }, { type: 'frame', label: 'Frame' }, { type: 'gif-animation', label: 'GIF / Animation' },
  ]},
];

function getDefault(type: RoomType) { return type === 'video' ? DEFAULT_VIDEO_LAYOUT : type === 'pk' ? DEFAULT_PK_LAYOUT : DEFAULT_VOICE_LAYOUT; }

function cloneLayout(layout: LayoutJSON): LayoutJSON { return JSON.parse(JSON.stringify(layout)); }

function RoomLayoutStudio() {
  const { id } = Route.useParams();
  const search = useSearch({ from: Route.id });
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const roomType = search.type as RoomType;
  const defaultLayout = useMemo(() => cloneLayout(getDefault(roomType)), [roomType]);
  const [layoutState, setLayoutState] = useState<LayoutJSON>(defaultLayout);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<DevicePreset>(DEVICE_PRESETS[0]);
  const [zoom, setZoom] = useState(0.82);
  const [dirty, setDirty] = useState(isNew);
  const [history, setHistory] = useState<LayoutJSON[]>([defaultLayout]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [grid, setGrid] = useState(true);

  const { data: persisted, isLoading } = useQuery({
    queryKey: ['room_layout', id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from('room_layouts').select('*').eq('id', id).single();
      if (error) throw error;
      return data as RoomLayoutRow;
    },
  });

  useEffect(() => {
    if (!persisted?.layout_json) return;
    const next = persisted.layout_json;
    setLayoutState(next); setHistory([next]); setHistoryIndex(0); setDirty(false); setSelected(null);
  }, [persisted]);

  const commit = useCallback((next: LayoutJSON) => {
    setLayoutState(next);
    setHistory((old) => [...old.slice(0, historyIndex + 1), cloneLayout(next)]);
    setHistoryIndex((old) => old + 1);
    setDirty(true);
  }, [historyIndex]);

  const updateElement = useCallback((elementId: string, patch: Partial<LayoutElement>, historyCommit = true) => {
    setLayoutState((current) => {
      const next = { ...current, elements: current.elements.map((el) => el.id === elementId ? { ...el, ...patch } : el) };
      if (historyCommit) {
        setHistory((old) => [...old.slice(0, historyIndex + 1), cloneLayout(next)]);
        setHistoryIndex((old) => old + 1);
      }
      return next;
    });
    setDirty(true);
  }, [historyIndex]);

  const save = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const { data, error } = await supabase.from('room_layouts').insert({ name: `${roomType[0].toUpperCase()}${roomType.slice(1)} Custom Layout`, type: roomType, layout_json: layoutState, status: 'draft', version: 1, created_by: user?.id }).select().single();
        if (error) throw error;
        await supabase.from('room_layout_versions').insert({ layout_id: data.id, version: 1, layout_json: layoutState, created_by: user?.id, change_description: 'Created in Visual Studio' });
        return data as RoomLayoutRow;
      }
      const nextVersion = Number(persisted?.version ?? 0) + 1;
      const { data, error } = await supabase.from('room_layouts').update({ layout_json: layoutState, version: nextVersion, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      await supabase.from('room_layout_versions').insert({ layout_id: id, version: nextVersion, layout_json: layoutState, created_by: user?.id, change_description: 'Saved from Visual Studio' });
      return data as RoomLayoutRow;
    },
    onSuccess: (data) => {
      setDirty(false); queryClient.invalidateQueries({ queryKey: ['room_layouts'] }); queryClient.invalidateQueries({ queryKey: ['room_layout', id] });
      if (isNew) navigate({ to: `/admin/room-layouts/${data.id}/edit`, search: { type: roomType } });
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (isNew) throw new Error('Save the layout before publishing.');
      return publishRoomLayout(id, layoutState, roomType);
    },
    onSuccess: () => { setDirty(false); queryClient.invalidateQueries({ queryKey: ['room_layout', id] }); queryClient.invalidateQueries({ queryKey: ['room_layouts'] }); },
  });

  const addElement = (type: ElementType) => {
    const element: LayoutElement = { id: `${type}-${Date.now()}`, type, x: Math.max(10, device.width / 2 - 60), y: Math.max(10, device.height / 2 - 40), width: 120, height: 70, zIndex: Math.max(0, ...layoutState.elements.map((e) => e.zIndex)) + 1, visible: true, locked: false, borderRadius: 10, data: type === 'custom-text' ? { text: 'Your text' } : undefined };
    commit({ ...layoutState, elements: [...layoutState.elements, element] }); setSelected(element.id);
  };

  const deleteElement = (elementId: string) => { commit({ ...layoutState, elements: layoutState.elements.filter((el) => el.id !== elementId) }); setSelected(null); };
  const duplicate = (elementId: string) => { const found = layoutState.elements.find((el) => el.id === elementId); if (!found) return; const copy = { ...found, id: `${found.type}-${Date.now()}`, x: found.x + 20, y: found.y + 20, zIndex: Math.max(...layoutState.elements.map((e) => e.zIndex)) + 1 }; commit({ ...layoutState, elements: [...layoutState.elements, copy] }); setSelected(copy.id); };
  const changeLayer = (elementId: string, direction: 'front' | 'back') => { const max = Math.max(...layoutState.elements.map((e) => e.zIndex)); const min = Math.min(...layoutState.elements.map((e) => e.zIndex)); updateElement(elementId, { zIndex: direction === 'front' ? max + 1 : min - 1 }); };
  const undo = () => { if (historyIndex === 0) return; const next = history[historyIndex - 1]; setHistoryIndex((i) => i - 1); setLayoutState(cloneLayout(next)); setDirty(true); };
  const redo = () => { if (historyIndex >= history.length - 1) return; const next = history[historyIndex + 1]; setHistoryIndex((i) => i + 1); setLayoutState(cloneLayout(next)); setDirty(true); };

  if (isLoading) return <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center">Loading Room Layout Studio…</div>;

  const selectedElement = layoutState.elements.find((el) => el.id === selected) ?? null;

  return <div className="min-h-screen h-screen bg-[#07070b] text-white flex flex-col overflow-hidden">
    <header className="h-16 shrink-0 border-b border-white/10 bg-[#0d0d13] flex items-center justify-between px-4">
      <div className="flex items-center gap-3 min-w-0"><button onClick={() => navigate({ to: '/admin/room-layouts' })} className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="h-5 w-5"/></button><div><div className="font-bold truncate">{persisted?.name ?? `${roomType.toUpperCase()} Room Studio`}</div><div className="text-[11px] text-white/40">{dirty ? 'Unsaved changes' : 'All changes saved'} · {roomType.toUpperCase()}</div></div></div>
      <div className="flex items-center gap-2"><button onClick={undo} disabled={historyIndex === 0} className="p-2 rounded-lg bg-white/5 disabled:opacity-30"><Undo className="h-4 w-4"/></button><button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg bg-white/5 disabled:opacity-30"><Redo className="h-4 w-4"/></button><span className="w-px h-6 bg-white/10 mx-1"/><button onClick={() => navigate({ to: `/admin/room-layouts/${id}/preview` })} disabled={isNew} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center gap-2 text-sm"><Eye className="h-4 w-4"/> Preview</button><button onClick={() => save.mutate()} disabled={save.isPending} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm flex items-center gap-2"><Save className="h-4 w-4"/>{save.isPending ? 'Saving…' : 'Save Draft'}</button><button onClick={() => publish.mutate()} disabled={isNew || dirty || publish.isPending} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 font-semibold text-sm flex items-center gap-2"><Play className="h-4 w-4"/>{publish.isPending ? 'Publishing…' : 'Publish Live'}</button></div>
    </header>

    <div className="flex-1 min-h-0 flex">
      <aside className={`${paletteOpen ? 'w-72' : 'w-12'} shrink-0 border-r border-white/10 bg-[#0b0b10] overflow-hidden transition-all`}>
        <div className="h-12 flex items-center justify-between px-3 border-b border-white/10"><span className={`font-semibold text-sm ${paletteOpen ? '' : 'hidden'}`}>Elements</span><button onClick={() => setPaletteOpen((v) => !v)} className="p-1.5 rounded hover:bg-white/10"><Layers className="h-4 w-4"/></button></div>
        {paletteOpen && <div className="p-3 overflow-y-auto h-[calc(100%-48px)] space-y-4">{PALETTE.map((group) => <div key={group.group}><div className="text-[10px] uppercase tracking-wider text-white/35 mb-2">{group.group}</div><div className="grid grid-cols-2 gap-1.5">{group.items.map((item) => <button key={item.type} onClick={() => addElement(item.type)} className="text-left px-2.5 py-2 rounded-lg bg-white/[0.04] hover:bg-purple-500/15 border border-white/5 hover:border-purple-500/30 text-[11px] text-white/75">+ {item.label}</button>)}</div></div>)}</div>}
      </aside>

      <main className="flex-1 min-w-0 flex flex-col bg-[#060609]">
        <div className="h-12 shrink-0 border-b border-white/10 flex items-center justify-center gap-2"><button onClick={() => setDevice(DEVICE_PRESETS[0])} className={`p-2 rounded-lg ${device.name === 'mobile' ? 'bg-purple-600' : 'bg-white/5'}`}><Smartphone className="h-4 w-4"/></button><button onClick={() => setDevice(DEVICE_PRESETS[1])} className={`p-2 rounded-lg ${device.name === 'tablet' ? 'bg-purple-600' : 'bg-white/5'}`}><Tablet className="h-4 w-4"/></button><button onClick={() => setDevice(DEVICE_PRESETS[2])} className={`p-2 rounded-lg ${device.name === 'desktop' ? 'bg-purple-600' : 'bg-white/5'}`}><Monitor className="h-4 w-4"/></button><span className="w-px h-5 bg-white/10 mx-2"/><button onClick={() => setZoom((v) => Math.max(.35, v - .1))} className="p-2 rounded-lg bg-white/5"><ZoomOut className="h-4 w-4"/></button><span className="text-xs text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((v) => Math.min(1.5, v + .1))} className="p-2 rounded-lg bg-white/5"><ZoomIn className="h-4 w-4"/></button><button onClick={() => setGrid((v) => !v)} className={`p-2 rounded-lg ${grid ? 'bg-purple-600/30 text-purple-200' : 'bg-white/5'}`}><Grid3X3 className="h-4 w-4"/></button></div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-10">
          <div className="relative shrink-0 shadow-2xl" style={{ width: device.width * zoom, height: device.height * zoom }}>
            <div className="absolute inset-0" style={{ width: device.width, height: device.height, transform: `scale(${zoom})`, transformOrigin: 'top left', background: layoutState.background?.value ?? layoutState.canvas.backgroundColor ?? '#0a0a0f', backgroundImage: grid ? 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)' : undefined, backgroundSize: '20px 20px', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.18)' }} onPointerDown={() => setSelected(null)}>
              {layoutState.elements.filter((el) => el.visible).sort((a,b) => a.zIndex-b.zIndex).map((element) => <StudioElement key={element.id} element={element} selected={selected === element.id} onSelect={() => setSelected(element.id)} onUpdate={(patch) => updateElement(element.id, patch, false)} onCommit={() => { setHistory((old) => [...old.slice(0, historyIndex + 1), cloneLayout(layoutState)]); setHistoryIndex((old) => old + 1); setDirty(true); }} />)}
            </div>
          </div>
        </div>
      </main>

      <aside className="w-80 shrink-0 border-l border-white/10 bg-[#0b0b10] overflow-y-auto">
        <div className="p-4 border-b border-white/10"><div className="flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4"/> Properties</div></div>
        {selectedElement ? <Properties element={selectedElement} onUpdate={(patch) => updateElement(selectedElement.id, patch)} onDelete={() => deleteElement(selectedElement.id)} onDuplicate={() => duplicate(selectedElement.id)} onLayer={(dir) => changeLayer(selectedElement.id, dir)} /> : <div className="p-5 text-center text-white/35 text-sm"><Palette className="h-10 w-10 mx-auto mb-3 opacity-40"/><p>Select anything on the canvas to customize it.</p><p className="text-xs mt-2">Drag, resize, rotate, style, hide, lock and layer every element.</p></div>}
      </aside>
    </div>
  </div>;
}

function StudioElement({ element, selected, onSelect, onUpdate, onCommit }: { element: LayoutElement; selected: boolean; onSelect: () => void; onUpdate: (patch: Partial<LayoutElement>) => void; onCommit: () => void }) {
  const drag = useRef<{ mode: 'move' | 'resize'; pointer: number; startX: number; startY: number; x: number; y: number; w: number; h: number } | null>(null);
  const pointerDown = (e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize') => {
    if (element.locked) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); onSelect();
    drag.current = { mode, pointer: e.pointerId, startX: e.clientX, startY: e.clientY, x: element.x, y: element.y, w: element.width, h: element.height };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => { const d = drag.current; if (!d || d.pointer !== e.pointerId) return; const scale = Number((e.currentTarget.parentElement as HTMLElement)?.dataset.editorScale || 1); const dx = (e.clientX - d.startX) / scale; const dy = (e.clientY - d.startY) / scale; if (d.mode === 'move') onUpdate({ x: Math.round(d.x + dx), y: Math.round(d.y + dy) }); else onUpdate({ width: Math.max(24, Math.round(d.w + dx)), height: Math.max(24, Math.round(d.h + dy)) }); };
  const up = (e: React.PointerEvent<HTMLDivElement>) => { if (!drag.current || drag.current.pointer !== e.pointerId) return; drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); onCommit(); };
  return <div onPointerDown={(e) => pointerDown(e, 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="absolute select-none" style={{ left: element.x, top: element.y, width: element.width, height: element.height, zIndex: element.zIndex, opacity: element.opacity ?? 1, transform: `rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`, transformOrigin: 'center', borderRadius: element.borderRadius ?? 8, outline: selected ? '2px solid #a855f7' : '1px solid transparent', cursor: element.locked ? 'not-allowed' : 'move', touchAction: 'none' }}>
    <RoomStudioElementPreview element={element} roomType="voice" />
    {selected && !element.locked && <><div onPointerDown={(e) => pointerDown(e, 'resize')} className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-purple-500 border-2 border-white cursor-nwse-resize"/><div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-purple-600 text-[8px] text-white whitespace-nowrap">{element.type}</div></>}
    {selected && element.locked && <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-white/10 text-[8px] text-white">🔒 locked</div>}
  </div>;
}

function Properties({ element, onUpdate, onDelete, onDuplicate, onLayer }: { element: LayoutElement; onUpdate: (patch: Partial<LayoutElement>) => void; onDelete: () => void; onDuplicate: () => void; onLayer: (direction: 'front' | 'back') => void }) {
  const style = element.style ?? {};
  const setStyle = (patch: NonNullable<LayoutElement['style']>) => onUpdate({ style: { ...style, ...patch } });
  const setData = (key: string, value: unknown) => onUpdate({ data: { ...(element.data ?? {}), [key]: value } });
  return <div className="p-4 space-y-5">
    <div><div className="text-xs text-white/40 mb-1">Element</div><div className="font-medium text-sm">{element.type}</div></div>
    <Section title="Position"><div className="grid grid-cols-2 gap-2"><Num label="X" value={element.x} onChange={(v) => onUpdate({ x: v })}/><Num label="Y" value={element.y} onChange={(v) => onUpdate({ y: v })}/></div></Section>
    <Section title="Size"><div className="grid grid-cols-2 gap-2"><Num label="Width" value={element.width} min={24} onChange={(v) => onUpdate({ width: v })}/><Num label="Height" value={element.height} min={24} onChange={(v) => onUpdate({ height: v })}/></div></Section>
    <Section title="Transform"><Num label="Rotation" value={element.rotation ?? 0} onChange={(v) => onUpdate({ rotation: v })}/><Num label="Scale" value={element.scale ?? 1} step={.05} min={.1} onChange={(v) => onUpdate({ scale: v })}/><Num label="Opacity" value={element.opacity ?? 1} step={.05} min={0} max={1} onChange={(v) => onUpdate({ opacity: v })}/></Section>
    <Section title="Appearance"><Num label="Border radius" value={element.borderRadius ?? 8} onChange={(v) => onUpdate({ borderRadius: v })}/><label className="block text-xs text-white/50 mt-2">Background<input value={style.background ?? ''} onChange={(e) => setStyle({ background: e.target.value })} placeholder="#111827 or rgba(... )" className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs outline-none"/></label><label className="block text-xs text-white/50 mt-2">Text color<input value={style.color ?? ''} onChange={(e) => setStyle({ color: e.target.value })} placeholder="#ffffff" className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs outline-none"/></label><Num label="Font size" value={style.fontSize ?? 14} min={6} onChange={(v) => setStyle({ fontSize: v })}/></Section>
    {(element.type === 'custom-text' || element.type === 'custom-image') && <Section title="Content"><label className="block text-xs text-white/50">{element.type === 'custom-text' ? 'Text' : 'Image URL'}<input value={String(element.data?.[element.type === 'custom-text' ? 'text' : 'src'] ?? '')} onChange={(e) => setData(element.type === 'custom-text' ? 'text' : 'src', e.target.value)} className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs outline-none"/></label></Section>}
    <Section title="Visibility & Lock"><div className="flex gap-2"><button onClick={() => onUpdate({ visible: !element.visible })} className="flex-1 py-2 rounded-lg bg-white/5 text-xs">{element.visible ? 'Hide' : 'Show'}</button><button onClick={() => onUpdate({ locked: !element.locked })} className="flex-1 py-2 rounded-lg bg-white/5 text-xs">{element.locked ? <><Unlock className="inline h-3 w-3 mr-1"/>Unlock</> : <><Lock className="inline h-3 w-3 mr-1"/>Lock</>}</button></div></Section>
    <div className="grid grid-cols-2 gap-2"><button onClick={() => onLayer('front')} className="py-2 rounded-lg bg-white/5 text-xs"><ArrowUp className="inline h-3 w-3 mr-1"/>Front</button><button onClick={() => onLayer('back')} className="py-2 rounded-lg bg-white/5 text-xs"><ArrowDown className="inline h-3 w-3 mr-1"/>Back</button><button onClick={onDuplicate} className="py-2 rounded-lg bg-white/5 text-xs"><Copy className="inline h-3 w-3 mr-1"/>Duplicate</button><button onClick={onDelete} className="py-2 rounded-lg bg-red-500/10 text-red-300 text-xs"><Trash2 className="inline h-3 w-3 mr-1"/>Delete</button></div>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div><div className="text-[10px] uppercase tracking-wider text-white/35 mb-2">{title}</div><div className="space-y-2">{children}</div></div>; }
function Num({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) { return <label className="block text-xs text-white/50">{label}<input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-purple-500"/></label>; }
