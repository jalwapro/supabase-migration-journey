import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";

export const Route = createFileRoute("/_authenticated/admin/ads")({
  component: AdsAdmin,
});

type Ad = {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  placement: string;
  is_active: boolean;
  sort_order: number;
};

function AdsAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_ads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ads").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Ad[];
    },
  });

  const [draft, setDraft] = useState({ title: "", image_url: "", link_url: "", placement: "home", sort_order: 99 });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("ads").insert({ ...draft, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ad added");
      setDraft({ title: "", image_url: "", link_url: "", placement: "home", sort_order: 99 });
      qc.invalidateQueries({ queryKey: ["admin_ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (a: Ad) => {
      const { error } = await supabase.from("ads").update({ is_active: !a.is_active }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_ads"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_ads"] }),
  });

  return (
    <>
      <AdminPageHeader title="Ads Management" subtitle="Splash / banner / interstitial ads" />
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((a) => (
            <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-card/60">
                {a.image_url ? <img src={a.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">{a.placement} · #{a.sort_order}</p>
              </div>
              <button
                onClick={() => toggle.mutate(a)}
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${a.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
              >
                {a.is_active ? "ON" : "OFF"}
              </button>
              <button onClick={() => confirm("Delete ad?") && remove.mutate(a.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No ads yet</p>}
        </div>
      )}

      <div className="glass mt-4 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new ad</p>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <select value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            <option value="home">Home</option>
            <option value="rooms">Rooms</option>
            <option value="splash">Splash</option>
            <option value="interstitial">Interstitial</option>
          </select>
          <div className="col-span-2">
            <FileUploader
              bucket="ads"
              accept="image/*,video/mp4"
              label="Upload ad image / video"
              value={draft.image_url}
              onChange={(url) => setDraft({ ...draft, image_url: url ?? "" })}
            />
          </div>
          <input placeholder="Link URL" value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <input placeholder="Sort order" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Add ad
        </button>
      </div>
    </>
  );
}
