import { Eye, EyeOff, GripVertical, Lock, Unlock } from "lucide-react";
import type { AppComponentNode } from "@/lib/app-customization/schema";

type Props = { nodes: AppComponentNode[]; selectedId: string | null; onSelect: (id: string) => void; onChange: (id: string, patch: Partial<AppComponentNode>) => void };

export function StudioLayersPanel({ nodes, selectedId, onSelect, onChange }: Props) {
  return <div className="space-y-1">{nodes.map((node, index) => <div key={node.id} className={`group flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ${selectedId === node.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}><GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" /><button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(node.id)}>{node.name ?? node.type}</button><button title={node.visible === false ? "Show" : "Hide"} onClick={() => onChange(node.id, { visible: node.visible === false })}>{node.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button><button title={node.locked ? "Unlock" : "Lock"} onClick={() => onChange(node.id, { locked: !node.locked })}>{node.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button><span className="hidden text-[9px] text-muted-foreground group-hover:inline">#{index + 1}</span></div>)}</div>;
}
