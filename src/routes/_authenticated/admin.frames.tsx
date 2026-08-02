import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileAtPath } from "@/lib/uploads";
import { toast } from "sonner";
import { BarChart3, Loader2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  FRAME_CATEGORIES,
  FRAME_RARITIES,
  isAvailableNow,
  useAssetStats,
  useFrames,
  type PremiumFrame,
} from "@/lib/premium-assets";

export const Route = createFileRoute("/_authenticated/admin/frames")({ component: Page });

const empty: Partial<PremiumFrame> = {
  name: "",
  description: "",
  category: "Premium",
  rarity: "premium",
  price: 5000,
  duration_days: 30,
  media_type: "png",
  image_url: "",
  thumbnail_url: "",
  min_vip_level: 0,
  min_level: 0,
  vip_only: false,
  is_active: true,
  is_limited: false,
  starts_at: null,
  ends_at: null,
  sort: 0,
};

/** Local datetime <-> ISO helpers for the schedule inputs. */
const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

function FramePreview({ frame, size = 96 }: { frame: Partial<PremiumFrame>; size?: number }) {
  const src = frame.image_url || frame.thumbnail_url;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-[18%] rounded-full bg-gradient-to-br from-muted to-background"
        aria-hidden
      />
      {src ? (
        <img
          src={src}
          alt={frame.name ?? "frame"}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div
          className="absolute inset-0 rounded-full border-4"
          style={{ borderColor: frame.from_color ?? "#5cbdff", boxShadow: `0 0 18px rgba(${frame.glow ?? "92,189,255"},0.7)` }}
        />
      )}
    </div>
  );
}

