import { useEffect, useMemo, useRef, useState } from "react";
import { applyStudioFont, deleteStudioAsset, listStudioAssets, uploadStudioAsset, type StudioAsset } from "@/lib/app-customization/studio-assets";
import { filterAssets, type AssetKind } from "@/lib/app-customization/assets";
import { Search, Upload, Trash2, Type, Image as ImageIcon, Video, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const kinds: Array<{ value?: AssetKind; label: string }> = [
  { label: "All" }, { value: "image", label: "Images" }, { value: "icon", label: "Icons" }, { value: "logo", label: "Logos" }, { value: "background", label: "Backgrounds" }, { value: "frame", label: "Frames" }, { value: "gift", label: "Gifts" }, { value: "animation", label: "Animations" }, { value: "video", label: "Videos" }, { value: "font", label: "Fonts" },
];

export function StudioAssetManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AssetKind | undefined>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = async () => { try { setAssets(await listStudioAssets()); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to load assets"); } };
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => filterAssets(assets.map(a => ({ ...a, kind: a.type === "font" ? "font" : (a.type as AssetKind) })), query, kind) as unknown as StudioAsset[], [assets, query, kind]);

  const upload = async (files: FileList | null) => { if (!files?.length) return; setBusy(true); try { for (const file of Array.from(files)) { const isFont = file.type.startsWith("font/") || /\.(woff2?|ttf|otf)$/i.test(file.name); await uploadStudioAsset(file, isFont ? "fonts" : "images"); } await refresh(); toast.success(`${files.length} asset${files.length > 1 ? "s" : ""} uploaded`); } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); } };
  const remove = async (asset: StudioAsset) => { if (!window.confirm(`Delete ${asset.name}?`)) return; try { await deleteStudioAsset(asset); setAssets(x => x.filter(a => a.id !== asset.id)); toast.success("Asset deleted"); } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); } };
  const useFont = (asset: StudioAsset) => { applyStudioFont(asset, asset.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "StudioUploadedFont"); toast.success("Font loaded in this Studio session"); };
  const copy = async (url: string, id: string) => { await navigator.clipboard?.writeText(url); setCopied(id); setTimeout(() => setCopied(null), 1200); };

  return <div className="flex min-h-[650px] flex-col bg-background text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div><h2 className="text-sm font-semibold">Assets & Fonts</h2><p className="text-[10px] text-muted-foreground">Real Supabase Storage assets used by Jalwa App Studio</p></div><button disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"><Upload className="mr-1 inline h-3.5 w-3.5" />Upload</button><input ref={inputRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml,video/*,.woff,.woff2,.ttf,.otf" onChange={e => void upload(e.target.files)} /></header>
    <div className="flex flex-wrap gap-2 border-b border-border p-3"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search assets…" className="w-full rounded-lg border bg-background py-2 pl-8 pr-2 text-xs" /></div>{kinds.map(k => <button key={k.label} onClick={() => setKind(k.value)} className={`rounded-full px-3 py-1.5 text-[10px] ${kind === k.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{k.label}</button>)}</div>
    <div className="grid flex-1 grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{filtered.map(asset => <article key={asset.id} className="group overflow-hidden rounded-xl border border-border bg-card"><div className="relative flex h-32 items-center justify-center bg-muted/40 p-2">{asset.type === "font" ? <Type className="h-10 w-10 text-muted-foreground" /> : asset.type === "video" ? <Video className="h-10 w-10 text-muted-foreground" /> : <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" onError={e => { e.currentTarget.style.display = "none"; }} />}</div><div className="p-2"><p className="truncate text-xs font-medium" title={asset.name}>{asset.name}</p><p className="mt-0.5 text-[9px] uppercase text-muted-foreground">{asset.type} · {asset.category}</p><div className="mt-2 flex gap-1">{asset.type === "font" && <button onClick={() => useFont(asset)} className="flex-1 rounded-md border px-2 py-1 text-[9px]"><Type className="mr-1 inline h-3 w-3" />Use Font</button>}{asset.type !== "font" && <button onClick={() => copy(asset.url, asset.id)} className="flex-1 rounded-md border px-2 py-1 text-[9px]">{copied === asset.id ? <><Check className="mr-1 inline h-3 w-3" />Copied</> : <><Copy className="mr-1 inline h-3 w-3" />Copy URL</>}</button>}<button onClick={() => void remove(asset)} className="rounded-md border px-2 py-1 text-[9px] text-destructive"><Trash2 className="h-3 w-3" /></button></div></div></article>)}{filtered.length === 0 && <div className="col-span-full grid min-h-56 place-items-center text-center text-muted-foreground"><div><ImageIcon className="mx-auto mb-2 h-8 w-8" /><p className="text-sm">No matching assets</p><p className="text-xs">Upload images, icons, videos or custom fonts to start.</p></div></div>}</div>
  </div>;
}
