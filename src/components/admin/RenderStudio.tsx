/**
 * RenderStudio — shared visual editor used by both the Gift Studio and the
 * Room Entrance Studio. Everything the admin changes here is stored in the
 * item's `render_config` jsonb and applied live in rooms with no code change.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2, RotateCcw, Save, Undo2, Redo2, Search, Download, Upload, Copy,
  Crosshair, FlipHorizontal, FlipVertical,
} from "lucide-react";
import GiftGLVideo from "@/components/room/GiftGLVideo";
import {
  DEFAULT_GIFT_RENDER,
  diffRenderConfig,
  normalizeRenderConfig,
  renderConfigToStyle,
  OBJECT_FIT,
  type GiftRenderConfig,
  type GiftAnchor,
  type GiftLayer,
  type GiftFitMode,
  type ChromaMode,
} from "@/lib/giftRender";

export type StudioItem = {
  id: string;
  name: string;
  category?: string | null;
  clipUrl: string | null;
  render_config: unknown;
};

const FITS: GiftFitMode[] = ["contain", "cover", "fill", "original", "stretch"];
const LAYERS: GiftLayer[] = ["behind-user", "behind-chat", "center", "above-user", "fullscreen", "top"];
const ANCHORS: GiftAnchor[] = ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right", "custom"];
const CHROMA: ChromaMode[] = ["off", "auto", "green", "blue", "black", "white"];
const UNITS = ["percent", "px"] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SliderRow({
  label, value, min, max, step = 1, onChange, suffix = "",
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-3">
        <Slider className="flex-1" min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v ?? value)} />
        <span className="w-16 shrink-0 text-right font-mono text-[11px] text-foreground/80">
          {Number(value.toFixed(2))}{suffix}
        </span>
      </div>
    </Row>
  );
}

function SelectRow<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <Row label={label}>
      <select
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Row>
  );
}

export default function RenderStudio({
  items,
  isLoading,
  onSave,
  searchPlaceholder = "Search…",
  emptyLabel = "No clip on this item",
}: {
  items: StudioItem[];
  isLoading?: boolean;
  /** Persist the diffed config for an item. */
  onSave: (id: string, config: Record<string, unknown>) => Promise<void>;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cfg, setCfgState] = useState<GiftRenderConfig>(DEFAULT_GIFT_RENDER);
  const [dirty, setDirty] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [safeAreaOn, setSafeAreaOn] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const undoStack = useRef<GiftRenderConfig[]>([]);
  const redoStack = useRef<GiftRenderConfig[]>([]);

  const { data: presets = [] } = useQuery({
    queryKey: ["admin", "render-studio", "presets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gift_render_presets").select("id,name,config").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; config: unknown }[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter((g) => g.name.toLowerCase().includes(q) || (g.category ?? "").toLowerCase().includes(q))
      : items;
  }, [items, search]);

  const selected = useMemo(() => items.find((g) => g.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    if (!selectedId && filtered.length) setSelectedId(filtered[0]!.id);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selected) return;
    undoStack.current = [];
    redoStack.current = [];
    setCfgState(normalizeRenderConfig(selected.render_config));
    setDirty(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCfg = useCallback((patch: Partial<GiftRenderConfig>) => {
    setCfgState((prev) => {
      undoStack.current.push(prev);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      return { ...prev, ...patch };
    });
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setCfgState((cur) => { redoStack.current.push(cur); return prev; });
    setDirty(true);
  }, []);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setCfgState((cur) => { undoStack.current.push(cur); return next; });
    setDirty(true);
  }, []);

  const save = useMutation({
    mutationFn: async (config: GiftRenderConfig) => {
      if (!selectedId) throw new Error("Nothing selected");
      // Always save the full config to ensure Gift Studio settings are applied
      await onSave(selectedId, config as unknown as Record<string, unknown>);
    },
    onSuccess: () => setDirty(false),
    onError: (e: Error) => toast.error(e.message),
  });

  // --- auto save (debounced) ---
  useEffect(() => {
    if (!dirty || !selectedId) return;
    const t = setTimeout(() => save.mutate(cfg), 1200);
    return () => clearTimeout(t);
  }, [cfg, dirty, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- keyboard undo/redo ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); save.mutate(cfg); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- drag / resize / rotate in the preview ---
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize" | "rotate"; x: number; y: number; cfg: GiftRenderConfig } | null>(null);

  const onPointerDown = (mode: "move" | "resize" | "rotate") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, x: e.clientX, y: e.clientY, cfg };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const stage = stageRef.current;
    if (d.mode === "move") {
      const percent = d.cfg.positionUnit === "percent";
      const rx = percent ? (stage ? 100 / stage.clientWidth : 0.3) : (stage ? 1080 / stage.clientWidth : 1);
      const ry = percent ? (stage ? 100 / stage.clientHeight : 0.3) : (stage ? 1080 / stage.clientWidth : 1);
      const snap = (v: number) => (Math.abs(v) < (percent ? 1.5 : 12) ? 0 : Number(v.toFixed(percent ? 2 : 0)));
      setCfgState({ ...d.cfg, positionX: snap(d.cfg.positionX + dx * rx), positionY: snap(d.cfg.positionY + dy * ry) });
      setDirty(true);
    } else if (d.mode === "resize") {
      const next = Math.max(0.1, Math.min(3, d.cfg.scale + (dx + dy) * 0.004));
      setCfgState({ ...d.cfg, scale: Number(next.toFixed(3)) });
      setDirty(true);
    } else {
      const next = Math.max(-180, Math.min(180, Math.round(d.cfg.rotation + dx * 0.5)));
      setCfgState({ ...d.cfg, rotation: next });
      setDirty(true);
    }
  };
  const onPointerUp = () => {
    if (dragRef.current) undoStack.current.push(dragRef.current.cfg);
    dragRef.current = null;
  };

  const clipUrl = selected?.clipUrl ?? null;
  const isVideo = !!clipUrl && /\.(mp4|webm|mov)(\?|$)/i.test(clipUrl);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(diffRenderConfig(cfg), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected?.name ?? "item"}-render.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setCfg(normalizeRenderConfig(JSON.parse(await file.text())));
        toast.success("Preset imported");
      } catch { toast.error("Invalid JSON"); }
    };
    input.click();
  };

  const savePreset = async () => {
    const name = window.prompt("Preset name");
    if (!name) return;
    const { error } = await supabase.from("gift_render_presets").upsert(
      { name, config: diffRenderConfig(cfg) } as never,
      { onConflict: "name" },
    );
    if (error) return toast.error(error.message);
    toast.success("Preset saved");
    qc.invalidateQueries({ queryKey: ["admin", "render-studio", "presets"] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,380px)_minmax(0,1fr)]">
      {/* ---------- item list ---------- */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {isLoading && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />}
          {filtered.map((g) => {
            const configured = !!g.render_config && Object.keys(g.render_config as object).length > 0;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                  selectedId === g.id ? "bg-primary/20 text-foreground" : "hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                <span className="flex-1 truncate">{g.name}</span>
                {configured && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- live preview ---------- */}
      <div className="space-y-3">
        <div
          ref={stageRef}
          className={`relative mx-auto w-full overflow-hidden rounded-[28px] border-4 border-neutral-800 bg-neutral-950 shadow-2xl ${
            device === "mobile" ? "aspect-[9/16] max-w-[340px]" : "aspect-[16/9] max-w-[560px]"
          }`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* live room simulation */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,#3b1060_0%,#0a0512_70%)]" />
          <div className="absolute left-3 right-3 top-3 flex items-center gap-2 text-[10px] text-white/70">
            <div className="h-6 w-6 rounded-full bg-white/20" /> Host · Live room
          </div>
          <div className="absolute left-1/2 top-[30%] h-20 w-20 -translate-x-1/2 rounded-full border-2 border-amber-300/60 bg-white/10" />
          <div className="absolute bottom-3 left-3 right-3 space-y-1 text-[10px] text-white/50">
            <div className="rounded bg-white/10 px-2 py-1">viewer: nice one 🔥</div>
            <div className="rounded bg-white/10 px-2 py-1">viewer: wow</div>
          </div>

          {showGrid && (
            <div className="pointer-events-none absolute inset-0 z-[300] opacity-40"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.16) 1px,transparent 1px)", backgroundSize: "33.33% 33.33%" }} />
          )}
          {safeAreaOn && (
            <div className="pointer-events-none absolute z-[301] border border-dashed border-emerald-400/60"
              style={{
                top: `${cfg.safeAreaTop}%`, bottom: `${cfg.safeAreaBottom}%`,
                left: `${cfg.safeAreaLeft}%`, right: `${cfg.safeAreaRight}%`,
              }} />
          )}

          {/* the asset itself */}
          {clipUrl && isVideo ? (
            <div style={renderConfigToStyle(cfg)}>
              <GiftGLVideo
                key={`${clipUrl}-${replayKey}`}
                src={clipUrl}
                config={cfg}
                loop
                muted
                objectFit={OBJECT_FIT[cfg.fit]}
                className="h-full w-full"
              />
            </div>
          ) : clipUrl ? (
            <img alt="" src={clipUrl} style={{ ...renderConfigToStyle(cfg), objectFit: OBJECT_FIT[cfg.fit] }} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-white/40">{emptyLabel}</div>
          )}

          {/* drag / resize / rotate handles */}
          <div className="absolute inset-0 z-[400]" style={{ pointerEvents: "none" }}>
            <div
              className="absolute cursor-move rounded border border-cyan-400/80"
              style={{ ...(renderConfigToStyle(cfg) as React.CSSProperties), pointerEvents: "auto", opacity: 1, zIndex: 400 }}
              onPointerDown={onPointerDown("move")}
            >
              <div
                className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-white bg-cyan-400"
                onPointerDown={onPointerDown("resize")}
              />
              <div
                className="absolute -top-6 left-1/2 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border border-white bg-amber-400"
                onPointerDown={onPointerDown("rotate")}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setReplayKey((k) => k + 1)}>Replay</Button>
          <Button size="sm" variant="outline" onClick={() => setDevice((d) => (d === "mobile" ? "desktop" : "mobile"))}>
            {device === "mobile" ? "Mobile" : "Desktop"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowGrid((v) => !v)}>Grid</Button>
          <Button size="sm" variant="outline" onClick={() => setSafeAreaOn((v) => !v)}>Safe area</Button>
          <Button size="sm" variant="outline" onClick={undo}><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={redo}><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => save.mutate(cfg)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1">{dirty ? "Save" : "Saved"}</span>
          </Button>
        </div>
      </div>

      {/* ---------- controls ---------- */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{selected?.name ?? "—"}</span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={savePreset}><Copy className="mr-1 h-3.5 w-3.5" />Preset</Button>
            <Button size="sm" variant="outline" onClick={exportJson}><Download className="mr-1 h-3.5 w-3.5" />Export</Button>
            <Button size="sm" variant="outline" onClick={importJson}><Upload className="mr-1 h-3.5 w-3.5" />Import</Button>
            <Button size="sm" variant="outline" onClick={() => setCfg(DEFAULT_GIFT_RENDER)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>
          </div>
        </div>

        {presets.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button key={p.id} onClick={() => setCfg(normalizeRenderConfig(p.config))}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted">
                {p.name}
              </button>
            ))}
          </div>
        )}

        <Tabs defaultValue="transform">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="transform">Transform</TabsTrigger>
            <TabsTrigger value="crop">Crop</TabsTrigger>
            <TabsTrigger value="chroma">Chroma</TabsTrigger>
            <TabsTrigger value="color">Colour</TabsTrigger>
            <TabsTrigger value="blur">Blur</TabsTrigger>
            <TabsTrigger value="layer">Layer</TabsTrigger>
            <TabsTrigger value="timing">Timing</TabsTrigger>
          </TabsList>

          <TabsContent value="transform" className="max-h-[62vh] overflow-y-auto pr-1">
            <Row label="Width (px)">
              <Input type="number" value={cfg.width ?? ""} placeholder="auto"
                onChange={(e) => setCfg({ width: e.target.value === "" ? null : Number(e.target.value) })} />
            </Row>
            <Row label="Height (px)">
              <Input type="number" value={cfg.height ?? ""} placeholder="auto"
                onChange={(e) => setCfg({ height: e.target.value === "" ? null : Number(e.target.value) })} />
            </Row>
            <SelectRow label="Fit mode" value={cfg.fit} options={FITS} onChange={(v) => setCfg({ fit: v })} />
            <SliderRow label="Scale" value={cfg.scale} min={0.1} max={3} step={0.01} onChange={(v) => setCfg({ scale: v })} suffix="x" />
            <SliderRow label="Scale X" value={cfg.scaleX} min={0.1} max={3} step={0.01} onChange={(v) => setCfg({ scaleX: v })} />
            <SliderRow label="Scale Y" value={cfg.scaleY} min={0.1} max={3} step={0.01} onChange={(v) => setCfg({ scaleY: v })} />
            <SliderRow label="Zoom" value={cfg.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setCfg({ zoom: v })} suffix="x" />
            <SelectRow label="Position unit" value={cfg.positionUnit} options={UNITS} onChange={(v) => setCfg({ positionUnit: v, positionX: 0, positionY: 0 })} />
            {cfg.positionUnit === "percent" ? (
              <>
                <SliderRow label="Position X" value={cfg.positionX} min={-50} max={50} step={0.5} onChange={(v) => setCfg({ positionX: v })} suffix="%" />
                <SliderRow label="Position Y" value={cfg.positionY} min={-50} max={50} step={0.5} onChange={(v) => setCfg({ positionY: v })} suffix="%" />
              </>
            ) : (
              <>
                <SliderRow label="Position X" value={cfg.positionX} min={-800} max={800} onChange={(v) => setCfg({ positionX: v })} suffix="px" />
                <SliderRow label="Position Y" value={cfg.positionY} min={-800} max={800} onChange={(v) => setCfg({ positionY: v })} suffix="px" />
              </>
            )}
            <SelectRow label="Anchor" value={cfg.anchor} options={ANCHORS} onChange={(v) => setCfg({ anchor: v })} />
            <SliderRow label="Rotation" value={cfg.rotation} min={-180} max={180} onChange={(v) => setCfg({ rotation: v })} suffix="°" />
            <SliderRow label="Opacity" value={cfg.opacity} min={0} max={100} onChange={(v) => setCfg({ opacity: v })} suffix="%" />
            <Row label="Flip">
              <div className="flex gap-2">
                <Button size="sm" variant={cfg.flipH ? "default" : "outline"} onClick={() => setCfg({ flipH: !cfg.flipH })}>
                  <FlipHorizontal className="mr-1 h-4 w-4" />H
                </Button>
                <Button size="sm" variant={cfg.flipV ? "default" : "outline"} onClick={() => setCfg({ flipV: !cfg.flipV })}>
                  <FlipVertical className="mr-1 h-4 w-4" />V
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCfg({ positionX: 0, positionY: 0, rotation: 0 })}>
                  <Crosshair className="mr-1 h-4 w-4" />Center
                </Button>
              </div>
            </Row>
            <SliderRow label="Safe top" value={cfg.safeAreaTop} min={0} max={40} onChange={(v) => setCfg({ safeAreaTop: v })} suffix="%" />
            <SliderRow label="Safe bottom" value={cfg.safeAreaBottom} min={0} max={40} onChange={(v) => setCfg({ safeAreaBottom: v })} suffix="%" />
            <SliderRow label="Safe left" value={cfg.safeAreaLeft} min={0} max={40} onChange={(v) => setCfg({ safeAreaLeft: v })} suffix="%" />
            <SliderRow label="Safe right" value={cfg.safeAreaRight} min={0} max={40} onChange={(v) => setCfg({ safeAreaRight: v })} suffix="%" />
          </TabsContent>

          <TabsContent value="crop" className="max-h-[62vh] overflow-y-auto pr-1">
            <SliderRow label="Crop top" value={cfg.cropTop} min={0} max={600} onChange={(v) => setCfg({ cropTop: v })} suffix="px" />
            <SliderRow label="Crop bottom" value={cfg.cropBottom} min={0} max={600} onChange={(v) => setCfg({ cropBottom: v })} suffix="px" />
            <SliderRow label="Crop left" value={cfg.cropLeft} min={0} max={600} onChange={(v) => setCfg({ cropLeft: v })} suffix="px" />
            <SliderRow label="Crop right" value={cfg.cropRight} min={0} max={600} onChange={(v) => setCfg({ cropRight: v })} suffix="px" />
            <Button size="sm" variant="outline" onClick={() => setCfg({ cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 })}>Reset crop</Button>
          </TabsContent>

          <TabsContent value="chroma" className="max-h-[62vh] overflow-y-auto pr-1">
            <SelectRow label="Mode" value={cfg.chromaMode} options={CHROMA} onChange={(v) => setCfg({ chromaMode: v })} />
            <Row label="Key colour">
              <Input type="color" className="h-9 w-16 p-1" value={cfg.keyColor} onChange={(e) => setCfg({ keyColor: e.target.value })} />
            </Row>
            <SliderRow label="Tolerance" value={cfg.greenTolerance} min={0} max={100} onChange={(v) => setCfg({ greenTolerance: v })} />
            <SliderRow label="Edge softness" value={cfg.edgeSoftness} min={0} max={100} onChange={(v) => setCfg({ edgeSoftness: v })} />
            <SliderRow label="Spill suppress" value={cfg.spillSuppression} min={0} max={100} onChange={(v) => setCfg({ spillSuppression: v })} />
            <SliderRow label="Shadow protect" value={cfg.shadowProtection} min={0} max={100} onChange={(v) => setCfg({ shadowProtection: v })} />
            <SliderRow label="Colour recovery" value={cfg.colorRecovery} min={0} max={100} onChange={(v) => setCfg({ colorRecovery: v })} />
            <SliderRow label="Contrast recovery" value={cfg.contrastRecovery} min={0} max={100} onChange={(v) => setCfg({ contrastRecovery: v })} />
            <SliderRow label="Edge cleanup" value={cfg.edgeCleanup} min={0} max={100} onChange={(v) => setCfg({ edgeCleanup: v })} />
            <SliderRow label="Sharpness" value={cfg.sharpness} min={0} max={100} onChange={(v) => setCfg({ sharpness: v })} />
            <SliderRow label="Noise reduction" value={cfg.denoise} min={0} max={100} onChange={(v) => setCfg({ denoise: v })} />
          </TabsContent>

          <TabsContent value="color" className="max-h-[62vh] overflow-y-auto pr-1">
            <SliderRow label="Brightness" value={cfg.brightness} min={-100} max={100} onChange={(v) => setCfg({ brightness: v })} />
            <SliderRow label="Contrast" value={cfg.contrast} min={-100} max={100} onChange={(v) => setCfg({ contrast: v })} />
            <SliderRow label="Saturation" value={cfg.saturation} min={0} max={2} step={0.01} onChange={(v) => setCfg({ saturation: v })} />
            <SliderRow label="Temperature" value={cfg.temperature} min={-100} max={100} onChange={(v) => setCfg({ temperature: v })} />
            <SliderRow label="Tint" value={cfg.tint} min={-100} max={100} onChange={(v) => setCfg({ tint: v })} />
            <SliderRow label="Highlights" value={cfg.highlights} min={-100} max={100} onChange={(v) => setCfg({ highlights: v })} />
            <SliderRow label="Shadows" value={cfg.shadows} min={-100} max={100} onChange={(v) => setCfg({ shadows: v })} />
            <SliderRow label="Exposure" value={cfg.exposure} min={-100} max={100} onChange={(v) => setCfg({ exposure: v })} />
            <SliderRow label="Gamma" value={cfg.gamma} min={0.2} max={3} step={0.01} onChange={(v) => setCfg({ gamma: v })} />
            <SliderRow label="Hue" value={cfg.hue} min={-180} max={180} onChange={(v) => setCfg({ hue: v })} suffix="°" />
            <Button size="sm" variant="outline" onClick={() => setCfg({
              brightness: 0, contrast: 0, saturation: 1, temperature: 0, tint: 0,
              highlights: 0, shadows: 0, exposure: 0, gamma: 1, hue: 0,
            })}>Reset colour</Button>
          </TabsContent>

          <TabsContent value="blur" className="max-h-[62vh] overflow-y-auto pr-1">
            <SliderRow label="Top mask" value={cfg.blurTop} min={0} max={100} onChange={(v) => setCfg({ blurTop: v })} suffix="%" />
            <SliderRow label="Bottom mask" value={cfg.blurBottom} min={0} max={100} onChange={(v) => setCfg({ blurBottom: v })} suffix="%" />
            <SliderRow label="Left mask" value={cfg.blurLeft} min={0} max={100} onChange={(v) => setCfg({ blurLeft: v })} suffix="%" />
            <SliderRow label="Right mask" value={cfg.blurRight} min={0} max={100} onChange={(v) => setCfg({ blurRight: v })} suffix="%" />
            <SliderRow label="Blur radius" value={cfg.blurRadius} min={0} max={100} onChange={(v) => setCfg({ blurRadius: v })} />
            <SliderRow label="Feather" value={cfg.blurFeather} min={0} max={100} onChange={(v) => setCfg({ blurFeather: v })} />
          </TabsContent>

          <TabsContent value="layer" className="max-h-[62vh] overflow-y-auto pr-1">
            <SelectRow label="Layer" value={cfg.layer} options={LAYERS} onChange={(v) => setCfg({ layer: v })} />
            <SliderRow label="Priority" value={cfg.priority} min={0} max={100} onChange={(v) => setCfg({ priority: v })} />
          </TabsContent>

          <TabsContent value="timing" className="max-h-[62vh] overflow-y-auto pr-1">
            <SliderRow label="Start delay" value={cfg.delayMs} min={0} max={5000} step={50} onChange={(v) => setCfg({ delayMs: v })} suffix="ms" />
            <SliderRow label="Hold at end" value={cfg.holdMs} min={0} max={5000} step={50} onChange={(v) => setCfg({ holdMs: v })} suffix="ms" />
            <Row label="End after (ms)">
              <Input type="number" value={cfg.endMs ?? ""} placeholder="clip length"
                onChange={(e) => setCfg({ endMs: e.target.value === "" ? null : Number(e.target.value) })} />
            </Row>
            <Row label="Loop">
              <Switch checked={cfg.loop} onCheckedChange={(v) => setCfg({ loop: v })} />
            </Row>
            {cfg.loop && (
              <SliderRow label="Loop count" value={cfg.loopCount} min={0} max={10} onChange={(v) => setCfg({ loopCount: v })} suffix={cfg.loopCount === 0 ? " (∞)" : "x"} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
