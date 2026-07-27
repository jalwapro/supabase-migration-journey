import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Loader2, Upload, Save, X, Play, Search, Eye, EyeOff, DollarSign } from "lucide-react";
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
  icon?: string | null;
  price: number;
  category: string;
  animation: string;
  sort_order: number;
  is_active: boolean;
  clip_path: string | null;
  clip_type: string | null;
  image_url?: string | null;
  is_milestone?: boolean | null;
  chromakey?: string | null;
};

const CATEGORIES = ["popular", "classic", "love", "luxury", "vip", "lucky", "premium"] as const;
const CLIP_TYPES = ["none", "svg", "mp4", "webm"] as const;
const CHROMAKEY_OPTIONS = [
  { value: "auto", label: "Auto", hint: "Detect from name (default)" },
  { value: "none", label: "None", hint: "No key — render as-is" },
  { value: "screen", label: "Screen blend", hint: "Knock out pure-black bg" },
  { value: "luma", label: "Luma key", hint: "Aggressive black removal" },
] as const;
type Chromakey = (typeof CHROMAKEY_OPTIONS)[number]["value"];

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
  chromakey: Chromakey;
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
  chromakey: "auto",
};

const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_MP4_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/82be6f35-cb0c-44fc-8232-8514da26b101/royal-rose.mp4`;
const ROYAL_ROSE_THUMB_URL = `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;

function isRoyalRoseGift(name: string | null | undefined) {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return normalized === "royal rose" || (normalized.includes("royal") && normalized.includes("rose"));
}

function resolveGiftMediaUrl(url: string | null | undefined) {
  const value = (url ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/__l5e/")) return `${LOVABLE_ASSET_ORIGIN}${value}`;
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return value;
  if (value.includes("__l5e/assets-v1/")) return `${LOVABLE_ASSET_ORIGIN}/${value.slice(value.indexOf("__l5e/assets-v1/"))}`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(value)) {
    return `${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/${value}`;
  }
  return value;
}

function GiftMediaPreview({
  name,
  clipPath,
  clipType,
  imageUrl,
  emoji,
}: {
  name: string;
  clipPath: string | null | undefined;
  clipType: string | null | undefined;
  imageUrl?: string | null;
  emoji?: string | null;
}) {
  const royalRose = isRoyalRoseGift(name) || (clipPath ?? "").includes("royal-rose");
  const src = royalRose ? ROYAL_ROSE_THUMB_URL : resolveGiftMediaUrl(clipPath);
  const fallbackImage = royalRose ? ROYAL_ROSE_THUMB_URL : resolveGiftMediaUrl(imageUrl);
  const [videoFailed, setVideoFailed] = useState(false);

  if (src && (royalRose || clipType === "svg" || videoFailed)) {
    return <img src={src} alt={name} className="h-full w-full object-contain" />;
  }

  if (src && (clipType === "mp4" || clipType === "webm")) {
    return (
      <video
        src={src}
        poster={fallbackImage ?? undefined}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onError={() => setVideoFailed(true)}
        className="h-full w-full object-contain"
      />
    );
  }

  if (fallbackImage) {
    return <img src={fallbackImage} alt={name} className="h-full w-full object-contain" />;
  }

  return <span className="text-4xl">{emoji ?? "🎁"}</span>;
}

