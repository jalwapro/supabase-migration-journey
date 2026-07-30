import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Save, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { BuiltinEntranceView } from "@/lib/entrance/builtin";
import { ENTRANCE_CATEGORIES } from "@/lib/entrance/builtin";
import type { EntranceEffect } from "@/lib/entrance/registry";

export const Route = createFileRoute("/_authenticated/admin/entrances")({ component: Page });

const empty: Partial<EntranceEffect> = {
  key: "",
  name: "",
  description: "",
  category: "VIP",
  media_url: "",
  media_type: "mp4",
  thumbnail_url: "",
  sound_url: "",
  chromakey: "none",
  duration_ms: 2500,
  price_coins: 1000,
  min_vip_level: 0,
  is_active: true,
  is_limited: false,
  sort_order: 0,
};

function Page() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<EntranceEffect> | null>(null);
  const [filter, setFilter] = useState("All");

  const list = useQuery({
    queryKey: ["admin-entrances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entrance_effects")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EntranceEffect[];
    },
  });

  const cats = useMemo(() => ["All", ...ENTRANCE_CATEGORIES], []);
  const rows = useMemo(() => {
    const all = list.data ?? [];
    return filter === "All" ? all : all.filter((e) => e.category === filter);
  }, [list.data, filter]);

  async function save() {
    if (!editing) return;
    const payload: any = { ...editing };
    delete payload.starts_at;
    delete payload.ends_at;
    const { error } = editing.id
      ? await supabase.from("entrance_effects").update(payload).eq("id", editing.id)
      : await supabase.from("entrance_effects").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-entrances"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this entrance effect?")) return;
    const { error } = await supabase.from("entrance_effects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-entrances"] });
  }

  async function uploadTo(field: "media_url" | "thumbnail_url" | "sound_url", file: File) {
    if (!editing) return;
    const path = `entrance-effects/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("shop-assets").upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
    setEditing({ ...editing, [field]: data.publicUrl } as any);
    toast.success("Uploaded");
  }

  return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black">Entrance Effects</h1>
          <button
            onClick={() => setEditing({ ...empty })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New Effect
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                filter === c ? "border-transparent bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {list.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((eff) => (
              <div key={eff.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="relative aspect-square bg-gradient-to-br from-black to-[#1a0b2e]">
                  {eff.thumbnail_url ? (
                    <img src={eff.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : eff.media_url.startsWith("builtin:") ? (
                    <BuiltinEntranceView mediaUrl={eff.media_url} />
                  ) : null}
                  {!eff.is_active && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-red-400">
                      DISABLED
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="truncate text-sm font-bold">{eff.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {eff.category} · {eff.price_coins}c · {eff.duration_ms}ms
                    {eff.min_vip_level ? ` · VIP${eff.min_vip_level}` : ""}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => setEditing(eff)}
                      className="flex-1 rounded bg-muted px-2 py-1 text-xs font-semibold"
                    >
                      <Pencil className="mx-auto h-3 w-3" />
                    </button>
                    <button
                      onClick={() => remove(eff.id)}
                      className="flex-1 rounded bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-500"
                    >
                      <Trash2 className="mx-auto h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black">{editing.id ? "Edit" : "New"} Entrance Effect</h2>
                <button onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-3">
                <Field label="Key (unique)">
                  <input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                    value={editing.key ?? ""} onChange={(e) => setEditing({ ...editing, key: e.target.value })} />
                </Field>
                <Field label="Name">
                  <input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                    value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                    rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Category (type a new one to create it)">
                    <input
                      list="entrance-cat-options"
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.category ?? "VIP"}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    />
                    <datalist id="entrance-cat-options">
                      {allCategories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>

                  <Field label="Media type">
                    <select className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.media_type ?? "mp4"} onChange={(e) => setEditing({ ...editing, media_type: e.target.value as any })}>
                      <option value="mp4">MP4</option>
                      <option value="webm">WebM</option>
                      <option value="lottie">Lottie</option>
                      <option value="svga">SVGA</option>
                      <option value="image">Image (PNG/JPG/GIF)</option>
                      <option value="svg">SVG (builtin)</option>

                    </select>
                  </Field>
                </div>

                <Field label="Media URL (or builtin:<key>)">
                  <div className="flex gap-1">
                    <input className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.media_url ?? ""} onChange={(e) => setEditing({ ...editing, media_url: e.target.value })} />
                    <UploadBtn onFile={(f) => uploadTo("media_url", f)} accept="video/*,image/*,.json,.svga" />
                  </div>
                </Field>
                <Field label="Thumbnail URL">
                  <div className="flex gap-1">
                    <input className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.thumbnail_url ?? ""} onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value })} />
                    <UploadBtn onFile={(f) => uploadTo("thumbnail_url", f)} accept="image/*" />
                  </div>
                </Field>
                <Field label="Sound URL (optional)">
                  <div className="flex gap-1">
                    <input className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.sound_url ?? ""} onChange={(e) => setEditing({ ...editing, sound_url: e.target.value })} />
                    <UploadBtn onFile={(f) => uploadTo("sound_url", f)} accept="audio/*" />
                  </div>
                </Field>

                <div className="grid grid-cols-3 gap-2">
                  <Field label="Chromakey">
                    <select className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.chromakey ?? "none"} onChange={(e) => setEditing({ ...editing, chromakey: e.target.value as any })}>
                      <option value="none">None</option>
                      <option value="green">Green</option>
                      <option value="black">Black</option>
                      <option value="luma">Luma</option>
                    </select>
                  </Field>
                  <Field label="Duration ms">
                    <input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.duration_ms ?? 2500} onChange={(e) => setEditing({ ...editing, duration_ms: Number(e.target.value) })} />
                  </Field>
                  <Field label="Sort">
                    <input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Price (coins)">
                    <input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.price_coins ?? 0} onChange={(e) => setEditing({ ...editing, price_coins: Number(e.target.value) })} />
                  </Field>
                  <Field label="Min VIP level">
                    <input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.min_vip_level ?? 0} onChange={(e) => setEditing({ ...editing, min_vip_level: Number(e.target.value) })} />
                  </Field>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.is_active ?? true}
                      onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.is_limited ?? false}
                      onChange={(e) => setEditing({ ...editing, is_limited: e.target.checked })} />
                    Limited edition
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditing(null)} className="rounded bg-muted px-3 py-1.5 text-sm">Cancel</button>
                  <button onClick={save} className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function UploadBtn({ onFile, accept }: { onFile: (f: File) => void; accept: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1 rounded border border-border bg-muted px-2 py-1.5 text-xs font-semibold">
      <Upload className="h-3.5 w-3.5" />
      <input type="file" className="hidden" accept={accept}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
    </label>
  );
}
