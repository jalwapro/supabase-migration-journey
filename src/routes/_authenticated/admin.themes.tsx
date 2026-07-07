import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/themes")({
  component: ThemesAdmin,
});

type Theme = {
  id: string;
  name: string;
  preview_url: string | null;
  price_coins: number;
  category_id: string | null;
  is_premium: boolean;
  active: boolean;
};

function ThemesAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("themes").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Theme[];
    },
  });

  const [draft, setDraft] = useState({ name: "", preview_url: "", price_coins: 500, is_premium: false });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("themes").insert({ ...draft, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Theme added");
      setDraft((d) => ({ ...d, name: "", preview_url: "" }));
      qc.invalidateQueries({ queryKey: ["admin_themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Theme) => {
      const { error } = await supabase.from("themes").update({ active: !t.active }).eq("id", t.id);
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
      <AdminPageHeader title="Theme Manager" subtitle="Profile themes users can equip" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {list.data?.map((t) => (
          <div key={t.id} className="glass overflow-hidden rounded-2xl">
            <div className="aspect-square bg-card/60">
              {t.preview_url ? <img src={t.preview_url} alt={t.name} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="p-2 text-xs">
              <p className="truncate font-bold">{t.name}</p>
              <p className="text-[color:var(--gold)]">{t.price_coins.toLocaleString()} coins</p>
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => toggle.mutate(t)}
                  className={`flex-1 rounded-full py-1 text-[10px] font-bold ${t.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                >
                  {t.active ? "ON" : "OFF"}
                </button>
                <button onClick={() => confirm(`Delete ${t.name}?`) && remove.mutate(t.id)} className="rounded-full bg-red-500/10 p-1 text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass mt-4 max-w-xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new theme</p>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
          <input placeholder="Price (coins)" type="number" value={draft.price_coins} onChange={(e) => setDraft({ ...draft, price_coins: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
          <input placeholder="Preview image URL" value={draft.preview_url} onChange={(e) => setDraft({ ...draft, preview_url: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
          <label className="col-span-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={draft.is_premium} onChange={(e) => setDraft({ ...draft, is_premium: e.target.checked })} />
            Premium (VIP only)
          </label>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add theme
        </button>
      </div>
    </>
  );
}
