import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Loader2, Upload, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/gifts")({
  component: GiftsAdmin,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">
      Failed to load gifts: {error?.message ?? "Unknown error"}
    </div>
  ),
});

type GiftRow = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: string;
  animation: string;
  sort_order: number;
  is_active: boolean;
  clip_path: string | null;
  clip_type: string | null;
  is_milestone?: boolean | null;
};

const CATEGORIES = ["popular", "classic", "love", "luxury", "vip", "lucky", "premium"] as const;
const CLIP_TYPES = ["none", "svg", "mp4"] as const;

type Draft = {
  id?: string;
  name: string;
  emoji: string;
  price: number;
  category: string;
  animation: string;
  sort_order: number;
  clip_path: string;
  clip_type: (typeof CLIP_TYPES)[number];
  is_milestone: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  emoji: "🎁",
  price: 100,
  category: "popular",
  animation: "pop",
  sort_order: 99,
  clip_path: "",
  clip_type: "none",
  is_milestone: false,
};

function GiftsAdmin() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploading, setUploading] = useState(false);
  const isEditing = Boolean(draft.id);

  const list = useQuery({
    queryKey: ["admin_gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,emoji,price,category,animation,sort_order,is_active,clip_path,clip_type")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as GiftRow[];
    },
  });

  const upload = async (file: File) => {
    if (!file.type.startsWith("video/") && !file.name.toLowerCase().endsWith(".mp4")) {
      toast.error("Please pick an MP4 video");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Max 15 MB");
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `gift-clips/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("shop-assets")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
      setDraft((d) => ({ ...d, clip_path: data.publicUrl, clip_type: "mp4" }));
      toast.success("Video uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      const row = {
        name: draft.name.trim(),
        emoji: draft.emoji || "🎁",
        icon: draft.emoji || "🎁",
        price: draft.price,
        price_coins: draft.price,
        category: draft.category,
        animation: draft.animation || "pop",
        sort_order: draft.sort_order,
        clip_path: draft.clip_type === "none" ? null : draft.clip_path.trim() || null,
        clip_type: draft.clip_type === "none" ? "mp4" : draft.clip_type,
        is_active: true,
        active: true,
      };
      if (draft.id) {
        const { error } = await supabase.from("gifts").update(row).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gifts").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Gift updated" : "Gift added");
      setDraft(EMPTY_DRAFT);
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (g: GiftRow) => {
      const { error } = await supabase
        .from("gifts")
        .update({ is_active: !g.is_active, active: !g.is_active })
        .eq("id", g.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_gifts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editGift = (g: GiftRow) => {
    setDraft({
      id: g.id,
      name: g.name,
      emoji: g.emoji || "🎁",
      price: g.price,
      category: g.category,
      animation: g.animation || "pop",
      sort_order: g.sort_order,
      clip_path: g.clip_path ?? "",
      clip_type: (g.clip_path
        ? g.clip_type === "svg"
          ? "svg"
          : "mp4"
        : "none") as Draft["clip_type"],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <AdminPageHeader
        title="Gifts Management"
        subtitle="Add SVG or MP4 animated gifts. MP4s upload to shop-assets/gift-clips."
      />

      <div className="grid gap-4 md:grid-cols-[1fr_360px]">
        {/* Gift list */}
        <div>
          {list.isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {list.error && (
            <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
              {(list.error as Error).message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {list.data?.map((g) => (
              <div
                key={g.id}
                className={`glass flex flex-col gap-1.5 rounded-xl p-2 text-xs ${draft.id === g.id ? "ring-2 ring-[color:var(--primary)]" : ""}`}
              >
                <div className="grid h-20 w-full place-items-center overflow-hidden rounded-lg bg-black/40">
                  {g.clip_path && g.clip_type === "mp4" ? (
                    <video
                      src={g.clip_path}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : g.clip_path ? (
                    <img src={g.clip_path} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-4xl">{g.emoji ?? "🎁"}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{g.name}</p>
                    <p className="truncate text-[10px] text-[color:var(--gold)]">
                      {g.price?.toLocaleString()} · {g.category}
                      {g.clip_type ? ` · ${g.clip_type}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle.mutate(g)}
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${g.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {g.is_active ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => editGift(g)}
                    className="flex-1 rounded-lg bg-primary/10 py-1 text-[10px] font-bold text-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirm(`Delete ${g.name}?`) && remove.mutate(g.id)}
                    className="rounded-lg bg-red-500/10 px-2 text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {list.data && list.data.length === 0 && (
              <p className="col-span-full text-center text-xs text-muted-foreground">No gifts yet.</p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="glass h-fit rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isEditing ? "Edit gift" : "Add new gift"}
            </p>
            {isEditing && (
              <button
                onClick={() => setDraft(EMPTY_DRAFT)}
                className="grid h-6 w-6 place-items-center rounded-full bg-card/60 text-muted-foreground"
                aria-label="Cancel edit"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
            <input
              placeholder="Emoji"
              value={draft.emoji}
              onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
            <input
              type="number"
              placeholder="Price (coins)"
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Sort order"
              value={draft.sort_order}
              onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
            <input
              placeholder="Animation (pop/burst/…)"
              value={draft.animation}
              onChange={(e) => setDraft((d) => ({ ...d, animation: e.target.value }))}
              className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />
          </div>

          {/* Clip section */}
          <div className="mt-3 rounded-xl border border-border bg-card/40 p-2">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Animation clip
            </p>
            <div className="mb-2 flex gap-1">
              {CLIP_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setDraft((d) => ({ ...d, clip_type: t, clip_path: t === "none" ? "" : d.clip_path }))}
                  className={`flex-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${draft.clip_type === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {draft.clip_type !== "none" && (
              <>
                <input
                  placeholder={draft.clip_type === "mp4" ? "Video URL (.mp4)" : "SVG path or URL"}
                  value={draft.clip_path}
                  onChange={(e) => setDraft((d) => ({ ...d, clip_path: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
                />
                {draft.clip_type === "mp4" && (
                  <div className="mt-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="video/mp4,video/*"
                      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card/40 py-2 text-[11px] font-bold text-muted-foreground disabled:opacity-60"
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {uploading ? "Uploading…" : "Upload MP4 (max 15 MB)"}
                    </button>
                  </div>
                )}
                {draft.clip_path && (
                  <div className="mt-2 grid h-24 w-full place-items-center overflow-hidden rounded-lg bg-black/40">
                    {draft.clip_type === "mp4" ? (
                      <video src={draft.clip_path} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={draft.clip_path} alt="" className="h-full w-full object-contain" />
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isEditing ? (
              <Save className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {isEditing ? "Save changes" : "Add gift"}
          </button>
        </div>
      </div>
    </>
  );
}
