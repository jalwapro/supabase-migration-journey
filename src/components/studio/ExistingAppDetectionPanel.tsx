import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ChevronRight, ChevronDown, CircleDot, Eye, EyeOff, Lock, Unlock, ArrowUp, ArrowDown, Pencil, Layers3 } from "lucide-react";
import { detectExistingApp, findDetectedScreen } from "@/lib/app-customization/existing-app-detector";
import { buildLayerTree, renameLayer, reorderLayer, setLayerState, type StudioLayer } from "@/lib/app-customization/layer-tree";

function LayerRow({ layer, selectedId, onSelect, onToggle, onReorder, onRename }: { layer: StudioLayer; selectedId: string | null; onSelect: (id: string) => void; onToggle: (id: string, patch: Partial<Pick<StudioLayer, "visible" | "locked" | "expanded">>) => void; onReorder: (id: string, direction: "up" | "down") => void; onRename: (id: string, name: string) => void; }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(layer.name);
  const hasChildren = layer.children.length > 0;
  const commitName = () => { onRename(layer.id, name); setEditing(false); };
  return <div>
    <div className={`group flex items-center gap-1 rounded-md px-1 py-1 ${selectedId === layer.id ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted"}`} style={{ paddingLeft: 4 + layer.depth * 14 }}>
      <button className="h-5 w-5 shrink-0" onClick={() => hasChildren && onToggle(layer.id, { expanded: !layer.expanded })}>{hasChildren ? (layer.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="inline-block w-3.5" />}</button>
      <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onSelect(layer.id)}><CircleDot className={`h-3 w-3 shrink-0 ${layer.visible ? "text-primary" : "text-muted-foreground"}`} />{editing ? <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditing(false); }} onBlur={commitName} className="min-w-0 flex-1 rounded border bg-background px-1 py-0.5 text-[10px]" /> : <span className={`min-w-0 flex-1 truncate text-[10px] ${!layer.visible ? "text-muted-foreground line-through" : ""}`}>{layer.name}</span>}</button>
      <span className="hidden max-w-20 truncate text-[8px] text-muted-foreground group-hover:inline">{layer.type}</span>
      <div className="hidden items-center gap-0.5 group-hover:flex">
        <button title="Rename" className="rounded p-1 hover:bg-background" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></button>
        <button title={layer.visible ? "Hide" : "Show"} className="rounded p-1 hover:bg-background" onClick={() => onToggle(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</button>
        <button title={layer.locked ? "Unlock" : "Lock"} className="rounded p-1 hover:bg-background" onClick={() => onToggle(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}</button>
        <button title="Move up" className="rounded p-1 hover:bg-background" onClick={() => onReorder(layer.id, "up")}><ArrowUp className="h-3 w-3" /></button>
        <button title="Move down" className="rounded p-1 hover:bg-background" onClick={() => onReorder(layer.id, "down")}><ArrowDown className="h-3 w-3" /></button>
      </div>
    </div>
    {layer.expanded && hasChildren && <div>{layer.children.map(child => <LayerRow key={child.id} layer={child} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} onReorder={onReorder} onRename={onRename} />)}</div>}
  </div>;
}

export function ExistingAppDetectionPanel({ route }: { route?: string | null }) {
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const screens = useMemo(() => { void revision; return detectExistingApp(); }, [revision]);
  const screen = findDetectedScreen(screens, route || "/");
  const [layers, setLayers] = useState<StudioLayer[]>([]);
  useEffect(() => { setLayers(screen ? buildLayerTree(screen) : []); setSelectedId(null); }, [screen?.id, revision]);

  const components = (screen?.components || []).filter((item) => `${item.name} ${item.type} ${item.source || ""} ${item.action?.target || ""}`.toLowerCase().includes(query.toLowerCase()));
  const toggleLayer = (id: string, patch: Partial<Pick<StudioLayer, "visible" | "locked" | "expanded">>) => setLayers(prev => setLayerState(prev, id, patch));
  const moveLayer = (id: string, direction: "up" | "down") => setLayers(prev => reorderLayer(prev, id, direction));
  const rename = (id: string, name: string) => setLayers(prev => renameLayer(prev, id, name));

  return <div className="rounded-xl border bg-background p-3">
    <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Detected Existing App</p><p className="mt-1 text-xs font-semibold">{screen?.name || "No route detected"}</p></div><button title="Rescan source routes" className="rounded-md border p-1.5" onClick={() => setRevision(x => x + 1)}><RefreshCw className="h-3.5 w-3.5" /></button></div>
    <div className="mb-3 rounded-lg border bg-muted/20 p-2">
      <div className="mb-2 flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-bold uppercase tracking-widest">Layers</span><span className="ml-auto text-[9px] text-muted-foreground">{layers.length} root</span></div>
      <div className="max-h-72 overflow-auto">{layers.map(layer => <LayerRow key={layer.id} layer={layer} selectedId={selectedId} onSelect={setSelectedId} onToggle={toggleLayer} onReorder={moveLayer} onRename={rename} />)}{!layers.length && <p className="py-4 text-center text-[10px] text-muted-foreground">No detected layers for this route.</p>}</div>
      {selectedId && <p className="mt-2 truncate border-t pt-2 text-[9px] text-muted-foreground">Selected: {selectedId}</p>}
    </div>
    <div className="relative mb-2"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find detected component…" className="w-full rounded-md border py-1.5 pl-7 pr-2 text-[11px]" /></div>
    <div className="max-h-40 space-y-1 overflow-auto">{components.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted ${selectedId === item.id ? "bg-primary/10" : ""}`}><CircleDot className="h-3 w-3 text-primary" /><span className="min-w-0 flex-1 truncate text-[11px]">{item.name}</span><span className="text-[9px] text-muted-foreground">{item.type}</span><ChevronRight className="h-3 w-3 text-muted-foreground" /></button>)}{!components.length && <p className="py-4 text-center text-[10px] text-muted-foreground">No detected components for this route.</p>}</div>
    <p className="mt-2 text-[9px] text-muted-foreground">Layers are generated from the real source map. Rename, hide, lock, expand/collapse and reorder operate on the detected layer tree without changing business logic.</p>
  </div>;
}
