import { useMemo, useState } from "react";
import { Plus, Trash2, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { normalizePopup, type PopupConfig, type PopupKind, type PopupPlacement } from "@/lib/app-customization/popup-manager";

type Props = {
  value: PopupConfig[];
  onChange: (next: PopupConfig[]) => void;
  disabled?: boolean;
};

const KINDS: PopupKind[] = ["popup", "modal", "dialog", "bottom-sheet", "drawer"];
const PLACEMENTS: PopupPlacement[] = ["center", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right", "custom"];

export function PopupStudioPanel({ value, onChange, disabled }: Props) {
  const [selectedId, setSelectedId] = useState(value[0]?.id ?? null);
  const selected = useMemo(() => value.find((item) => item.id === selectedId) ?? null, [value, selectedId]);

  const patch = (changes: Partial<PopupConfig>) => {
    if (!selected) return;
    onChange(value.map((item) => item.id === selected.id ? normalizePopup({ ...item, ...changes }) : item));
  };

  const add = () => {
    const id = `popup-${Date.now()}`;
    const popup = normalizePopup({ id, name: "New Popup", kind: "modal" });
    onChange([...value, popup]);
    setSelectedId(id);
  };

  const remove = () => {
    if (!selected) return;
    const next = value.filter((item) => item.id !== selected.id);
    onChange(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const duplicate = () => {
    if (!selected) return;
    const id = `${selected.id}-copy-${Date.now()}`;
    const copy = normalizePopup({ ...selected, id, name: `${selected.name} Copy` });
    onChange([...value, copy]);
    setSelectedId(id);
  };

  const move = (direction: -1 | 1) => {
    if (!selected) return;
    const index = value.findIndex((item) => item.id === selected.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="grid min-h-[420px] grid-cols-[190px_1fr] border rounded-xl bg-background overflow-hidden">
      <aside className="border-r p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Popups</span>
          <button disabled={disabled} onClick={add} className="rounded-md p-1 hover:bg-muted" title="Add popup"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 space-y-1">
          {value.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs ${item.id === selectedId ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"}`}>
              <div className="truncate">{item.name}</div>
              <div className="text-[9px] text-muted-foreground">{item.kind}</div>
            </button>
          ))}
        </div>
      </aside>
      <section className="p-4">
        {!selected ? <div className="grid h-full place-items-center text-sm text-muted-foreground">Add a popup to start.</div> : <>
          <div className="mb-4 flex items-center gap-2">
            <input disabled={disabled} value={selected.name} onChange={(e) => patch({ name: e.target.value })} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm" />
            <button disabled={disabled} onClick={() => move(-1)} className="rounded-md border p-1.5" title="Move up"><ChevronUp className="h-4 w-4" /></button>
            <button disabled={disabled} onClick={() => move(1)} className="rounded-md border p-1.5" title="Move down"><ChevronDown className="h-4 w-4" /></button>
            <button disabled={disabled} onClick={duplicate} className="rounded-md border p-1.5" title="Duplicate"><Copy className="h-4 w-4" /></button>
            <button disabled={disabled} onClick={remove} className="rounded-md border p-1.5 text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
            <label>Type<select disabled={disabled} value={selected.kind} onChange={(e) => patch({ kind: e.target.value as PopupKind })} className="mt-1 w-full rounded-md border p-2"><option value="popup">Popup</option><option value="modal">Modal</option><option value="dialog">Dialog</option><option value="bottom-sheet">Bottom Sheet</option><option value="drawer">Drawer</option></select></label>
            <label>Placement<select disabled={disabled} value={selected.placement} onChange={(e) => patch({ placement: e.target.value as PopupPlacement })} className="mt-1 w-full rounded-md border p-2">{PLACEMENTS.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label>Width<input disabled={disabled} value={selected.width ?? ""} onChange={(e) => patch({ width: e.target.value })} className="mt-1 w-full rounded-md border p-2" placeholder="360px / 90%" /></label>
            <label>Height<input disabled={disabled} value={selected.height ?? ""} onChange={(e) => patch({ height: e.target.value })} className="mt-1 w-full rounded-md border p-2" placeholder="auto / 500px" /></label>
            <label>Min width<input disabled={disabled} value={selected.minWidth ?? ""} onChange={(e) => patch({ minWidth: e.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
            <label>Max width<input disabled={disabled} value={selected.maxWidth ?? ""} onChange={(e) => patch({ maxWidth: e.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
            <label>Radius<input disabled={disabled} value={selected.radius ?? ""} onChange={(e) => patch({ radius: e.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
            <label>X<input disabled={disabled} value={selected.x ?? ""} onChange={(e) => patch({ x: e.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
            <label>Y<input disabled={disabled} value={selected.y ?? ""} onChange={(e) => patch({ y: e.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
            <label>Animation<select disabled={disabled} value={selected.animation ?? "fade"} onChange={(e) => patch({ animation: e.target.value as PopupConfig["animation"] })} className="mt-1 w-full rounded-md border p-2">{["fade","slide","zoom","bounce","scale"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Duration<input type="number" disabled={disabled} value={selected.animationDurationMs ?? 180} onChange={(e) => patch({ animationDurationMs: Number(e.target.value) })} className="mt-1 w-full rounded-md border p-2" /></label>
            <label>Auto close (ms)<input type="number" disabled={disabled} value={selected.autoCloseMs ?? ""} onChange={(e) => patch({ autoCloseMs: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full rounded-md border p-2" /></label>
          </div>
          <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
            <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={selected.overlay ?? true} onChange={(e) => patch({ overlay: e.target.checked })} /> Overlay</label>
            <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={selected.showCloseButton ?? true} onChange={(e) => patch({ showCloseButton: e.target.checked })} /> Close button</label>
            <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={selected.closeOnOutside ?? true} onChange={(e) => patch({ closeOnOutside: e.target.checked })} /> Click outside closes</label>
            <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={selected.closeOnEscape ?? true} onChange={(e) => patch({ closeOnEscape: e.target.checked })} /> ESC closes</label>
            <label className="flex items-center gap-2">Overlay opacity<input type="number" min="0" max="1" step="0.05" disabled={disabled} value={selected.overlayOpacity ?? 0.55} onChange={(e) => patch({ overlayOpacity: Number(e.target.value) })} className="ml-auto w-20 rounded-md border p-1.5" /></label>
            <label className="flex items-center gap-2">Blur<input type="number" min="0" disabled={disabled} value={selected.blur ?? 0} onChange={(e) => patch({ blur: Number(e.target.value) })} className="ml-auto w-20 rounded-md border p-1.5" /></label>
          </div>
          {selected.kind === "bottom-sheet" && <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs">Bottom Sheet mode enabled. Use height, radius, placement and animation above; mobile-specific values can be stored in the responsive configuration.</div>}
        </>}
      </section>
    </div>
  );
}
