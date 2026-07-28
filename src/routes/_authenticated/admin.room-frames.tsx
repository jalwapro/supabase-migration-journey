import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Loader2, Save, X, Pencil, Crown, Medal } from "lucide-react";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";

export const Route = createFileRoute("/_authenticated/admin/room-frames")({
  component: RoomFramesAdmin,
});

type MediaType = "png" | "svga" | "mp4" | "webm" | "gif";
type Chromakey = "none" | "green" | "black" | "luma";

type Frame = {
  id: string;
  name: string;
  media_url: string;
  media_type: MediaType;
  chromakey: Chromakey;
  slot: 0 | 1 | 2;
  is_active: boolean;
  sort_order: number;
};

type Draft = {
  name: string;
  media_url: string;
  media_type: MediaType;
  chromakey: Chromakey;
  sort_order: number;
};

const emptyDraft: Draft = {
  name: "",
  media_url: "",
  media_type: "png",
  chromakey: "none",
  sort_order: 99,
};

function detectMediaType(url: string): MediaType {
  const u = url.toLowerCase();
  if (u.endsWith(".mp4")) return "mp4";
  if (u.endsWith(".webm")) return "webm";
  if (u.endsWith(".svga")) return "svga";
  if (u.endsWith(".gif")) return "gif";
  return "png";
}

function FramePreview({ frame, size = 120 }: { frame: Pick<Frame, "media_url" | "media_type" | "chromakey">; size?: number }) {
  const style: React.CSSProperties = { width: size, height: size };
  const filter = frame.chromakey === "green" ? "url(#room-frame-green-key)" : frame.chromakey === "luma" ? "url(#room-frame-luma-key)" : undefined;
  if (frame.media_type === "mp4" || frame.media_type === "webm") {
    return (
      <video
        src={frame.media_url}
        muted
        autoPlay
        loop
        playsInline
        style={{ ...style, filter, objectFit: "contain" }}
        className="rounded-xl bg-black"
      />
    );
  }
  // png/gif/svga fallback preview
  return (
    <img
      src={frame.media_url}
      alt={""}
      style={{ ...style, filter, objectFit: "contain" }}
      className="rounded-xl bg-black/40"
    />
  );
}

function RoomFramesAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_room_top_frames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_top_frames")
        .select("*")
        .order("slot", { ascending: false })
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Frame[];
    },
  });

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim() || !draft.media_url.trim()) throw new Error("Name + media required");
      const { error } = await supabase.from("room_top_frames").insert({
        ...draft,
        slot: 0,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Frame added to library");
      setDraft(emptyDraft);
      qc.invalidateQueries({ queryKey: ["admin_room_top_frames"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No frame selected");
      if (!editDraft.name.trim() || !editDraft.media_url.trim()) throw new Error("Name + media required");
      const { error } = await supabase
        .from("room_top_frames")
        .update({
          name: editDraft.name,
          media_url: editDraft.media_url,
          media_type: editDraft.media_type,
          chromakey: editDraft.chromakey,
          sort_order: editDraft.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin_room_top_frames"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async ({ id, slot }: { id: string; slot: 0 | 1 | 2 }) => {
      // If assigning to slot 1 or 2, first vacate any existing active frame in that slot.
      if (slot > 0) {
        const { error: clearErr } = await supabase
          .from("room_top_frames")
          .update({ slot: 0 })
          .eq("slot", slot)
          .eq("is_active", true);
        if (clearErr) throw clearErr;
      }
      const { error } = await supabase
        .from("room_top_frames")
        .update({ slot, is_active: true, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.slot === 0 ? "Returned to library" : `Set as #${v.slot} frame`);
      qc.invalidateQueries({ queryKey: ["admin_room_top_frames"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (f: Frame) => {
      const { error } = await supabase
        .from("room_top_frames")
        .update({ is_active: !f.is_active, ...(f.is_active ? { slot: 0 } : {}) })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_room_top_frames"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("room_top_frames").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_room_top_frames"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (f: Frame) => {
    setEditingId(f.id);
    setEditDraft({
      name: f.name,
      media_url: f.media_url,
      media_type: f.media_type,
      chromakey: f.chromakey,
      sort_order: f.sort_order,
    });
  };

  const slot1 = list.data?.find((f) => f.slot === 1 && f.is_active) ?? null;
  const slot2 = list.data?.find((f) => f.slot === 2 && f.is_active) ?? null;
  const library = (list.data ?? []).filter((f) => f.slot === 0 || !f.is_active);

  const DraftFields = ({ d, set }: { d: Draft; set: (d: Draft) => void }) => (
    <div className="grid grid-cols-2 gap-2">
      <input
        placeholder="Frame name"
        value={d.name}
        onChange={(e) => set({ ...d, name: e.target.value })}
        className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
      />
      <div className="col-span-2">
        <FileUploader
          bucket="shop-assets"
          folder="room-frames"
          accept="image/png,image/gif,image/webp,video/mp4,video/webm,application/octet-stream,.svga"
          label="Upload PNG / SVGA / MP4 / WebM (green background OK)"
          value={d.media_url}
          onChange={(url) => set({ ...d, media_url: url ?? "", media_type: url ? detectMediaType(url) : d.media_type })}
          previewKind="auto"
          maxSizeMB={40}
        />
      </div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Type
        <select
          value={d.media_type}
          onChange={(e) => set({ ...d, media_type: e.target.value as MediaType })}
          className="mt-1 block w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
        >
          <option value="png">PNG (transparent)</option>
          <option value="gif">GIF</option>
          <option value="svga">SVGA</option>
          <option value="mp4">MP4 (video)</option>
          <option value="webm">WebM (video)</option>
        </select>
      </label>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Background
        <select
          value={d.chromakey}
          onChange={(e) => set({ ...d, chromakey: e.target.value as Chromakey })}
          className="mt-1 block w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
        >
          <option value="none">None (already transparent)</option>
          <option value="green">Green screen — remove</option>
          <option value="black">Black — screen blend</option>
          <option value="luma">Dark — luma key</option>
        </select>
      </label>
      <input
        placeholder="Sort order"
        type="number"
        value={d.sort_order}
        onChange={(e) => set({ ...d, sort_order: Number(e.target.value) })}
        className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
      />
      {d.media_url && (
        <div className="col-span-2 flex justify-center rounded-xl border border-white/10 bg-black/40 p-3">
          <FramePreview frame={{ media_url: d.media_url, media_type: d.media_type, chromakey: d.chromakey }} size={140} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <AdminPageHeader
        title="Room Rank Frames"
        subtitle="Decorative frames overlaid on the top-1 & top-2 gifting rooms on Home"
      />

      {/* SVG filters used by previews when chromakey = green / luma */}
      <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="room-frame-green-key" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0 0.08" />
            <feComponentTransfer><feFuncA type="linear" slope="3.8" intercept="-0.08" /></feComponentTransfer>
          </filter>
          <filter id="room-frame-luma-key" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
            <feComponentTransfer><feFuncA type="linear" slope="5.2" intercept="-0.48" /></feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Active slots */}
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {([1, 2] as const).map((s) => {
              const f = s === 1 ? slot1 : slot2;
              const Icon = s === 1 ? Crown : Medal;
              const tone = s === 1 ? "text-[color:var(--gold)]" : "text-[color:var(--secondary)]";
              return (
                <div key={s} className="glass rounded-2xl p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${tone}`} />
                    <p className={`text-[11px] font-black uppercase tracking-widest ${tone}`}>
                      Slot #{s} — {s === 1 ? "Top Gifting Room" : "2nd Room"}
                    </p>
                  </div>
                  {f ? (
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-xl border border-white/10 bg-black/40 p-2">
                        <FramePreview frame={f} size={92} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{f.name}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">
                          {f.media_type} · bg: {f.chromakey}
                        </p>
                        <button
                          onClick={() => assign.mutate({ id: f.id, slot: 0 })}
                          className="mt-2 rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-400"
                        >
                          Remove from slot
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="grid h-24 place-items-center text-[11px] text-muted-foreground">
                      No frame assigned — pick one from the library below.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Library */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Frame library ({library.length})
          </p>
          {library.length === 0 ? (
            <div className="glass grid h-24 place-items-center rounded-2xl text-[11px] text-muted-foreground">
              Library empty — upload frames below.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {library.map((f) => (
                <div key={f.id} className="glass overflow-hidden rounded-2xl">
                  <div className="relative grid aspect-square w-full place-items-center bg-black/60 p-2">
                    <FramePreview frame={f} size={140} />
                    {!f.is_active && (
                      <span className="absolute right-1 top-1 rounded-full bg-red-500/80 px-2 py-0.5 text-[9px] font-bold uppercase">OFF</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-bold">{f.name}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {f.media_type} · bg: {f.chromakey}
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      <button
                        onClick={() => assign.mutate({ id: f.id, slot: 1 })}
                        disabled={assign.isPending}
                        className="rounded-full bg-[color:var(--gold)]/20 py-1 text-[10px] font-bold text-[color:var(--gold)] disabled:opacity-40"
                      >
                        Set #1
                      </button>
                      <button
                        onClick={() => assign.mutate({ id: f.id, slot: 2 })}
                        disabled={assign.isPending}
                        className="rounded-full bg-[color:var(--secondary)]/20 py-1 text-[10px] font-bold text-[color:var(--secondary)] disabled:opacity-40"
                      >
                        Set #2
                      </button>
                    </div>
                    <div className="mt-1 flex gap-1">
                      <button
                        onClick={() => toggle.mutate(f)}
                        className={`flex-1 rounded-full py-1 text-[10px] font-bold ${f.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                      >
                        {f.is_active ? "ON" : "OFF"}
                      </button>
                      <button onClick={() => startEdit(f)} className="rounded-full bg-primary/10 p-1.5 text-primary" title="Edit">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => confirm("Delete this frame?") && remove.mutate(f.id)}
                        className="rounded-full bg-red-500/10 p-1.5 text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {editingId === f.id && (
                      <div className="mt-2 rounded-xl border border-primary/30 bg-card/40 p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Edit</p>
                          <button onClick={() => setEditingId(null)} className="rounded-full p-0.5 text-muted-foreground hover:bg-white/5"><X className="h-3 w-3" /></button>
                        </div>
                        <DraftFields d={editDraft} set={setEditDraft} />
                        <button
                          onClick={() => update.mutate()}
                          disabled={update.isPending}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-[10px] font-bold text-primary-foreground disabled:opacity-60"
                        >
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* New frame form */}
      <div className="glass mt-6 max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Upload new frame
        </p>
        <DraftFields d={draft} set={setDraft} />
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="glow-4d mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-3 w-3" /> Add frame to library
        </button>
      </div>
    </>
  );
}
