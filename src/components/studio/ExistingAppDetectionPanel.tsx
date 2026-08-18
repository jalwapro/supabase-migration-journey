import { useMemo, useState } from "react";
import { Search, RefreshCw, ChevronRight, CircleDot } from "lucide-react";
import { detectExistingApp, findDetectedScreen } from "@/lib/app-customization/existing-app-detector";

export function ExistingAppDetectionPanel({ route }: { route?: string | null }) {
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const screens = useMemo(() => { void revision; return detectExistingApp(); }, [revision]);
  const screen = findDetectedScreen(screens, route || "/");
  const components = (screen?.components || []).filter((item) => `${item.name} ${item.type} ${item.source || ""} ${item.action?.target || ""}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="rounded-xl border bg-background p-3">
    <div className="mb-3 flex items-center justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Detected Existing App</p><p className="mt-1 text-xs font-semibold">{screen?.name || "No route detected"}</p></div>
      <button title="Rescan source routes" className="rounded-md border p-1.5" onClick={() => setRevision((x) => x + 1)}><RefreshCw className="h-3.5 w-3.5" /></button>
    </div>
    <div className="relative mb-2"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find detected component…" className="w-full rounded-md border py-1.5 pl-7 pr-2 text-[11px]" /></div>
    <div className="max-h-52 space-y-1 overflow-auto">
      {components.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"><CircleDot className="h-3 w-3 text-primary" /><span className="min-w-0 flex-1 truncate text-[11px]">{item.name}</span><span className="text-[9px] text-muted-foreground">{item.type}</span><ChevronRight className="h-3 w-3 text-muted-foreground" /></div>)}
      {!components.length && <p className="py-4 text-center text-[10px] text-muted-foreground">No detected components for this route.</p>}
    </div>
    <p className="mt-2 text-[9px] text-muted-foreground">Source map scans the real <code>src/routes</code> files and tracks imported Jalwa components, native controls and existing navigation handlers. It does not create mock screens.</p>
  </div>;
}
