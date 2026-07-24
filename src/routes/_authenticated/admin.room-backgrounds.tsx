import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Image as ImageIcon, Loader2, Pencil, X, Save } from "lucide-react";
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

type Draft = { name: string; image_url: string; price: number; sort_order: number };
const empty: Draft = { name: "", image_url: "", price: 0, sort_order: 99 };

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

  const [draft, setDraft] = useState<Draft>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(empty);

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim() || !draft.image_url.trim()) throw new Error("Name + image required");
      const { error } = await supabase.from("room_backgrounds").insert({ ...draft, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Background added");
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["admin_room_bg"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No background selected");
      if (!editDraft.name.trim() || !editDraft.image_url.trim()) throw new Error("Name + image required");
      const { error } = await supabase.from("room_backgrounds").update({
        name: editDraft.name,
        image_url: editDraft.image_url,
        price: editDraft.price,
        sort_order: editDraft.sort_order,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditingId(null);
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

  const startEdit = (b: Bg) => {
    setEditingId(b.id);
    setEditDraft({ name: b.name, image_url: b.image_url, price: b.price, sort_order: b.sort_order });
  };

  const draftFields = (d: Draft, set: (d: Draft) => void, uploaderLabel: string) => (
    <div className="grid grid-cols-2 gap-2">
      <input placeholder="Name" value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
      <input placeholder="Price (coins)" type="number" value={d.price} onChange={(e) => set({ ...d, price: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
      <div className="col-span-2">
        <FileUploader bucket="room-bg" accept="image/*,video/mp4" label={uploaderLabel} value={d.image_url} onChange={(url) => set({ ...d, image_url: url ?? "" })} />
      </div>
      <input placeholder="Sort order" type="number" value={d.sort_order} onChange={(e) => set({ ...d, sort_order: Number(e.target.value) })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
    </div>
  );

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
                <p className="text-[11px] text-[color:var(--gold)]">💰 {b.price.toLocaleString()} · #{b.sort_order}</p>
                <div className="mt-1 flex gap-1.5">
                  <button
                    onClick={() => toggle.mutate(b)}
                    className={`flex-1 rounded-full py-1 text-[10px] font-bold ${b.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {b.is_active ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => startEdit(b)} className="rounded-full bg-primary/10 p-1.5 text-primary" title="Edit">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => confirm("Delete?") && remove.mutate(b.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {editingId === b.id && (
                  <div className="mt-2 rounded-xl border border-primary/30 bg-card/40 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Edit</p>
                      <button onClick={() => setEditingId(null)} className="rounded-full p-0.5 text-muted-foreground hover:bg-white/5"><X className="h-3 w-3" /></button>
                    </div>
                    {draftFields(editDraft, setEditDraft, "Replace image")}
                    <button onClick={() => update.mutate()} disabled={update.isPending} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-[10px] font-bold text-primary-foreground disabled:opacity-60">
                      <Save className="h-3 w-3" /> Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass mt-4 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add new background</p>
        {draftFields(draft, setDraft, "Upload background image / video")}
        <button onClick={() => create.mutate()} disabled={create.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Add background
        </button>
      </div>
    </>
  );
}
