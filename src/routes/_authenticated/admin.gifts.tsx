import { createFileRoute } from "@tanstack/react-router";
import { uploadFileAtPath } from "@/lib/uploads";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Loader2, Upload, Save, X, Play, Search, Eye, EyeOff, DollarSign, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";


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
  audio_url?: string | null;
  sound_url?: string | null;
  audio_enabled?: boolean | null;
  audio_volume?: number | string | null;
};

const CATEGORIES = ["popular", "classic", "love", "romantic", "party", "fantasy", "luxury", "premium", "vip", "lucky"] as const;
const CATEGORY_TABS = ["all", ...CATEGORIES] as const;
const CLIP_TYPES = ["none", "svg", "mp4", "webm"] as const;

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
  /** PNG/WebP thumbnail shown in the gift box grid. */
  image_url: string;
  is_milestone: boolean;
  /** Dedicated sound file (falls back to the clip's own audio track). */
  audio_url: string;
  /** Admin master switch — off means this gift is silent for every user. */
  audio_enabled: boolean;
  /** Per-gift gain 0–1 applied on top of the user's own volume. */
  audio_volume: number;
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
  image_url: "",
  is_milestone: false,
  audio_url: "",
  audio_enabled: true,
  audio_volume: 1,
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
  const [preview, setPreview] = useState<{ name: string; clipPath: string | null; clipType: string | null; imageUrl: string | null; emoji: string | null; audioUrl: string | null; audioEnabled: boolean; audioVolume: number } | null>(null);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(1);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  // A gift muted in the admin panel is silent in the preview too.
  const effectiveMuted = previewMuted || previewVolume <= 0 || preview?.audioEnabled === false;
  // Preview plays at the gift's saved gain multiplied by the local preview slider.
  useEffect(() => {
    const gain = Math.max(0, Math.min(1, previewVolume * (preview?.audioVolume ?? 1)));
    if (previewAudioRef.current) previewAudioRef.current.volume = gain;
    if (previewVideoRef.current) previewVideoRef.current.volume = gain;
  }, [previewVolume, preview?.audioVolume, preview?.audioUrl, preview?.clipPath, effectiveMuted]);
  // Reset the preview slider each time a different gift is opened.
  useEffect(() => {
    setPreviewMuted(false);
    setPreviewVolume(1);
  }, [preview?.name, preview?.clipPath]);

  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);
  const isEditing = Boolean(draft.id);

  const list = useQuery({
    queryKey: ["admin_gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("id,name,emoji,icon,price,category,animation,sort_order,is_active,clip_path,clip_type,image_url,is_milestone,audio_url,sound_url,audio_enabled,audio_volume")
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
      const publicUrl = await uploadFileAtPath("shop-assets", path, file);
      setDraft((d) => ({ ...d, clip_path: publicUrl, clip_type: ext === "webm" ? "webm" : "mp4" }));
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
        image_url: royalRose ? ROYAL_ROSE_THUMB_URL : draft.image_url.trim() || null,
        is_active: true,
        active: true,
        is_milestone: draft.is_milestone,
        audio_url: draft.audio_url.trim() || null,
        audio_enabled: draft.audio_enabled,
        audio_volume: draft.audio_enabled ? Math.max(0, Math.min(1, draft.audio_volume)) : 0,
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
      setDraft({ ...EMPTY_DRAFT, category: activeCat === "all" ? EMPTY_DRAFT.category : activeCat });
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

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await supabase.from("gifts").update({ price, price_coins: price }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Price updated");
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkToggle = useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      const { error } = await supabase.from("gifts").update({ is_active: active, active }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} gifts ${v.active ? "shown" : "hidden"}`);
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkPricePct = useMutation({
    mutationFn: async ({ ids, pct }: { ids: string[]; pct: number }) => {
      const rows = (list.data ?? []).filter((g) => ids.includes(g.id));
      const updates = rows.map((g) => ({ id: g.id, newPrice: Math.max(1, Math.round(g.price * (1 + pct / 100))) }));
      for (const u of updates) {
        const { error } = await supabase.from("gifts").update({ price: u.newPrice, price_coins: u.newPrice }).eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(`Adjusted ${v.ids.length} prices by ${v.pct > 0 ? "+" : ""}${v.pct}%`);
      qc.invalidateQueries({ queryKey: ["admin_gifts"] });
      qc.invalidateQueries({ queryKey: ["gifts"] });
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
      image_url: royalRose ? ROYAL_ROSE_THUMB_URL : g.image_url ?? "",
      is_milestone: Boolean(g.is_milestone),
      audio_url: g.audio_url ?? g.sound_url ?? "",
      audio_enabled: g.audio_enabled !== false && Number(g.audio_volume ?? 1) > 0,
      audio_volume: Number(g.audio_volume ?? 1),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const catCounts = useMemo(() => {
    const map: Record<string, { total: number; active: number }> = {};
    map.all = { total: 0, active: 0 };
    for (const c of CATEGORIES) map[c] = { total: 0, active: 0 };
    for (const g of list.data ?? []) {
      if (!map[g.category]) map[g.category] = { total: 0, active: 0 };
      map.all.total++;
      map[g.category].total++;
      if (g.is_active) {
        map.all.active++;
        map[g.category].active++;
      }
    }
    return map;
  }, [list.data]);

  const filteredGifts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((g) => {
      if (activeCat !== "all" && g.category !== activeCat) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q) || String(g.price).includes(q);
    });
  }, [list.data, activeCat, search]);

  const activeIds = filteredGifts.map((g) => g.id);

  return (
    <>
      <AdminPageHeader
        title="Gifts Management"
        subtitle="Category-wise windows. Search, inline price edit, bulk hide/show and % price adjust."
      />

      {/* Category tabs */}
      <div className="mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {CATEGORY_TABS.map((c) => {
          const stat = catCounts[c] ?? { total: 0, active: 0 };
          const active = activeCat === c;
          return (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${active ? "bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground shadow-lg" : "bg-card/60 text-muted-foreground hover:text-foreground"}`}
            >
              {c}
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-black/25 text-white" : "bg-black/30 text-[color:var(--gold)]"}`}>
                {stat.active}/{stat.total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_360px]">
        {/* Gift list */}
        <div>
          {/* Search + bulk bar */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <div className="flex flex-1 items-center gap-1.5 rounded-full border border-border bg-input/60 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search in ${activeCat}…`}
                className="w-full bg-transparent text-xs outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Bulk ({activeIds.length}):
            </span>
            <button
              disabled={!activeIds.length || bulkToggle.isPending}
              onClick={() => bulkToggle.mutate({ ids: activeIds, active: true })}
              className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400 disabled:opacity-40"
            >
              <Eye className="h-3 w-3" /> Show all
            </button>
            <button
              disabled={!activeIds.length || bulkToggle.isPending}
              onClick={() => bulkToggle.mutate({ ids: activeIds, active: false })}
              className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-400 disabled:opacity-40"
            >
              <EyeOff className="h-3 w-3" /> Hide all
            </button>
            <button
              disabled={!activeIds.length || bulkPricePct.isPending}
              onClick={() => {
                const v = prompt(`Adjust ALL ${activeIds.length} prices in "${activeCat}" by % (e.g. 10 = +10%, -20 = -20%)`);
                const pct = Number(v);
                if (!Number.isFinite(pct) || pct === 0) return;
                bulkPricePct.mutate({ ids: activeIds, pct });
              }}
              className="flex items-center gap-1 rounded-full bg-[color:var(--gold)]/15 px-2.5 py-1 text-[10px] font-bold text-[color:var(--gold)] disabled:opacity-40"
            >
              <DollarSign className="h-3 w-3" /> Price ±%
            </button>
            {bulkPricePct.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>

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
            {filteredGifts.map((g) => (
              <div
                key={g.id}
                className={`glass flex flex-col gap-1.5 rounded-xl p-2 text-xs ${draft.id === g.id ? "ring-2 ring-[color:var(--primary)]" : ""} ${!g.is_active ? "opacity-60" : ""}`}
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
                    {editingPrice?.id === g.id ? (
                      <div className="mt-0.5 flex items-center gap-1">
                        <input
                          type="number"
                          autoFocus
                          value={editingPrice.value}
                          onChange={(e) => setEditingPrice({ id: g.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const n = Number(editingPrice.value);
                              if (Number.isFinite(n) && n > 0) updatePrice.mutate({ id: g.id, price: n });
                              setEditingPrice(null);
                            } else if (e.key === "Escape") {
                              setEditingPrice(null);
                            }
                          }}
                          onBlur={() => {
                            const n = Number(editingPrice.value);
                            if (Number.isFinite(n) && n > 0 && n !== g.price) updatePrice.mutate({ id: g.id, price: n });
                            setEditingPrice(null);
                          }}
                          className="w-full rounded border border-[color:var(--gold)]/60 bg-black/40 px-1 py-0.5 text-[10px] text-[color:var(--gold)] outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingPrice({ id: g.id, value: String(g.price) })}
                        className="block w-full truncate text-left text-[10px] text-[color:var(--gold)] hover:underline"
                        title="Tap to edit price"
                      >
                        💰 {g.price?.toLocaleString()}{g.clip_type ? ` · ${g.clip_type}` : ""}
                      </button>
                    )}
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
                        audioUrl: resolveGiftMediaUrl(g.audio_url ?? g.sound_url),
                        audioEnabled: g.audio_enabled !== false && Number(g.audio_volume ?? 1) > 0,
                        audioVolume: Number(g.audio_volume ?? 1),
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
            {!list.isLoading && filteredGifts.length === 0 && (
              <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                No gifts in "{activeCat}"{search ? ` matching "${search}"` : ""}.
              </p>
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

          {/* Thumbnail (PNG shown in the gift box grid) */}
          <div className="mt-3 rounded-xl border border-border bg-card/40 p-2">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Gift box thumbnail (PNG/WebP)
            </p>
            <FileUploader
              bucket="shop-assets"
              folder="gift-thumbs"
              accept="image/png,image/webp,image/jpeg,image/gif"
              label="Upload thumbnail"
              value={draft.image_url}
              onChange={(url) => setDraft((d) => ({ ...d, image_url: url ?? "" }))}
              previewKind="image"
              maxSizeMB={8}
            />
            <input
              placeholder="…or paste an image URL"
              value={draft.image_url}
              onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
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
          </div>

          {/* Gift audio — admin master control */}
          <div className="mt-3 rounded-xl border border-border bg-card/40 p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Gift audio
              </p>
              <button
                onClick={() => setDraft((d) => ({ ...d, audio_enabled: !d.audio_enabled }))}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                  draft.audio_enabled
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {draft.audio_enabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                {draft.audio_enabled ? "Sound on" : "Muted"}
              </button>
            </div>

            <FileUploader
              bucket="shop-assets"
              folder="gift-audio"
              accept="audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/ogg,audio/*"
              label="Upload sound (MP3/AAC/WAV)"
              value={draft.audio_url}
              onChange={(url) => setDraft((d) => ({ ...d, audio_url: url ?? "" }))}
              maxSizeMB={8}
            />
            <input
              placeholder="…or paste an audio URL (blank = use the clip's own audio)"
              value={draft.audio_url}
              onChange={(e) => setDraft((d) => ({ ...d, audio_url: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs outline-none"
            />

            <div className="mt-2 flex items-center gap-2">
              <VolumeX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={!draft.audio_enabled}
                value={Math.round(draft.audio_volume * 100)}
                onChange={(e) => setDraft((d) => ({ ...d, audio_volume: Number(e.target.value) / 100 }))}
                className="flex-1 accent-[color:var(--primary)] disabled:opacity-40"
              />
              <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums">
                {draft.audio_enabled ? `${Math.round(draft.audio_volume * 100)}%` : "0%"}
              </span>
            </div>
            {draft.audio_url && (
              <audio
                key={draft.audio_url}
                src={resolveGiftMediaUrl(draft.audio_url) ?? undefined}
                controls
                className="mt-2 h-8 w-full"
              />
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Muting here silences this gift for every user in every room. Volume is applied on top of
              each user&apos;s own gift-sound setting.
            </p>
          </div>


          <button
            onClick={() =>
              setPreview({
                name: draft.name || "Preview",
                clipPath: draft.clip_type === "none" ? null : resolveGiftMediaUrl(draft.clip_path) || draft.clip_path || null,
                clipType: draft.clip_type === "none" ? null : draft.clip_type,
                imageUrl: null,
                emoji: draft.emoji,
                audioUrl: resolveGiftMediaUrl(draft.audio_url),
                audioEnabled: draft.audio_enabled,
                audioVolume: draft.audio_volume,
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
            </div>
            <div className="grid flex-1 w-full place-items-center overflow-hidden rounded-2xl">
              {(() => {
                const isVideo = (preview.clipType === "mp4" || preview.clipType === "webm") || !!preview.clipPath?.match(/\.(mp4|webm)(\?|$)/i);
                const style: React.CSSProperties = {
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  background: "transparent",
                };
                const src = preview.clipPath || preview.imageUrl;
                if (!src) {
                  return <div className="text-6xl">{preview.emoji ?? "🎁"}</div>;
                }
                if (isVideo) {
                  return (
                    <div className="grid h-full w-full place-items-center">
                      <video
                        ref={previewVideoRef}
                        src={src}
                        autoPlay
                        loop
                        muted={effectiveMuted || Boolean(preview.audioUrl)}
                        playsInline
                        style={style}
                      />
                    </div>
                  );
                }
                return <img src={src} alt={preview.name} style={style} />;
              })()}
            </div>
            {preview.audioUrl && (
              <audio
                ref={previewAudioRef}
                key={preview.audioUrl}
                src={preview.audioUrl}
                autoPlay
                loop
                muted={effectiveMuted}
              />
            )}

            <div className="mt-3 flex w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <button
                onClick={() => setPreviewMuted((m) => !m)}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  effectiveMuted ? "bg-red-500/20 text-red-400" : "bg-[color:var(--primary)] text-primary-foreground"
                }`}
                aria-label={effectiveMuted ? "Unmute preview" : "Mute preview"}
              >
                {effectiveMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(previewVolume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setPreviewVolume(v);
                  if (v > 0) setPreviewMuted(false);
                }}
                className="flex-1 accent-[color:var(--primary)]"
              />
              <span className="w-16 shrink-0 text-right text-[10px] font-bold tabular-nums text-white/80">
                {effectiveMuted ? "Muted" : `${Math.round(previewVolume * 100)}%`}
              </span>
            </div>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              {preview.audioEnabled
                ? `Saved gift volume: ${Math.round(preview.audioVolume * 100)}% — this preview plays it exactly as rooms will.`
                : "This gift is muted in the admin panel — it plays silently for every user."}
            </p>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              Tap outside to close. Room viewers will see this exact rendering.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