function Page() {
  const qc = useQueryClient();
  const list = useFrames({ admin: true });
  const stats = useAssetStats();
  const [editing, setEditing] = useState<Partial<PremiumFrame> | null>(null);
  const [filter, setFilter] = useState("All");
  const [showStats, setShowStats] = useState(false);
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => {
    const set = new Set<string>(FRAME_CATEGORIES as readonly string[]);
    for (const f of list.data ?? []) if (f.category) set.add(f.category);
    return ["All", ...[...set].sort()];
  }, [list.data]);

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return filter === "All" ? all : all.filter((f) => f.category === filter);
  }, [list.data, filter]);

  const statById = useMemo(() => {
    const m = new Map<string, { owners: number; purchase_count: number; equip_count: number }>();
    for (const s of stats.data?.frames ?? []) m.set(s.id, s);
    return m;
  }, [stats.data]);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.error("Name required");
    if (editing.media_type !== "css" && !editing.image_url) {
      return toast.error("Upload the frame image (PNG/SVG) first");
    }
    setBusy(true);
    const payload: Record<string, unknown> = { ...editing };
    delete payload.purchase_count;
    delete payload.equip_count;
    const table = (supabase as any).from("dp_frames");
    const { error } = editing.id
      ? await table.update(payload).eq("id", editing.id)
      : await table.insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Frame saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["premium-frames"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this frame? Users who own it will lose it.")) return;
    const { error } = await (supabase as any).from("dp_frames").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["premium-frames"] });
  }

  async function toggleActive(f: PremiumFrame) {
    const { error } = await (supabase as any)
      .from("dp_frames")
      .update({ is_active: !f.is_active })
      .eq("id", f.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["premium-frames"] });
  }

  async function uploadTo(field: "image_url" | "thumbnail_url", file: File) {
    if (!editing) return;
    const path = `profile-frames/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
    try {
      const url = await uploadFileAtPath("shop-assets", path, file);
      const guess = file.name.toLowerCase().endsWith(".svg") ? "svg" : "png";
      setEditing({ ...editing, [field]: url, media_type: field === "image_url" ? guess : editing.media_type } as any);
      toast.success("Uploaded to R2");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">Profile Frames</h1>
          <p className="text-xs text-muted-foreground">
            {list.data?.length ?? 0} frames · PNG/SVG assets served from Cloudflare R2
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStats((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-bold"
          >
            <BarChart3 className="h-4 w-4" /> Usage
          </button>
          <button
            onClick={() => setEditing({ ...empty })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New Frame
          </button>
        </div>
      </div>

      {showStats && (
        <div className="mb-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2">Frame</th>
                <th className="p-2">Category</th>
                <th className="p-2">Owners</th>
                <th className="p-2">Purchases</th>
                <th className="p-2">Equips</th>
              </tr>
            </thead>
            <tbody>
              {(stats.data?.frames ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-2 font-semibold">{s.name}</td>
                  <td className="p-2 text-muted-foreground">{s.category}</td>
                  <td className="p-2">{s.owners}</td>
                  <td className="p-2">{s.purchase_count}</td>
                  <td className="p-2">{s.equip_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              filter === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((f) => {
            const st = statById.get(f.id);
            return (
              <div key={f.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-center py-2">
                  <FramePreview frame={f} />
                </div>
                <p className="truncate text-sm font-bold">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.category} · {f.price.toLocaleString()} coins · {f.duration_days}d
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {f.min_vip_level > 0 && `VIP ${f.min_vip_level} · `}
                  {f.min_level > 0 && `Lv ${f.min_level} · `}
                  {st ? `${st.owners} owners` : "—"}
                </p>
                {f.is_limited && (
                  <p className={`mt-1 text-[10px] ${isAvailableNow(f) ? "text-emerald-400" : "text-red-400"}`}>
                    {isAvailableNow(f) ? "Event live" : "Outside event window"}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    onClick={() => toggleActive(f)}
                    className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                      f.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.is_active ? "Active" : "Disabled"}
                  </button>
                  <button
                    onClick={() => setEditing(f)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-border"
                    aria-label="Edit frame"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(f.id)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-red-500/40 text-red-400"
                    aria-label="Delete frame"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">{editing.id ? "Edit Frame" : "New Frame"}</h2>
              <button onClick={() => setEditing(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
              <FramePreview frame={editing} size={110} />
              <div className="text-xs text-muted-foreground">
                Center stays transparent for the user avatar. Upload 1024×1024 PNG or SVG with alpha.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="col-span-2 space-y-1">
                <span className="text-xs font-semibold">Name</span>
                <input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-xs font-semibold">Description</span>
                <input
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Category</span>
                <input
                  list="frame-cats"
                  value={editing.category ?? ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
                <datalist id="frame-cats">
                  {FRAME_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Rarity</span>
                <select
                  value={editing.rarity ?? "premium"}
                  onChange={(e) => setEditing({ ...editing, rarity: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                >
                  {FRAME_RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Price (coins)</span>
                <input
                  type="number"
                  value={editing.price ?? 0}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Duration (days)</span>
                <input
                  type="number"
                  value={editing.duration_days ?? 30}
                  onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Min VIP level</span>
                <input
                  type="number"
                  value={editing.min_vip_level ?? 0}
                  onChange={(e) => setEditing({ ...editing, min_vip_level: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Min user level</span>
                <input
                  type="number"
                  value={editing.min_level ?? 0}
                  onChange={(e) => setEditing({ ...editing, min_level: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Sort order</span>
                <input
                  type="number"
                  value={editing.sort ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Media type</span>
                <select
                  value={editing.media_type ?? "png"}
                  onChange={(e) => setEditing({ ...editing, media_type: e.target.value as PremiumFrame["media_type"] })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                >
                  {["png", "svg", "webp", "gif", "css"].map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              <div className="col-span-2 grid grid-cols-2 gap-2">
                {(["image_url", "thumbnail_url"] as const).map((field) => (
                  <label key={field} className="space-y-1">
                    <span className="text-xs font-semibold">
                      {field === "image_url" ? "Frame image (PNG/SVG)" : "Thumbnail (optional)"}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        value={(editing[field] as string) ?? ""}
                        onChange={(e) => setEditing({ ...editing, [field]: e.target.value } as any)}
                        placeholder="https://…"
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      />
                      <label className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border">
                        <Upload className="h-3.5 w-3.5" />
                        <input
                          type="file"
                          accept="image/png,image/svg+xml,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadTo(field, f);
                          }}
                        />
                      </label>
                    </div>
                  </label>
                ))}
              </div>

              <label className="col-span-2 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={!!editing.is_limited}
                  onChange={(e) => setEditing({ ...editing, is_limited: e.target.checked })}
                  className="accent-[color:var(--primary)]"
                />
                Limited-time event
              </label>
              {editing.is_limited && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold">Starts</span>
                    <input
                      type="datetime-local"
                      value={toLocal(editing.starts_at)}
                      onChange={(e) => setEditing({ ...editing, starts_at: toIso(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold">Ends</span>
                    <input
                      type="datetime-local"
                      value={toLocal(editing.ends_at)}
                      onChange={(e) => setEditing({ ...editing, ends_at: toIso(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    />
                  </label>
                </>
              )}

              <label className="col-span-2 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="accent-[color:var(--primary)]"
                />
                Active in shop
              </label>
            </div>

            <button
              onClick={save}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save frame
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
