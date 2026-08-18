import { useMemo, useState } from "react";
import type { AppComponentNode, AppPageConfig, AppPageKey } from "@/lib/app-customization/schema";
import { Activity, AudioLines, Camera, Crown, Gift, Grip, MessageCircle, Mic, MoreHorizontal, Play, Radio, RotateCcw, Share2, Sparkles, Timer, Trophy, UserRound, Video, X } from "lucide-react";

export type LiveRoomKind = "voice-room" | "video-room" | "pk-battle";
export type LiveRoomState = "empty" | "normal" | "full" | "speaking" | "gift" | "chat" | "settings" | "camera-on" | "camera-off" | "fullscreen" | "multiple" | "waiting" | "match-found" | "countdown" | "battle-running" | "battle-ending" | "winner" | "loser";

type RoomComponent = { id: string; type: string; label: string; group: string; required?: boolean };

const ROOM_COMPONENTS: RoomComponent[] = [
  { id: "room-header", type: "room-header", label: "Room Header", group: "Common", required: true },
  { id: "room-info", type: "room-info", label: "Room Information", group: "Common" },
  { id: "room-chat", type: "room-chat", label: "Chat", group: "Common" },
  { id: "room-gifts", type: "gift-notifications", label: "Gift Notifications", group: "Common" },
  { id: "room-announcement", type: "room-announcement", label: "Announcement", group: "Common" },
  { id: "room-controls", type: "room-controls", label: "Room Controls", group: "Common" },
  { id: "voice-seat", type: "voice-seat", label: "Voice Seat", group: "Voice" },
  { id: "host-card", type: "host-card", label: "Host Card", group: "Voice" },
  { id: "waveform", type: "waveform", label: "Audio Waveform", group: "Voice" },
  { id: "mic-control", type: "mic-control", label: "Microphone", group: "Voice" },
  { id: "mute-all", type: "mute-all", label: "Mute All", group: "Voice" },
  { id: "video-tile", type: "video-tile", label: "Video Tile", group: "Video" },
  { id: "video-grid", type: "video-grid", label: "Video Grid", group: "Video" },
  { id: "camera-control", type: "camera-control", label: "Camera", group: "Video" },
  { id: "active-speaker", type: "active-speaker", label: "Active Speaker", group: "Video" },
  { id: "pk-team-a", type: "pk-team-a", label: "PK Team A", group: "PK" },
  { id: "pk-team-b", type: "pk-team-b", label: "PK Team B", group: "PK" },
  { id: "pk-score", type: "pk-score", label: "PK Score", group: "PK" },
  { id: "pk-vs", type: "pk-vs", label: "VS Graphic", group: "PK" },
  { id: "pk-timer", type: "pk-timer", label: "PK Timer", group: "PK" },
  { id: "pk-progress", type: "pk-progress", label: "Battle Progress", group: "PK" },
  { id: "winner-overlay", type: "winner-overlay", label: "Winner Overlay", group: "PK" },
];

const ROOM_STATES: Record<LiveRoomKind, { value: LiveRoomState; label: string }[]> = {
  "voice-room": ["empty", "normal", "full", "speaking", "gift", "chat", "settings"].map((value) => ({ value: value as LiveRoomState, label: value.replace("-", " ") })),
  "video-room": ["empty", "normal", "camera-on", "camera-off", "fullscreen", "multiple", "chat", "gift"].map((value) => ({ value: value as LiveRoomState, label: value.replace("-", " ") })),
  "pk-battle": ["waiting", "match-found", "countdown", "battle-running", "gift", "battle-ending", "winner", "loser"].map((value) => ({ value: value as LiveRoomState, label: value.replace("-", " ") })),
};

function cloneConfig(config: AppPageConfig): AppPageConfig { return structuredClone(config); }
function makeRoomNode(component: RoomComponent, index: number): AppComponentNode {
  return { id: `${component.type}-${Date.now()}-${index}`, type: "custom", name: component.label, visible: true, locked: Boolean(component.required), props: { componentType: component.type, label: component.label, stateful: true }, style: { position: "absolute", left: `${20 + (index % 4) * 80}px`, top: `${30 + Math.floor(index / 4) * 70}px`, width: component.type.includes("team") ? "150px" : component.type === "video-tile" ? "140px" : "120px", minHeight: 44, padding: "8px", borderRadius: 12, zIndex: index + 1 } };
}

