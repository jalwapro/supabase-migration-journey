import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, Loader2, Upload, Save, X, Search, Eye, EyeOff, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/emojis")({
  component: EmojisAdmin,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Failed to load emojis: {error?.message}</div>
  ),
});

type EmojiRow = {
  id: string;
  slug: string;
  emoji: string;
  name: string;
  category: string;
  clip_path: string;
  sort_order: number;
  is_active: boolean;
  tier: "normal" | "vip";
  min_vip_level: number;
  is_animated: boolean;
};

const TIERS = [
  { key: "normal", label: "Normal", tone: "bg-slate-500/20 text-slate-200 border-slate-500/40" },
  { key: "vip", label: "👑 VIP Only", tone: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
] as const;

type TierKey = (typeof TIERS)[number]["key"];

const CATEGORIES = ["popular", "love", "funny", "party", "magic", "action", "cute", "vip", "premium"] as const;

type Draft = {
  id?: string;
  slug: string;
  emoji: string;
  name: string;
  category: string;
  clip_path: string;
  sort_order: number;
  tier: TierKey;
  min_vip_level: number;
  is_animated: boolean;
};

function makeEmpty(tier: TierKey): Draft {
  return {
    slug: "",
    emoji: "✨",
    name: "",
    category: "popular",
    clip_path: "",
    sort_order: 99,
    tier,
    min_vip_level: tier === "vip" ? 1 : 0,
    is_animated: true,
  };
}

function EmojisAdmin() {
  const qc = useQueryClient();
  const [activeTier, setActiveTier] = useState<TierKey>("normal");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: emojis = [], isLoading } = useQuery({
    queryKey: ["admin_emojis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_emojis")
        .select("*")
        .order("tier", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmojiRow[];
    },
  });

  const byTier = useMemo(() => {
    const grouped: Record<TierKey, EmojiRow[]> = { normal: [], vip: [] };
    for (const e of emojis) {
      const raw = (e.tier ?? "normal") as string;
      const t: TierKey = raw === "normal" ? "normal" : "vip";
      grouped[t].push(e);
    }
    return grouped;
  }, [emojis]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = byTier[activeTier] ?? [];
    if (!q) return list;
    return list.filter((e) =>
      [e.name, e.slug, e.emoji, e.category].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [byTier, activeTier, search]);

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const tier = d.tier === "vip" ? "vip" : "normal";
      const row = {
        slug: d.slug.trim(),
        emoji: d.emoji.trim() || "✨",
        name: d.name.trim(),
        category: d.category,
        clip_path: d.clip_path.trim(),
        sort_order: d.sort_order,
        tier,
        min_vip_level: tier === "vip" ? Math.max(1, d.min_vip_level) : 0,
        is_animated: d.is_animated,
        is_active: true,
      };
      if (!row.slug) throw new Error("Slug required");
      if (!row.name) throw new Error("Name required");
      if (!row.clip_path) throw new Error("Asset URL required (upload image/webm)");
      if (d.id) {
        const { error } = await supabase.from("chat_emojis").update(row).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chat_emojis").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_emojis"] });
      qc.invalidateQueries({ queryKey: ["room_emojis"] });
      toast.success("Emoji saved");
      setDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("chat_emojis").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_emojis"] });
      qc.invalidateQueries({ queryKey: ["room_emojis"] });
    },
  });

  const deleteEmoji = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_emojis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_emojis"] });
      qc.invalidateQueries({ queryKey: ["room_emojis"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkTier = useMutation({
    mutationFn: async (action: "hide_all" | "show_all") => {
      const ids = filtered.map((e) => e.id);
      if (!ids.length) return;
      const { error } = await supabase
        .from("chat_emojis")
        .update({ is_active: action === "show_all" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_emojis"] });
      qc.invalidateQueries({ queryKey: ["room_emojis"] });
      toast.success("Applied");
    },
  });

  const upload = async (file: File, onDone: (url: string) => void) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Max 15 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `emoji-assets/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("shop-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
      onDone(data.publicUrl);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24">
      <AdminPageHeader title="Emoji Management" subtitle="Normal & VIP emojis for room reactions" />

      {/* Tier tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TIERS.map((t) => {
          const total = byTier[t.key]?.length ?? 0;
          const active = byTier[t.key]?.filter((e) => e.is_active).length ?? 0;
          const selected = activeTier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTier(t.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                selected
                  ? "border-white/40 bg-gradient-to-r from-amber-500 to-fuchsia-500 text-black shadow-lg"
                  : `${t.tone} hover:bg-white/10`
              }`}
            >
              {t.label} <span className="opacity-70">({active}/{total})</span>
            </button>
          );
        })}
      </div>

      {/* Search + bulk + add */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name / slug"
            className="h-9 w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-amber-400/50 focus:outline-none"
          />
        </div>
        <button
          onClick={() => bulkTier.mutate("show_all")}
          disabled={bulkTier.isPending || !filtered.length}
          className="h-9 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
        >
          <Eye className="mr-1 inline h-3 w-3" /> Show all
        </button>
        <button
          onClick={() => bulkTier.mutate("hide_all")}
          disabled={bulkTier.isPending || !filtered.length}
          className="h-9 rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-500/20"
        >
          <EyeOff className="mr-1 inline h-3 w-3" /> Hide all
        </button>
        <button
          onClick={() => setDraft(makeEmpty(activeTier))}
          className="h-9 rounded-lg bg-gradient-to-r from-amber-500 to-fuchsia-500 px-3 text-xs font-black text-black hover:brightness-110"
        >
          <Plus className="mr-1 inline h-3 w-3" /> New emoji
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="mt-8 grid place-items-center text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((e) => (
            <div
              key={e.id}
              className={`group relative rounded-xl border p-2 ${
                e.is_active ? "border-white/10 bg-white/5" : "border-red-500/30 bg-red-500/5 opacity-70"
              }`}
            >
              <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-black/40">
                {e.clip_path ? (
                  <img src={e.clip_path} alt={e.name} className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <span className="text-3xl">{e.emoji}</span>
                )}
              </div>
              <div className="mt-1.5 truncate text-[11px] font-semibold text-white">{e.name}</div>
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span className="truncate">{e.slug}</span>
                {e.min_vip_level > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-300">
                    <Crown className="h-2.5 w-2.5" /> {e.min_vip_level}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex gap-1">
                <button
                  onClick={() => setDraft({ ...e, id: e.id } as Draft)}
                  className="flex-1 rounded-md bg-white/10 py-1 text-[10px] font-semibold hover:bg-white/20"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive.mutate({ id: e.id, is_active: !e.is_active })}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                    e.is_active ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-500/20 text-slate-300"
                  }`}
                  title={e.is_active ? "Hide" : "Show"}
                >
                  {e.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${e.name}"?`)) deleteEmoji.mutate(e.id);
                  }}
                  className="rounded-md bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-500/30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {!filtered.length && (
            <div className="col-span-full py-12 text-center text-sm text-white/50">
              No emojis in this tier. Click "New emoji" to add one.
            </div>
          )}
        </div>
      )}

      {/* Draft modal */}
      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-gradient-to-b from-slate-900 to-black p-5 text-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">{draft.id ? "Edit emoji" : "New emoji"}</h2>
              <button onClick={() => setDraft(null)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="text-white/60">Slug (unique)</span>
                  <input
                    value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                    placeholder="jalwa_kiss"
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-white/60">Name</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Jalwa Kiss"
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-white/60">Emoji</span>
                  <input
                    value={draft.emoji}
                    onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-white/60">Category</span>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-white/60">Tier</span>
                  <select
                    value={draft.tier}
                    onChange={(e) => {
                      const tier = e.target.value as TierKey;
                      setDraft({ ...draft, tier, min_vip_level: tier === "vip" ? Math.max(1, draft.min_vip_level) : 0 });
                    }}
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  >
                    {TIERS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-white/60">Min VIP level</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.min_vip_level}
                    onChange={(e) => setDraft({ ...draft, min_vip_level: parseInt(e.target.value) || 0 })}
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-white/60">Sort order</span>
                  <input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: parseInt(e.target.value) || 0 })}
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                  />
                </label>
              </div>

              <label className="text-xs">
                <span className="text-white/60">Asset URL (PNG / WebM / Lottie / GIF)</span>
                <input
                  value={draft.clip_path}
                  onChange={(e) => setDraft({ ...draft, clip_path: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                />
              </label>

              <label
                htmlFor="emoji-upload"
                className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-white/20 bg-white/5 text-xs hover:bg-white/10"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? "Uploading…" : "Upload (max 15 MB)"}
              </label>
              <input
                id="emoji-upload"
                type="file"
                accept="image/*,video/webm,video/mp4,.lottie,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f, (url) => setDraft((d) => (d ? { ...d, clip_path: url } : d)));
                }}
              />

              {draft.clip_path && (
                <div className="grid h-20 place-items-center overflow-hidden rounded-md bg-black/40">
                  <img src={draft.clip_path} alt="preview" className="h-full w-full object-contain" />
                </div>
              )}

              <button
                onClick={() => saveMutation.mutate(draft)}
                disabled={saveMutation.isPending}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-fuchsia-500 text-sm font-black text-black hover:brightness-110 disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
