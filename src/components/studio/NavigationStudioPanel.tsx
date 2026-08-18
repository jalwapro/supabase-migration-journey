import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addNavigationItem, normalizeNavigation, removeNavigationItem, reorderNavigationItems, updateNavigationItem, type NavigationConfig } from "@/lib/app-customization/navigation-studio";

type Props = { value: Record<string, unknown> | undefined; onChange: (value: Record<string, unknown>) => void };

const presets = [
  { label: "Home", route: "/", icon: "home" },
  { label: "Discover", route: "/rooms", icon: "compass" },
  { label: "Live", route: "/live", icon: "radio" },
  { label: "Messages", route: "/messages", icon: "message-circle" },
  { label: "Profile", route: "/me", icon: "user" },
];

export function NavigationStudioPanel({ value, onChange }: Props) {
  const initial = useMemo(() => normalizeNavigation(value)[0] ?? { id: "primary-navigation", type: "bottom", items: [] }, [value]);
  const [selectedId, setSelectedId] = useState<string | null>(initial.items[0]?.id ?? null);
  const [config, setConfig] = useState<NavigationConfig>(initial);
  const selected = config.items.find((item) => item.id === selectedId) ?? null;

  function commit(next: NavigationConfig) { setConfig(next); onChange({ configs: [next] }); }
  function move(id: string, direction: -1 | 1) {
    const items = [...config.items].sort((a,b) => a.order-b.order); const i = items.findIndex(x => x.id === id); const target = i + direction;
    if (i < 0 || target < 0 || target >= items.length) return; const reordered = reorderNavigationItems(config, id, items[target].id); commit(reordered);
  }
  function addPreset() {
    const next = presets.find(p => !config.items.some(i => i.label === p.label));
    if (!next) return toast.info("All standard navigation items are already added.");
    const item = { id: `nav-${Date.now()}`, label: next.label, route: next.route, icon: next.icon, visible: true, disabled: false, order: config.items.length };
    const updated = addNavigationItem(config, item); setSelectedId(item.id); commit(updated);
  }
  function dragStart(e: React.DragEvent, id: string) { e.dataTransfer.setData("text/plain", id); }
  function drop(e: React.DragEvent, overId: string) { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id && id !== overId) commit(reorderNavigationItems(config, id, overId)); }

  return <div className="space-y-4 rounded-xl border bg-background p-4">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Navigation Studio</h3><p className="text-[11px] text-muted-foreground">Reorder and customize the real navigation without changing routes.</p></div><button onClick={addPreset} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"><Plus className="mr-1 inline h-3.5 w-3.5" />Add</button></div>
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div className="space-y-1">{config.items.sort((a,b)=>a.order-b.order).map(item => <div key={item.id} draggable onDragStart={e=>dragStart(e,item.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,item.id)} onClick={()=>setSelectedId(item.id)} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 ${selectedId===item.id?"border-primary bg-primary/5":"border-transparent hover:bg-muted"}`}><GripVertical className="h-4 w-4 text-muted-foreground" /><span className="flex-1 text-xs font-medium">{item.label}</span>{item.visible===false?<EyeOff className="h-3.5 w-3.5 text-muted-foreground"/>:<Eye className="h-3.5 w-3.5 text-muted-foreground"/>}<button onClick={e=>{e.stopPropagation();move(item.id,-1)}} className="p-1"><ChevronUp className="h-3.5 w-3.5"/></button><button onClick={e=>{e.stopPropagation();move(item.id,1)}} className="p-1"><ChevronDown className="h-3.5 w-3.5"/></button></div>)}</div>
      <div className="space-y-3 rounded-lg bg-muted/40 p-3">{selected ? <><label className="block text-[10px] font-semibold uppercase text-muted-foreground">Label<input value={selected.label} onChange={e=>commit(updateNavigationItem(config,selected.id,{label:e.target.value}))} className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-xs"/></label><label className="block text-[10px] font-semibold uppercase text-muted-foreground">Route<input value={selected.route} onChange={e=>commit(updateNavigationItem(config,selected.id,{route:e.target.value}))} className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-xs"/></label><label className="block text-[10px] font-semibold uppercase text-muted-foreground">Icon<input value={selected.icon ?? ""} onChange={e=>commit(updateNavigationItem(config,selected.id,{icon:e.target.value}))} className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-xs"/></label><label className="flex items-center justify-between text-xs"><span>Visible</span><input type="checkbox" checked={selected.visible!==false} onChange={e=>commit(updateNavigationItem(config,selected.id,{visible:e.target.checked}))}/></label><label className="flex items-center justify-between text-xs"><span>Disabled</span><input type="checkbox" checked={selected.disabled===true} onChange={e=>commit(updateNavigationItem(config,selected.id,{disabled:e.target.checked}))}/></label><button onClick={()=>{commit(removeNavigationItem(config,selected.id));setSelectedId(null)}} className="w-full rounded-lg border border-destructive/30 px-2 py-1.5 text-xs text-destructive"><Trash2 className="mr-1 inline h-3.5 w-3.5"/>Remove item</button></> : <p className="text-xs text-muted-foreground">Select a navigation item.</p>}</div>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><label className="text-[10px] uppercase text-muted-foreground">Type<select value={config.type} onChange={e=>commit({...config,type:e.target.value as NavigationConfig["type"]})} className="mt-1 w-full rounded border bg-background p-1.5 text-xs"><option value="bottom">Bottom</option><option value="top">Top</option><option value="side">Side</option><option value="tabs">Tabs</option></select></label><label className="text-[10px] uppercase text-muted-foreground">Active<input value={config.activeColor??""} onChange={e=>commit({...config,activeColor:e.target.value})} className="mt-1 w-full rounded border bg-background p-1.5 text-xs" placeholder="#8B5CF6"/></label><label className="text-[10px] uppercase text-muted-foreground">Inactive<input value={config.inactiveColor??""} onChange={e=>commit({...config,inactiveColor:e.target.value})} className="mt-1 w-full rounded border bg-background p-1.5 text-xs" placeholder="#777789"/></label><label className="text-[10px] uppercase text-muted-foreground">Gap<input value={String(config.gap??"")} onChange={e=>commit({...config,gap:e.target.value})} className="mt-1 w-full rounded border bg-background p-1.5 text-xs" placeholder="12px"/></label></div>
  </div>;
}