function RoomPreview({ kind, state, nodes, selectedId, onSelect }: { kind: LiveRoomKind; state: LiveRoomState; nodes: AppComponentNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const seats = kind === "voice-room" ? 12 : 0;
  return <div className="relative h-[700px] w-[390px] max-w-full overflow-hidden rounded-[28px] border border-border bg-black shadow-2xl" aria-label={`${kind} live component preview`}>
    <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-950 to-black" />
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-white/15"><Radio className="h-4 w-4" /></div><div><div className="text-xs font-semibold">Jalwa Live Room</div><div className="text-[10px] opacity-60">LIVE • {kind.replace("-", " ")}</div></div></div><div className="flex gap-2"><Share2 className="h-4 w-4" /><MoreHorizontal className="h-4 w-4" /><X className="h-4 w-4" /></div></div>
      <div className="flex-1 overflow-hidden p-3">
        {kind === "voice-room" && <div className="grid grid-cols-4 gap-3 pt-5">{Array.from({ length: seats }).map((_, i) => <div key={i} className="flex flex-col items-center gap-1"><div className="relative grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10"><UserRound className="h-5 w-5 text-white/70" />{i === 0 && <Crown className="absolute -top-2 -right-1 h-4 w-4 text-yellow-300" />}</div><span className="max-w-16 truncate text-[9px] text-white/70">User {i + 1}</span></div>)}</div>}
        {kind === "video-room" && <div className="grid grid-cols-2 gap-2 pt-3">{Array.from({ length: state === "multiple" ? 6 : 4 }).map((_, i) => <div key={i} className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-700/60"><Video className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white/40" /><span className="absolute bottom-1 left-2 text-[9px] text-white">Participant {i + 1}</span>{i === 0 && <Mic className="absolute bottom-1 right-2 h-3 w-3 text-white" />}</div>)}</div>}
        {kind === "pk-battle" && <div className="pt-10"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="rounded-xl border border-white/10 bg-white/10 p-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10"><Video className="h-6 w-6 text-white/50" /></div><p className="mt-2 text-xs text-white">Team A</p><strong className="text-lg text-white">1,250</strong></div><div className="text-center text-white"><Sparkles className="mx-auto h-6 w-6" /><div className="mt-1 text-xl font-black">VS</div><div className="mt-2 rounded-full bg-white/10 px-2 py-1 text-[10px]"><Timer className="mr-1 inline h-3 w-3" /> 02:18</div></div><div className="rounded-xl border border-white/10 bg-white/10 p-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10"><Video className="h-6 w-6 text-white/50" /></div><p className="mt-2 text-xs text-white">Team B</p><strong className="text-lg text-white">980</strong></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[58%] rounded-full bg-primary" /></div>{state === "winner" && <div className="mt-10 rounded-2xl border border-yellow-300/30 bg-yellow-300/10 p-5 text-center text-white"><Trophy className="mx-auto h-8 w-8 text-yellow-300" /><div className="mt-2 font-bold">Team A Wins</div></div>}</div>}
        <div className="pointer-events-none absolute inset-0">
          {nodes.map((node) => <button key={node.id} type="button" onClick={() => onSelect(node.id)} className={`pointer-events-auto absolute border ${selectedId === node.id ? "border-primary ring-2 ring-primary/40" : "border-transparent"}`} style={{ left: node.style?.left as string | number, top: node.style?.top as string | number, width: node.style?.width as string | number, height: node.style?.height as string | number, zIndex: Number(node.style?.zIndex ?? 20), display: node.visible === false ? "none" : undefined }}><span className="sr-only">{node.name}</span></button>)}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 border-t border-white/10 bg-black/30 px-3 py-3 text-white"><button><Gift className="mx-auto h-4 w-4" /></button><button><Mic className="mx-auto h-4 w-4" /></button><button><MessageCircle className="mx-auto h-4 w-4" /></button><button><AudioLines className="mx-auto h-4 w-4" /></button><button><MoreHorizontal className="mx-auto h-4 w-4" /></button></div>
    </div>
  </div>;
}

export function LiveRoomStudioPanel({ pageKey, config, onChange, onSaveDraft, onPublish }: { pageKey: LiveRoomKind; config: AppPageConfig; onChange: (config: AppPageConfig) => void; onSaveDraft?: () => void; onPublish?: () => void }) {
  const [kind, setKind] = useState<LiveRoomKind>(pageKey);
  const [state, setState] = useState<LiveRoomState>("normal");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nodes = config.sections.filter((node) => node.props?.roomType === kind || node.props?.roomType == null);
  const selected = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId]);
  const stateOptions = ROOM_STATES[kind];
  const components = ROOM_COMPONENTS.filter((component) => component.group === "Common" || (kind === "voice-room" && component.group === "Voice") || (kind === "video-room" && component.group === "Video") || (kind === "pk-battle" && component.group === "PK"));

  function add(component: RoomComponent) { const next = cloneConfig(config); const node = makeRoomNode(component, next.sections.length); node.props = { ...node.props, roomType: kind, roomState: state }; next.sections = [...next.sections, node]; onChange(next); setSelectedId(node.id); }
  function patchSelected(patch: Partial<AppComponentNode>) { if (!selected) return; const next = cloneConfig(config); next.sections = next.sections.map((node) => node.id === selected.id ? { ...node, ...patch } : node); onChange(next); }
  function patchStyle(key: string, value: string) { if (!selected) return; patchSelected({ style: { ...selected.style, [key]: value } }); }
  function applyPreset(preset: "voice-8" | "voice-12" | "voice-16" | "video-grid" | "video-spotlight" | "pk-standard" | "pk-compact") { const next = cloneConfig(config); const count = preset.startsWith("voice-") ? Number(preset.split("-")[1]) : preset.startsWith("video-") ? 6 : 3; next.sections = Array.from({ length: count }, (_, i) => makeRoomNode(preset.startsWith("voice-") ? ROOM_COMPONENTS.find((x) => x.type === "voice-seat")! : preset.startsWith("video-") ? ROOM_COMPONENTS.find((x) => x.type === "video-tile")! : ROOM_COMPONENTS.find((x) => x.type === "pk-team-a")!, i)).map((node) => ({ ...node, props: { ...node.props, roomType: kind, roomState: state } })); onChange(next); setSelectedId(null); }

  return <div className="grid gap-4 xl:grid-cols-[240px_minmax(390px,1fr)_300px]">
    <aside className="rounded-xl border bg-background p-3"><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Rooms</div><div className="mt-2 grid gap-1">{(["voice-room", "video-room", "pk-battle"] as LiveRoomKind[]).map((room) => <button key={room} onClick={() => { setKind(room); setSelectedId(null); }} className={`rounded-lg px-3 py-2 text-left text-sm ${kind === room ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{room === "voice-room" ? "Voice Room" : room === "video-room" ? "Video Room" : "PK Battle"}</button>)}</div><div className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Room State</div><select value={state} onChange={(e) => setState(e.target.value as LiveRoomState)} className="mt-2 w-full rounded-lg border bg-background p-2 text-sm">{stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Presets</div><div className="mt-2 grid gap-1">{kind === "voice-room" && ["voice-8","voice-12","voice-16"].map((x) => <button key={x} onClick={() => applyPreset(x as never)} className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{x.replace("voice-", "Voice ")} seats</button>)}{kind === "video-room" && ["video-grid","video-spotlight"].map((x) => <button key={x} onClick={() => applyPreset(x as never)} className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{x.replace("video-", "Video ")}</button>)}{kind === "pk-battle" && ["pk-standard","pk-compact"].map((x) => <button key={x} onClick={() => applyPreset(x as never)} className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{x.replace("pk-", "PK ")}</button>)}</div></aside>
    <section className="flex justify-center rounded-xl border bg-muted/20 p-4"><RoomPreview kind={kind} state={state} nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} /></section>
    <aside className="rounded-xl border bg-background p-3"><div className="flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Components</div><Grip className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2 max-h-56 space-y-1 overflow-auto">{components.map((component) => <button key={component.id} onClick={() => add(component)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"><Play className="h-3 w-3" />{component.label}</button>)}</div><div className="mt-4 border-t pt-3"><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Selected</div>{selected ? <div className="mt-2 space-y-2"><input value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })} className="w-full rounded border px-2 py-1.5 text-xs" /><label className="block text-[10px] text-muted-foreground">X<input value={String(selected.style?.left ?? "0")} onChange={(e) => patchStyle("left", e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-xs" /></label><label className="block text-[10px] text-muted-foreground">Y<input value={String(selected.style?.top ?? "0")} onChange={(e) => patchStyle("top", e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-xs" /></label><label className="block text-[10px] text-muted-foreground">Width<input value={String(selected.style?.width ?? "120px")} onChange={(e) => patchStyle("width", e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-xs" /></label><label className="block text-[10px] text-muted-foreground">Height<input value={String(selected.style?.height ?? "44px")} onChange={(e) => patchStyle("height", e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-xs" /></label><button onClick={() => patchSelected({ visible: selected.visible === false })} className="w-full rounded-lg border px-2 py-1.5 text-xs">{selected.visible === false ? "Show" : "Hide"}</button></div> : <p className="mt-2 text-xs text-muted-foreground">Select a live-room component on the canvas.</p>}</div><div className="mt-4 flex gap-2"><button onClick={onSaveDraft} className="flex-1 rounded-lg border px-2 py-2 text-xs">Save Draft</button><button onClick={onPublish} className="flex-1 rounded-lg bg-primary px-2 py-2 text-xs text-primary-foreground">Publish</button></div></aside>
  </div>;
}
