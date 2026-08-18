import { useEffect, useMemo, useState } from "react";
import type { AppComponentNode, AppPageConfig } from "@/lib/app-customization/schema";
import { flattenLiveRoomRegistry, getLiveRoomRegistry, type LiveRoomComponent } from "@/lib/app-customization/live-room-registry";
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Play, Radio, Save, Sparkles } from "lucide-react";

export type LiveRoomKind = "voice-room" | "video-room" | "pk-battle";
export type LiveRoomState = "empty" | "normal" | "full" | "speaking" | "gift" | "chat" | "settings" | "camera-on" | "camera-off" | "fullscreen" | "multiple" | "waiting" | "match-found" | "countdown" | "battle-running" | "battle-ending" | "winner" | "loser";

type RegistryKind = "voice" | "video" | "pk";
const registryKind = (kind: LiveRoomKind): RegistryKind => kind === "voice-room" ? "voice" : kind === "video-room" ? "video" : "pk";
const roomLabel = (kind: LiveRoomKind) => kind === "voice-room" ? "Voice Room" : kind === "video-room" ? "Video Room" : "PK Battle";

const ROOM_STATES: Record<LiveRoomKind, { value: LiveRoomState; label: string }[]> = {
  "voice-room": ["empty", "normal", "full", "speaking", "gift", "chat", "settings"].map((value) => ({ value: value as LiveRoomState, label: value.replace("-", " ") })),
  "video-room": ["empty", "normal", "camera-on", "camera-off", "fullscreen", "multiple", "chat", "gift"].map((value) => ({ value: value as LiveRoomState, label: value.replace("-", " ") })),
  "pk-battle": ["waiting", "match-found", "countdown", "battle-running", "gift", "battle-ending", "winner", "loser"].map((value) => ({ value: value as LiveRoomState, label: value.replace("-", " ") })),
};

function cloneConfig(config: AppPageConfig): AppPageConfig { return structuredClone(config); }
function makeNode(component: LiveRoomComponent, kind: LiveRoomKind, state: LiveRoomState, index: number): AppComponentNode {
  const runtimeType = component.runtimeType ?? component.type;
  return {
    id: `${component.id}-${Date.now()}-${index}`,
    type: "custom",
    name: component.label,
    visible: true,
    locked: false,
    props: { componentId: component.id, componentType: runtimeType, label: component.label, stateful: true, roomType: kind, roomState: state, registryVersion: 1 },
    style: {},
  };
}

function ensureRegistryNodes(config: AppPageConfig, kind: LiveRoomKind, state: LiveRoomState) {
  const registry = flattenLiveRoomRegistry(registryKind(kind)).slice(1);
  const existingIds = new Set(config.sections.filter((node) => node.props?.roomType === kind).map((node) => String(node.props?.componentId ?? "")));
  const next = cloneConfig(config);
  const start = next.sections.length;
  const missing: LiveRoomComponent[] = [];
  for (const component of registry) {
    if (component.repeatable) {
      const desired = kind === "voice-room" && component.id === "voice.seat-area" ? 12 : kind === "video-room" && component.id === "video.participants" ? 6 : 1;
      const current = next.sections.filter((node) => node.props?.roomType === kind && node.props?.componentId === component.id).length;
      for (let i = current; i < desired; i++) missing.push({ ...component });
    } else if (!existingIds.has(component.id)) missing.push(component);
  }
  if (!missing.length) return config;
  next.sections = [...next.sections, ...missing.map((component, index) => {
    const node = makeNode(component, kind, state, start + index);
    const instanceIndex = next.sections.filter((item) => item.props?.roomType === kind && item.props?.componentId === component.id).length;
    return { ...node, props: { ...node.props, instanceIndex } };
  })];
  return next;
}

