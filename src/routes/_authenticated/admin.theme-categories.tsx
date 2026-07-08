import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, FolderTree, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/theme-categories")({
  component: ThemeCatsAdmin,
});

type Cat = { id: string; name: string; slug: string | null; icon_url: string | null; sort_order: number; is_active: boolean };

async function uploadIcon(file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `category-icons/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("shop-assets").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
}

function ThemeCatsAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_theme_cats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("theme_categories").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const [draft, setDraft] = useState({ name: "", slug: "", icon_url: "", sort_order: 99 });
  const [uploading, setUploading] = useState(false);

  async function pickIcon() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setUploading(true);
        const url = await uploadIcon(file);
        setDraft((d) => ({ ...d, icon_url: url }));
        toast.success("Icon uploaded");
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("theme_categories").insert({
        name: draft.name,
        slug: draft.slug || draft.name.toLowerCase().replace(/\s+/g, "_"),
        icon_url: draft.icon_url || null,
        sort_order: draft.sort_order,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added");
      setDraft({ name: "", slug: "", icon_url: "", sort_order: 99 });
      qc.invalidateQueries({ queryKey: ["admin_theme_cats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("theme_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_theme_cats"] }),
  });

  return (
    <>
      <AdminPageHeader title="Shop Categories" subtitle="Sidebar categories in the Shop (Car, Frame, Ring…)" />
      <div className="glass mb-4 max-w-2xl rounded-2xl p-4">
        <div className="grid grid-cols-3 gap-2">
          <input
            placeholder="Name (e.g. Car)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
          />
          <input
            placeholder="Order"
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
          />
          <input
            placeholder="slug (optional)"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            className="col-span-3 rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={pickIcon}
            className="col-span-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-input px-2 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Category icon
            </span>
            {draft.icon_url ? <img src={draft.icon_url} className="h-8 w-8 rounded-full object-cover" alt="" /> : <span className="text-[10px] text-muted-foreground">Choose</span>}
          </button>
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Add category
        </button>
      </div>
      <div className="space-y-2">
        {list.data?.map((c) => (
          <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[color:var(--gold)]/40 bg-black/40">
              {c.icon_url ? <img src={c.icon_url} alt="" className="h-full w-full object-cover" /> : <FolderTree className="h-4 w-4 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{c.name}</p>
              <p className="text-[10px] text-muted-foreground">#{c.sort_order} · {c.slug ?? "—"}</p>
            </div>
            <button onClick={() => confirm("Delete?") && remove.mutate(c.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
