import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  component: BannersAdmin,
});

type Banner = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  active: boolean;
};

function BannersAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Banner[];
    },
  });

  const [draft, setDraft] = useState({ title: "", image_url: "", link_url: "", sort_order: 99 });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.image_url.trim()) throw new Error("Image URL required");
      const { error } = await supabase.from("banners").insert({
        title: draft.title || null,
        image_url: draft.image_url,
        link_url: draft.link_url || null,
        sort_order: draft.sort_order,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner added");
      setDraft({ title: "", image_url: "", link_url: "", sort_order: 99 });
      qc.invalidateQueries({ queryKey: ["admin_banners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (b: Banner) => {
      const { error } = await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_banners"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_banners"] }),
  });

  return (
    <>
      <AdminPageHeader title="Home Banners" subtitle="Carousel shown on the home screen" />
      <div className="space-y-2">
        {list.data?.map((b) => (
          <div key={b.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-card/60">
              {b.image_url ? <img src={b.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{b.title ?? "Untitled"}</p>
              <p className="truncate text-xs text-muted-foreground">{b.link_url ?? "no link"}</p>
            </div>
            <button
              onClick={() => toggle.mutate(b)}
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${b.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
            >
              {b.active ? "ON" : "OFF"}
            </button>
            <button onClick={() => confirm("Delete banner?") && remove.mutate(b.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="glass mt-4 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new banner</p>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
          <input placeholder="Order" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
          <input placeholder="Image URL" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
          <input placeholder="Link URL (optional)" value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none" />
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add banner
        </button>
      </div>
    </>
  );
}