export function LiveRoomStudioPanel({ pageKey, config, onChange, onSaveDraft, onPublish }: { pageKey: LiveRoomKind; config: AppPageConfig; onChange: (config: AppPageConfig) => void; onSaveDraft?: () => void; onPublish?: () => void }) {
  const [kind, setKind] = useState<LiveRoomKind>(pageKey);
  const [state, setState] = useState<LiveRoomState>("normal");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const registry = useMemo(() => flattenLiveRoomRegistry(registryKind(kind)).slice(1), [kind]);
  const nodes = useMemo(() => config.sections.filter((node) => node.props?.roomType === kind), [config.sections, kind]);
  const selected = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedComponent = useMemo(() => registry.find((item) => item.id === selected?.props?.componentId) ?? null, [registry, selected]);
  const stateOptions = ROOM_STATES[kind];

  useEffect(() => { setKind(pageKey); setSelectedId(null); }, [pageKey]);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "jalwa-live-select" || typeof event.data.nodeId !== "string") return;
      setSelectedId(event.data.nodeId);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function syncRegistry() {
    const next = ensureRegistryNodes(config, kind, state);
    onChange(next);
    const first = next.sections.find((node) => node.props?.roomType === kind);
    if (first) setSelectedId(first.id);
  }
  function add(component: LiveRoomComponent) {
    const next = cloneConfig(config);
    const node = makeNode(component, kind, state, next.sections.length);
    next.sections = [...next.sections, node];
    onChange(next);
    setSelectedId(node.id);
  }
  function patchSelected(patch: Partial<AppComponentNode>) {
    if (!selected) return;
    const next = cloneConfig(config);
    next.sections = next.sections.map((node) => node.id === selected.id ? { ...node, ...patch } : node);
    onChange(next);
  }
  function patchStyle(key: string, value: string) { patchSelected({ style: { ...selected?.style, [key]: value } }); }
  function applyPreset(preset: "voice-8" | "voice-12" | "voice-16" | "video-grid" | "video-spotlight" | "pk-standard" | "pk-compact") {
    const next = cloneConfig(config);
    const root = getLiveRoomRegistry(registryKind(kind));
    const seat = root.children?.find((x) => x.id.endsWith("seat-area"));
    const tile = root.children?.find((x) => x.id.endsWith("participants"));
    const team = root.children?.find((x) => x.id.endsWith("team-a"));
    const template = kind === "voice-room" ? seat : kind === "video-room" ? tile : team;
    if (!template) return;
    const count = preset.startsWith("voice-") ? Number(preset.split("-")[1]) : preset.startsWith("video-") ? 6 : 2;
    next.sections = Array.from({ length: count }, (_, i) => {
      const node = makeNode(template, kind, state, i);
      return { ...node, props: { ...node.props, instanceIndex: i } };
    });
    onChange(next);
    setSelectedId(null);
  }

  return <div className="grid gap-4 xl:grid-cols-[230px_minmax(390px,1fr)_330px]">
    <aside className="rounded-xl border bg-background p-3">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Experiences</div>
      <div className="mt-2 grid gap-1">{(["voice-room", "video-room", "pk-battle"] as LiveRoomKind[]).map((room) => <button key={room} onClick={() => { setKind(room); setSelectedId(null); }} className={`rounded-lg px-3 py-2 text-left text-sm ${kind === room ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{roomLabel(room)}</button>)}</div>
      <div className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Room State</div>
      <select value={state} onChange={(e) => setState(e.target.value as LiveRoomState)} className="mt-2 w-full rounded-lg border bg-background p-2 text-sm">{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <div className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Presets</div>
      <div className="mt-2 grid gap-1">{kind === "voice-room" && ["voice-8","voice-12","voice-16"].map((x) => <button key={x} onClick={() => applyPreset(x as never)} className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{x.replace("voice-", "Voice ")} seats</button>)}{kind === "video-room" && ["video-grid","video-spotlight"].map((x) => <button key={x} onClick={() => applyPreset(x as never)} className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{x.replace("video-", "Video ")}</button>)}{kind === "pk-battle" && ["pk-standard","pk-compact"].map((x) => <button key={x} onClick={() => applyPreset(x as never)} className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{x.replace("pk-", "PK ")}</button>)}</div>
    </aside>

    <section className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-widest">Actual Room Layers</div><div className="text-[10px] text-muted-foreground">The real application iframe is on the left. Click its mapped components to select the same layer here.</div></div><button onClick={syncRegistry} className="rounded-lg border bg-background px-3 py-1.5 text-xs"><Sparkles className="mr-1 inline h-3.5 w-3.5" />Sync Registry</button></div>
      <div className="mx-auto flex h-[700px] w-[390px] max-w-full items-center justify-center rounded-[28px] border border-border bg-black/80 text-center text-white shadow-2xl"><div><Radio className="mx-auto h-8 w-8 opacity-70" /><div className="mt-2 text-sm font-semibold">{roomLabel(kind)}</div><div className="mt-1 max-w-[260px] text-xs text-white/60">This panel controls the real room. No fake replacement canvas is used.</div><div className="mt-4 text-[10px] text-white/40">{nodes.length} configured layers • {registry.length} registry components</div></div></div>
    </section>

    <aside className="rounded-xl border bg-background p-3">
      <div className="flex items-center justify-between"><button onClick={() => setExpanded((value) => !value)} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Layers</button><button title="Sync all real room components" onClick={syncRegistry} className="rounded border px-2 py-1 text-[10px]">Sync</button></div>
      {expanded && <div className="mt-2 max-h-72 space-y-1 overflow-auto">{registry.map((component) => { const matching = nodes.filter((item) => item.props?.componentId === component.id); return <div key={component.id} className="rounded-lg border border-transparent">{matching.length > 1 ? <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground"><GripVertical className="h-3 w-3" />{component.label} ({matching.length})</div> : null}{matching.length ? matching.map((node, index) => <button key={node.id} onClick={() => setSelectedId(node.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${node.id === selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}><GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{component.repeatable ? `${component.label} ${index + 1}` : component.label}</span><span className="text-[9px] text-emerald-600">LIVE</span></button>) : <button onClick={() => add(component)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"><Play className="h-3 w-3" />{component.label}<span className="ml-auto text-[9px] text-muted-foreground">Add</span></button>}</div>; })}</div>}

      <div className="mt-4 border-t pt-3"><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Selected Layer</div>{selected ? <div className="mt-2 space-y-2"><div className="rounded-lg bg-muted/40 p-2"><div className="text-xs font-semibold">{selectedComponent?.label ?? selected.name}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{String(selected.props?.componentId ?? "unmapped")} • instance {Number(selected.props?.instanceIndex ?? 0) + 1}</div></div><input value={selected.name ?? ""} onChange={(e) => patchSelected({ name: e.target.value })} className="w-full rounded border px-2 py-1.5 text-xs" /><div className="grid grid-cols-2 gap-2">{(["left", "top", "width", "height"] as const).map((key) => <label key={key} className="text-[10px] text-muted-foreground">{key}<input value={String(selected.style?.[key] ?? "")} onChange={(e) => patchStyle(key, e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-xs" /></label>)}</div><div className="flex gap-2"><button onClick={() => patchSelected({ visible: selected.visible === false })} className="flex-1 rounded-lg border px-2 py-1.5 text-xs">{selected.visible === false ? <><Eye className="mr-1 inline h-3 w-3" />Show</> : <><EyeOff className="mr-1 inline h-3 w-3" />Hide</>}</button><button onClick={() => patchSelected({ locked: !selected.locked })} className="flex-1 rounded-lg border px-2 py-1.5 text-xs">{selected.locked ? "Unlock" : "Lock"}</button></div><div className="rounded-lg border p-2 text-[10px] text-muted-foreground"><div className="font-semibold text-foreground">Editable properties</div><div className="mt-1 flex flex-wrap gap-1">{(selectedComponent?.editable ?? []).map((item) => <span key={item} className="rounded bg-muted px-1.5 py-0.5">{item}</span>)}</div></div></div> : <p className="mt-2 text-xs text-muted-foreground">Select a LIVE layer above or click a mapped component inside the real room iframe.</p>}</div>
      <div className="mt-4 flex gap-2"><button onClick={onSaveDraft} className="flex-1 rounded-lg border px-2 py-2 text-xs"><Save className="mr-1 inline h-3.5 w-3.5" />Save Draft</button><button onClick={onPublish} className="flex-1 rounded-lg bg-primary px-2 py-2 text-xs text-primary-foreground">Publish</button></div>
    </aside>
  </div>;
}
