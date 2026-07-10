import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Upload, Loader2, Gem, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/themes")({
  component: ThemesAdmin,
});

type Theme = {
  id: string;
  name: string;
  preview_url: string | null;
  animation_url: string | null;
  bg_image: string | null;
  price_diamonds: number;
  duration_days: number | null;
  category_id: string | null;
  is_premium: boolean;
  is_active: boolean;
  sort: number;
};
type Cat = { id: string; name: string };

async function uploadToShop(file: File, folder: string) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("shop-assets").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
}

function ThemesAdmin() {
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState<string>("all");
  const [editing, setEditing] = useState<Theme | null>(null);


  const list = useQuery({
    queryKey: ["admin_themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("themes").select("*").order("sort");
      if (error) throw error;
      return (data ?? []) as Theme[];
    },
  });
  const cats = useQuery({
    queryKey: ["admin_theme_cats_for_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("theme_categories").select("id,name").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    category_id: "",
    animation_url: "",
    preview_url: "",
    price_diamonds: 5000,
    price_coins: 0,
    duration_days: 7 as number | null,
    is_premium: false,
    is_free: false,
    primary_color: "#e94560",
    accent_color: "#9b72cf",
    sort: 0,
  });
  const [uploading, setUploading] = useState<string | null>(null);

  async function pickFile(kind: "animation" | "preview") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "animation" ? "image/gif,image/webp,image/png,video/mp4" : "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setUploading(kind);
        const url = await uploadToShop(file, kind === "animation" ? "animations" : "previews");
        setDraft((d) => (kind === "animation" ? { ...d, animation_url: url } : { ...d, preview_url: url }));
        toast.success("Uploaded");
      } catch (e: any) {
        toast.error(e.message ?? "Upload failed");
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      if (!draft.category_id) throw new Error("Pick a category");
      const { error } = await supabase.from("themes").insert({
        name: draft.name,
        description: draft.description || null,
        category_id: draft.category_id,
        animation_url: draft.animation_url || null,
        preview_url: draft.preview_url || null,
        bg_image: draft.animation_url || draft.preview_url || null,
        price_diamonds: draft.is_free ? 0 : draft.price_diamonds,
        price: draft.is_free ? 0 : draft.price_coins,
        is_free: draft.is_free,
        primary_color: draft.primary_color,
        accent_color: draft.accent_color,
        duration_days: draft.duration_days,
        is_premium: draft.is_premium,
        is_active: true,
        sort: draft.sort,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shop item added");
      setDraft((d) => ({ ...d, name: "", description: "", animation_url: "", preview_url: "" }));
      qc.invalidateQueries({ queryKey: ["admin_themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Theme) => {
      const { error } = await supabase.from("themes").update({ is_active: !t.is_active }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_themes"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("themes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_themes"] }),
  });

  return (
    <>
      <AdminPageHeader title="Shop Items" subtitle="Cars, frames, rings, entrances — animated items users buy with diamonds" />

      <div className="glass mb-4 rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add shop item</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Item name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />
          <select
            value={draft.category_id}
            onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          >
            <option value="">-- Category --</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            placeholder="Sort order"
            type="number"
            value={draft.sort}
            onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) })}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />
          <label className="flex items-center gap-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <Gem className="h-3 w-3 text-[color:var(--gold)]" />
            <input
              placeholder="Price (diamonds)"
              type="number"
              value={draft.price_diamonds}
              onChange={(e) => setDraft({ ...draft, price_diamonds: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
            />
          </label>
          <input
            placeholder="Duration days (blank = permanent)"
            type="number"
            value={draft.duration_days ?? ""}
            onChange={(e) => setDraft({ ...draft, duration_days: e.target.value === "" ? null : Number(e.target.value) })}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />

          <button
            type="button"
            onClick={() => pickFile("animation")}
            className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-[color:var(--gold)]/50 bg-input px-2 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {uploading === "animation" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Animation (gif / webp / mp4)
            </span>
            {draft.animation_url ? (
              <img src={draft.animation_url} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Choose file</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => pickFile("preview")}
            className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-input px-2 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {uploading === "preview" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Static preview image (optional)
            </span>
            {draft.preview_url ? (
              <img src={draft.preview_url} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Choose file</span>
            )}
          </button>

          <textarea
            placeholder="Description (optional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="col-span-2 min-h-[60px] rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />

          <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <span className="text-muted-foreground">Primary</span>
            <input type="color" value={draft.primary_color} onChange={(e) => setDraft({ ...draft, primary_color: e.target.value })} className="h-6 w-8 cursor-pointer rounded bg-transparent" />
            <span className="ml-auto font-mono text-[10px]">{draft.primary_color}</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <span className="text-muted-foreground">Accent</span>
            <input type="color" value={draft.accent_color} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} className="h-6 w-8 cursor-pointer rounded bg-transparent" />
            <span className="ml-auto font-mono text-[10px]">{draft.accent_color}</span>
          </label>

          <input
            placeholder="Price (coins)"
            type="number"
            value={draft.price_coins}
            onChange={(e) => setDraft({ ...draft, price_coins: Number(e.target.value) })}
            disabled={draft.is_free}
            className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none disabled:opacity-40"
          />

          <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <input type="checkbox" checked={draft.is_free} onChange={(e) => setDraft({ ...draft, is_free: e.target.checked })} />
            Free
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <input type="checkbox" checked={draft.is_premium} onChange={(e) => setDraft({ ...draft, is_premium: e.target.checked })} />
            VIP only
          </label>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add shop item
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilterCat("all")}
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${filterCat === "all" ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}
        >
          All ({list.data?.length ?? 0})
        </button>
        {cats.data?.map((c) => {
          const count = list.data?.filter((t) => t.category_id === c.id).length ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${filterCat === c.id ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {list.data?.filter((t) => filterCat === "all" || t.category_id === filterCat).map((t) => (
          <div key={t.id} className="glass overflow-hidden rounded-2xl">
            <div className="grid aspect-square place-items-center bg-black/40 p-3">
              {t.animation_url ? (
                t.animation_url.match(/\.mp4($|\?)/i) ? (
                  <video src={t.animation_url} autoPlay loop muted playsInline className="max-h-full" />
                ) : (
                  <img src={t.animation_url} alt={t.name} className="max-h-full object-contain" />
                )
              ) : t.preview_url || t.bg_image ? (
                <img src={t.preview_url ?? t.bg_image!} alt={t.name} className="max-h-full object-contain" />
              ) : null}
            </div>
            <div className="p-2 text-xs">
              <p className="truncate font-bold">{t.name}</p>
              <p className="flex items-center gap-1 text-[color:var(--gold)]">
                <Gem className="h-3 w-3" /> {t.price_diamonds.toLocaleString()}
                {t.duration_days ? <span className="ml-auto text-[10px] text-muted-foreground">{t.duration_days}d</span> : <span className="ml-auto text-[10px] text-muted-foreground">Perm</span>}
              </p>
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => toggle.mutate(t)}
                  className={`flex-1 rounded-full py-1 text-[10px] font-bold ${t.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                >
                  {t.is_active ? "ON" : "OFF"}
                </button>
                <button onClick={() => setEditing(t)} className="rounded-full bg-blue-500/10 p-1 text-blue-400">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => confirm(`Delete ${t.name}?`) && remove.mutate(t.id)} className="rounded-full bg-red-500/10 p-1 text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditItemModal
          item={editing}
          cats={cats.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin_themes"] });
          }}
        />
      )}
    </>
  );
}

function EditItemModal({
  item,
  cats,
  onClose,
  onSaved,
}: {
  item: Theme;
  cats: Cat[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: item.name,
    category_id: item.category_id ?? "",
    price_diamonds: item.price_diamonds,
    duration_days: item.duration_days,
    preview_url: item.preview_url ?? "",
    animation_url: item.animation_url ?? "",
    bg_image: item.bg_image ?? "",
    is_premium: item.is_premium,
    is_active: item.is_active,
    sort: item.sort,
  });
  const [uploading, setUploading] = useState<string | null>(null);

  async function pickFile(kind: "animation" | "preview" | "bg") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/mp4";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setUploading(kind);
        const url = await uploadToShop(file, kind);
        setForm((f) => ({
          ...f,
          ...(kind === "animation" ? { animation_url: url } : kind === "preview" ? { preview_url: url } : { bg_image: url }),
        }));
        toast.success("Uploaded");
      } catch (e: any) {
        toast.error(e.message ?? "Upload failed");
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("themes").update({
        name: form.name,
        category_id: form.category_id || null,
        price_diamonds: form.price_diamonds,
        duration_days: form.duration_days,
        preview_url: form.preview_url || null,
        animation_url: form.animation_url || null,
        bg_image: form.bg_image || null,
        is_premium: form.is_premium,
        is_active: form.is_active,
        sort: form.sort,
      }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Edit item</p>
          <button onClick={onClose} className="rounded-full bg-card/60 p-1"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          >
            <option value="">-- Category --</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="col-span-2 flex items-center gap-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <Gem className="h-3 w-3 text-[color:var(--gold)]" />
            <input
              type="number"
              value={form.price_diamonds}
              onChange={(e) => setForm({ ...form, price_diamonds: Number(e.target.value) })}
              className="w-full bg-transparent outline-none"
              placeholder="Price (diamonds)"
            />
          </label>
          <input
            type="number"
            placeholder="Duration days (blank = perm)"
            value={form.duration_days ?? ""}
            onChange={(e) => setForm({ ...form, duration_days: e.target.value === "" ? null : Number(e.target.value) })}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />
          <input
            type="number"
            placeholder="Sort"
            value={form.sort}
            onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
          />

          {(["preview", "animation", "bg"] as const).map((k) => {
            const url = k === "preview" ? form.preview_url : k === "animation" ? form.animation_url : form.bg_image;
            const label = k === "preview" ? "Preview image" : k === "animation" ? "Animation" : "Background image";
            return (
              <button
                key={k}
                type="button"
                onClick={() => pickFile(k)}
                className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-input px-2 py-2 text-xs"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {uploading === k ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {label}
                </span>
                {url ? <img src={url} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="text-[10px] text-muted-foreground">Choose</span>}
              </button>
            );
          })}

          {(["preview_url", "animation_url", "bg_image"] as const).map((field) => (
            <input
              key={field}
              placeholder={field}
              value={form[field] as string}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 font-mono text-[10px] outline-none"
            />
          ))}

          <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <input type="checkbox" checked={form.is_premium} onChange={(e) => setForm({ ...form, is_premium: e.target.checked })} />
            VIP only
          </label>
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save changes
        </button>
      </div>
    </div>
  );
}