function GiftsAdmin() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; clipPath: string | null; clipType: string | null; imageUrl: string | null; emoji: string | null; chromakey: Chromakey } | null>(null);
  const [activeCat, setActiveCat] = useState<string>("popular");
  const [search, setSearch] = useState("");
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);
  const isEditing = Boolean(draft.id);

  const list = useQuery({
    queryKey: ["admin_gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,emoji,icon,price,category,animation,sort_order,is_active,clip_path,clip_type,image_url,is_milestone,chromakey")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as GiftRow[];
    },
  });

  const upload = async (file: File) => {
    if (!file.type.startsWith("video/") && !/\.(mp4|webm)$/i.test(file.name)) {
      toast.error("Please pick an MP4 or WebM video");
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
      setDraft((d) => ({ ...d, clip_path: data.publicUrl, clip_type: ext === "webm" ? "webm" : "mp4" }));
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
      const royalRose = isRoyalRoseGift(draft.name);
      const row = {
        name: draft.name.trim(),
        emoji: draft.emoji || "🎁",
        icon: draft.emoji || "🎁",
        price: draft.price,
        price_coins: draft.price,
        category: draft.category,
        animation: draft.animation || "pop",
        sort_order: draft.sort_order,
        clip_path: royalRose ? ROYAL_ROSE_MP4_URL : draft.clip_type === "none" ? null : resolveGiftMediaUrl(draft.clip_path) || null,
        clip_type: royalRose ? "mp4" : draft.clip_type === "none" ? "mp4" : draft.clip_type,
        ...(royalRose ? { image_url: ROYAL_ROSE_THUMB_URL } : {}),
        is_active: true,
        active: true,
        is_milestone: draft.is_milestone,
        chromakey: draft.chromakey,
      };
      // Multiple milestone gifts allowed (host picks one on 100%).
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
    const royalRose = isRoyalRoseGift(g.name);
    setDraft({
      id: g.id,
      name: g.name,
      emoji: g.emoji || "🎁",
      price: g.price,
      category: g.category,
      animation: g.animation || "pop",
      sort_order: g.sort_order,
      clip_path: royalRose ? ROYAL_ROSE_MP4_URL : resolveGiftMediaUrl(g.clip_path) ?? "",
      clip_type: (royalRose || g.clip_path
        ? g.clip_type === "svg"
          ? "svg"
          : g.clip_type === "webm"
            ? "webm"
            : "mp4"
        : "none") as Draft["clip_type"],
      is_milestone: Boolean(g.is_milestone),
      chromakey: (["auto", "none", "screen", "luma"].includes(g.chromakey ?? "") ? (g.chromakey as Chromakey) : "auto"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <AdminPageHeader
        title="Gifts Management"
        subtitle="Add SVG, MP4, or WebM animated gifts. Videos upload to shop-assets/gift-clips."
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
                  <GiftMediaPreview
                    name={g.name}
                    clipPath={g.clip_path}
                    clipType={g.clip_type}
                    imageUrl={g.image_url}
                    emoji={g.emoji ?? g.icon}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {g.is_milestone && <span title="Milestone gift">⭐ </span>}
                      {g.name}
                    </p>
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
                    onClick={() =>
                      setPreview({
                        name: g.name,
                        clipPath: g.clip_path ?? null,
                        clipType: g.clip_type ?? null,
                        imageUrl: g.image_url ?? null,
                        emoji: g.emoji ?? g.icon ?? null,
                        chromakey: (["auto", "none", "screen", "luma"].includes(g.chromakey ?? "") ? g.chromakey : "auto") as Chromakey,
                      })
                    }
                    className="rounded-lg bg-[color:var(--gold)]/15 px-2 text-[color:var(--gold)]"
                    title="Full preview"
                  >
                    <Play className="h-3 w-3" />
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
            <label className="col-span-2 flex items-center gap-2 rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-2 py-1.5 text-[11px] font-bold">
              <input
                type="checkbox"
                checked={draft.is_milestone}
                onChange={(e) => setDraft((d) => ({ ...d, is_milestone: e.target.checked }))}
              />
              ⭐ Milestone gift — mark up to 3. Host picks one when a room hits 100%.
            </label>
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
                  placeholder={draft.clip_type === "svg" ? "SVG path or URL" : "Video URL (.mp4/.webm)"}
                  value={draft.clip_path}
                  onChange={(e) => setDraft((d) => ({ ...d, clip_path: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
                />
                {(draft.clip_type === "mp4" || draft.clip_type === "webm") && (
                  <div className="mt-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="video/mp4,video/webm,video/*"
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
                      {uploading ? "Uploading…" : "Upload MP4/WebM (max 15 MB)"}
                    </button>
                  </div>
                )}
                {draft.clip_path && (
                  <div className="mt-2 grid h-24 w-full place-items-center overflow-hidden rounded-lg bg-black/40">
                    <GiftMediaPreview
                      name={draft.name}
                      clipPath={draft.clip_path}
                      clipType={draft.clip_type}
                      emoji={draft.emoji}
                    />
                  </div>
                )}
              </>
            )}

            {/* Chromakey */}
            <div className="mt-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Chromakey / transparency
              </p>
              <div className="grid grid-cols-4 gap-1">
                {CHROMAKEY_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setDraft((d) => ({ ...d, chromakey: c.value }))}
                    title={c.hint}
                    className={`rounded-lg px-1 py-1.5 text-[10px] font-bold uppercase ${draft.chromakey === c.value ? "bg-[color:var(--gold)] text-black" : "bg-card text-muted-foreground"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {CHROMAKEY_OPTIONS.find((c) => c.value === draft.chromakey)?.hint}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setPreview({
                name: draft.name || "Preview",
                clipPath: draft.clip_type === "none" ? null : resolveGiftMediaUrl(draft.clip_path) || draft.clip_path || null,
                clipType: draft.clip_type === "none" ? null : draft.clip_type,
                imageUrl: null,
                emoji: draft.emoji,
                chromakey: draft.chromakey,
              })
            }
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 py-2 text-xs font-bold text-[color:var(--gold)]"
          >
            <Play className="h-3.5 w-3.5" />
            Full-screen preview
          </button>

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

      {preview && (
        <div
          className="fixed inset-0 z-[2147483000] grid place-items-center bg-black/85 backdrop-blur"
          onClick={() => setPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[min(90dvh,720px)] w-[min(94vw,480px)] flex-col items-center justify-center rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-b from-[#1a0b2e] to-black p-4"
          >
            <button
              onClick={() => setPreview(null)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-3 text-center">
              <p className="text-sm font-bold text-white">{preview.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-[color:var(--gold)]">
                chromakey: {preview.chromakey}
              </p>
            </div>
            <div className="grid flex-1 w-full place-items-center overflow-hidden rounded-2xl">
              {(() => {
                const style: React.CSSProperties = {
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  background: "transparent",
                  ...(preview.chromakey === "screen" ? { mixBlendMode: "screen" as const } : {}),
                  ...(preview.chromakey === "luma" ? { filter: "url(#jalwa-luma-key)" } : {}),
                };
                const src = preview.clipPath || preview.imageUrl;
                if (!src) {
                  return <div className="text-6xl">{preview.emoji ?? "🎁"}</div>;
                }
                if (preview.clipType === "mp4" || preview.clipType === "webm" || /\.(mp4|webm)(\?|$)/i.test(src)) {
                  return (
                    <video
                      src={src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={style}
                    />
                  );
                }
                return <img src={src} alt={preview.name} style={style} />;
              })()}
            </div>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Tap outside to close. Room viewers will see this exact rendering.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
