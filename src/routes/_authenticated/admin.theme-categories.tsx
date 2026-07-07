import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, FolderTree } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/theme-categories")({
  component: ThemeCatsAdmin,
});

type Cat = { id: string; name: string; sort_order: number };

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

  const [draft, setDraft] = useState({ name: "", sort_order: 99 });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("theme_categories").insert(draft);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added");
      setDraft({ name: "", sort_order: 99 });
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
      <AdminPageHeader title="Theme Categories" subtitle="Group themes for the shop" />
      <div className="glass mb-4 max-w-2xl rounded-2xl p-4">
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <input placeholder="Order" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Add category
        </button>
      </div>
      <div className="space-y-2">
        {list.data?.map((c) => (
          <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <FolderTree className="h-4 w-4 text-primary" />
            <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
            <span className="text-[10px] text-muted-foreground">#{c.sort_order}</span>
            <button onClick={() => confirm("Delete?") && remove.mutate(c.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
