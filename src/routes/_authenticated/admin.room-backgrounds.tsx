import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";

export const Route = createFileRoute("/_authenticated/admin/room-backgrounds")({
  component: RoomBgAdmin,
});

type Bg = {
  id: string;
  name: string;
  image_url: string;
  price: number;
  is_active: boolean;
  sort_order: number;
};

function RoomBgAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_room_bg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_backgrounds").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Bg[];
    },
  });

  const [draft, setDraft] = useState({ name: "", image_url: "", price: 0, sort_order: 99 });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim() || !draft.image_url.trim()) throw new Error("Name + image required");
      const { error } = await supabase.from("room_backgrounds").insert({ ...draft, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Background added");
      setDraft({ name: "", image_url: "", price: 0, sort_order: 99 });
      qc.invalidateQueries({ queryKey: ["admin_room_bg"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (b: Bg) => {
      const { error } = await supabase.from("room_backgrounds").update({ is_active: !b.is_active }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_room_bg"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("room_backgrounds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_room_bg"] }),
  });

  return (
    <>
      <AdminPageHeader title="Room Backgrounds" subtitle="Cover artwork users can apply to rooms" />
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {list.data?.map((b) => (
            <div key={b.id} className="glass overflow-hidden rounded-2xl">
              <div className="relative aspect-[3/4] w-full bg-card">
                {b.image_url ? <img src={b.image_url} className="h-full w-full object-cover" alt={b.name} /> : <ImageIcon className="m-auto h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-bold">{b.name}</p>
                <p className="text-[11px] text-[color:var(--gold)]">💰 {b.price.toLocaleString()}</p>
                <div className="mt-1 flex gap-1.5">
                  <button
                    onClick={() => toggle.mutate(b)}
                    className={`flex-1 rounded-full py-1 text-[10px] font-bold ${b.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {b.is_active ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => confirm("Delete?") && remove.mutate(b.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass mt-4 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new background</p>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <input placeholder="Price (coins)" type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <div className="col-span-2">
            <FileUploader
              bucket="room-bg"
              accept="image/*,video/mp4"
              label="Upload background image / video"
              value={draft.image_url}
              onChange={(url) => setDraft({ ...draft, image_url: url ?? "" })}
            />
          </div>
          <input placeholder="Sort order" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Add background
        </button>
      </div>
    </>
  );
}
