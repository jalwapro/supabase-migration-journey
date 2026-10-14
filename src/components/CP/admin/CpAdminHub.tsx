import React, { useEffect, useState, useMemo } from "react";
import {
  Heart,
  Gift,
  Crown,
  Sparkles,
  Flame,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Search,
  Check,
  X,
  Eye,
  EyeOff,
  Radio,
  Users,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Layers,
  Save,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { uploadFileAtPath, uploadToBucket } from "@/lib/uploads";
import { CpSeatAura } from "@/components/CP/CpSeatAura";
import { CpStageConnectionOverlay } from "@/components/CP/CpStageConnectionOverlay";

export type AdminTab = "gifts" | "levels" | "seats" | "couples";

export interface CpExclusiveGiftRow {
  id: string;
  name: string;
  price: number;
  icon_url: string;
  intimacy_points: number;
  required_cp_level: number;
  animation_url: string | null;
  broadcast_threshold: boolean;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface CpLevelRow {
  level: number;
  name: string;
  min_intimacy: number;
  seat_frame_url: string | null;
  entrance_effect_url: string | null;
  badge_url: string | null;
}

export interface CoupleMonitorRow {
  id: string;
  user1_id: string;
  user2_id: string;
  ring_level: number;
  intimacy_score: number;
  status: string;
  created_at: string;
  user1?: { username: string; avatar: string | null };
  user2?: { username: string; avatar: string | null };
}

export function CpAdminHub() {
  const [activeTab, setActiveTab] = useState<AdminTab>("gifts");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 text-foreground">
      <AdminPageHeader
        title="Couple Ecosystem Admin Hub"
        subtitle="Full A-to-Z control over Couple Gifts, Levels, Voice-Room Seats & Effects, and Live Couples Monitor."
      />

      {/* Primary Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-pink-500/20 bg-card/60 p-1.5 shadow-md backdrop-blur-md">
        {[
          { id: "gifts", label: "Couple Gifts", icon: Gift, countBadge: null },
          { id: "levels", label: "Levels & Badges", icon: Crown, countBadge: null },
          { id: "seats", label: "Seats & Stage Effects", icon: Sparkles, countBadge: null },
          { id: "couples", label: "Couples Monitor", icon: Users, countBadge: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/25"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-pink-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab === "gifts" && <CpGiftsTab />}
      {activeTab === "levels" && <CpLevelsTab />}
      {activeTab === "seats" && <CpSeatsShowroomTab />}
      {activeTab === "couples" && <CpCouplesMonitorTab />}
    </div>
  );
}

// =========================================================================
// TAB 1: COUPLE EXCLUSIVE GIFTS MANAGEMENT
// =========================================================================
function CpGiftsTab() {
  const [gifts, setGifts] = useState<CpExclusiveGiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<CpExclusiveGiftRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingAnim, setUploadingAnim] = useState(false);

  // Form State
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(1999);
  const [formIntimacy, setFormIntimacy] = useState(200);
  const [formLevel, setFormLevel] = useState(1);
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formAnimUrl, setFormAnimUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formBroadcast, setFormBroadcast] = useState(false);
  const [formSort, setFormSort] = useState(1);
  const [formActive, setFormActive] = useState(true);

  const fetchGifts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cp_exclusive_gifts_config")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setGifts(data ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load CP gifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGifts();
  }, []);

  const openCreateModal = () => {
    setEditingGift(null);
    setFormId(`cp_${Date.now().toString(36)}`);
    setFormName("");
    setFormPrice(2999);
    setFormIntimacy(300);
    setFormLevel(1);
    setFormIconUrl("/gifts/basic-3d/rose.png");
    setFormAnimUrl("");
    setFormDesc("");
    setFormBroadcast(false);
    setFormSort(gifts.length + 1);
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (gift: CpExclusiveGiftRow) => {
    setEditingGift(gift);
    setFormId(gift.id);
    setFormName(gift.name);
    setFormPrice(gift.price);
    setFormIntimacy(gift.intimacy_points);
    setFormLevel(gift.required_cp_level);
    setFormIconUrl(gift.icon_url || "");
    setFormAnimUrl(gift.animation_url || "");
    setFormDesc(gift.description || "");
    setFormBroadcast(gift.broadcast_threshold);
    setFormSort(gift.sort_order);
    setFormActive(gift.is_active);
    setIsModalOpen(true);
  };

  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim() || !formIconUrl.trim()) {
      toast.error("Please fill in ID, Name, and Icon URL");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        id: formId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        name: formName.trim(),
        price: Number(formPrice),
        intimacy_points: Number(formIntimacy),
        required_cp_level: Number(formLevel),
        icon_url: formIconUrl.trim(),
        animation_url: formAnimUrl.trim() || null,
        description: formDesc.trim() || null,
        broadcast_threshold: formBroadcast,
        sort_order: Number(formSort),
        is_active: formActive,
      };

      const { error } = await supabase
        .from("cp_exclusive_gifts_config")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;
      toast.success(editingGift ? "Gift updated successfully!" : "New Gift added successfully!");
      setIsModalOpen(false);
      void fetchGifts();
    } catch (e: any) {
      toast.error(e.message || "Failed to save gift");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGift = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const { error } = await supabase.from("cp_exclusive_gifts_config").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Deleted ${name}`);
      void fetchGifts();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete gift");
    }
  };

  const handleToggleActive = async (gift: CpExclusiveGiftRow) => {
    try {
      const { error } = await supabase
        .from("cp_exclusive_gifts_config")
        .update({ is_active: !gift.is_active })
        .eq("id", gift.id);
      if (error) throw error;
      toast.success(`${gift.name} is now ${!gift.is_active ? "Active" : "Hidden"}`);
      setGifts((prev) =>
        prev.map((g) => (g.id === gift.id ? { ...g, is_active: !g.is_active } : g))
      );
    } catch (e: any) {
      toast.error(e.message || "Could not toggle status");
    }
  };

  const handleFileUpload = async (file: File, target: "icon" | "anim") => {
    try {
      if (target === "icon") setUploadingIcon(true);
      else setUploadingAnim(true);

      const res = await uploadToBucket("shop-assets", file, "cp-gifts");
      if (target === "icon") {
        setFormIconUrl(res.url);
        toast.success("Icon uploaded to Cloudflare R2!");
      } else {
        setFormAnimUrl(res.url);
        toast.success("Animation file uploaded to Cloudflare R2!");
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      if (target === "icon") setUploadingIcon(false);
      else setUploadingAnim(false);
    }
  };

  const filteredGifts = useMemo(() => {
    return gifts.filter(
      (g) =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.id.toLowerCase().includes(search.toLowerCase())
    );
  }, [gifts, search]);

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search couple gifts by name or ID..."
            className="w-full rounded-xl border border-border bg-card/60 pl-9 pr-4 py-2 text-xs sm:text-sm text-foreground focus:border-pink-500 focus:outline-hidden"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchGifts}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-white/5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-rose-600 hover:to-pink-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Couple Gift</span>
          </button>
        </div>
      </div>

      {/* Gifts Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500 mb-2" />
          <span>Loading Couple Gifts Catalogue...</span>
        </div>
      ) : filteredGifts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No couple gifts found. Click "Add New Couple Gift" above to create your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGifts.map((gift) => (
            <div
              key={gift.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                gift.is_active
                  ? "border-pink-500/30 bg-card hover:border-pink-500/60 shadow-sm"
                  : "border-border bg-card/40 opacity-70"
              }`}
            >
              {/* Top status badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-black text-pink-400 border border-pink-500/20">
                  Lv.{gift.required_cp_level}+ Unlock
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(gift)}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                    gift.is_active
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                  }`}
                  title={gift.is_active ? "Click to deactivate" : "Click to activate"}
                >
                  {gift.is_active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                  <span>{gift.is_active ? "Active" : "Hidden"}</span>
                </button>
              </div>

              {/* Center icon preview */}
              <div className="flex items-center gap-3 my-1">
                <div className="h-16 w-16 shrink-0 rounded-xl border border-pink-500/20 bg-pink-950/20 p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src={gift.icon_url || "/gifts/basic-3d/rose.png"}
                    alt={gift.name}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/gifts/basic-3d/rose.png";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-foreground truncate">{gift.name}</h3>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">{gift.id}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                      <span>🪙</span>
                      <span>{gift.price.toLocaleString()}</span>
                    </span>
                    <span className="text-[10px] text-pink-400 font-bold flex items-center gap-0.5">
                      <Heart className="h-2.5 w-2.5 fill-pink-400" />
                      <span>+{gift.intimacy_points} Intimacy</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Animation tag */}
              <div className="my-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground truncate">
                {gift.animation_url ? (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Sparkles className="h-3 w-3" />
                    <span>Animation linked ({gift.animation_url.endsWith(".svga") ? "SVGA" : "MP4"})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">No animation file attached</span>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => openEditModal(gift)}
                  className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-white/5 cursor-pointer"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGift(gift.id, gift.name)}
                  className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-3xl border border-pink-500/30 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                <span>{editingGift ? "Edit Couple Gift" : "Create New Couple Gift"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGift} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold">
                  Unique ID / Slug
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    disabled={!!editingGift}
                    placeholder="e.g. cp_crystal_castle"
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs sm:text-sm font-mono disabled:opacity-50"
                    required
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Gift Display Name
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Crystal Love Palace"
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs sm:text-sm"
                    required
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Price (Coins)
                  <input
                    type="number"
                    min={1}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs sm:text-sm"
                    required
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Intimacy Points Reward
                  <input
                    type="number"
                    min={1}
                    value={formIntimacy}
                    onChange={(e) => setFormIntimacy(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs sm:text-sm"
                    required
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Required CP Level to Send
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formLevel}
                    onChange={(e) => setFormLevel(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs sm:text-sm"
                    required
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Display Sort Order
                  <input
                    type="number"
                    value={formSort}
                    onChange={(e) => setFormSort(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs sm:text-sm"
                  />
                </label>
              </div>

              {/* Icon Section with Direct File Upload */}
              <div className="rounded-2xl border border-border bg-background/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Gift Icon (PNG / WEBP)</span>
                  <label className="flex items-center gap-1 rounded-lg border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-[11px] font-bold text-pink-400 hover:bg-pink-500/20 cursor-pointer">
                    <Upload className="h-3 w-3" />
                    <span>{uploadingIcon ? "Uploading..." : "Upload File to R2"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingIcon}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, "icon");
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={formIconUrl}
                  onChange={(e) => setFormIconUrl(e.target.value)}
                  placeholder="https://... or /gifts/..."
                  className="w-full rounded-xl border border-border bg-background p-2 text-xs"
                  required
                />
              </div>

              {/* Animation Section with Direct File Upload */}
              <div className="rounded-2xl border border-border bg-background/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Full-Screen Animation (.svga or .mp4)</span>
                  <label className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-400 hover:bg-purple-500/20 cursor-pointer">
                    <Upload className="h-3 w-3" />
                    <span>{uploadingAnim ? "Uploading..." : "Upload Video / SVGA to R2"}</span>
                    <input
                      type="file"
                      accept=".mp4,.webm,.svga,video/*"
                      className="hidden"
                      disabled={uploadingAnim}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, "anim");
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={formAnimUrl}
                  onChange={(e) => setFormAnimUrl(e.target.value)}
                  placeholder="https://... or /animations/..."
                  className="w-full rounded-xl border border-border bg-background p-2 text-xs"
                />
              </div>

              <label className="block text-xs font-semibold">
                Romantic Description / Lore
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="A romantic gift exchanged between true lovers..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-xs"
                />
              </label>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-border text-pink-500 focus:ring-pink-500"
                  />
                  <span>Publish & Display in Gift Sheet</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={formBroadcast}
                    onChange={(e) => setFormBroadcast(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-border text-pink-500 focus:ring-pink-500"
                  />
                  <span>Trigger Room-Wide Broadcast Banner</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2 text-xs font-bold text-white shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{editingGift ? "Save Changes" : "Create Gift"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// TAB 2: COUPLE LEVELS & BADGES MANAGEMENT
// =========================================================================
function CpLevelsTab() {
  const [levels, setLevels] = useState<CpLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLevel, setSavingLevel] = useState<number | null>(null);

  const fetchLevels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cp_levels_config")
        .select("*")
        .order("level", { ascending: true });

      if (error) throw error;
      setLevels(data ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load CP levels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLevels();
  }, []);

  const patchLevel = (level: number, changes: Partial<CpLevelRow>) => {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, ...changes } : l)));
  };

  const saveLevel = async (level: CpLevelRow) => {
    try {
      setSavingLevel(level.level);
      const { error } = await supabase.from("cp_levels_config").upsert(
        {
          level: level.level,
          name: level.name.trim(),
          min_intimacy: Number(level.min_intimacy),
          seat_frame_url: level.seat_frame_url?.trim() || null,
          entrance_effect_url: level.entrance_effect_url?.trim() || null,
          badge_url: level.badge_url?.trim() || null,
        },
        { onConflict: "level" }
      );
      if (error) throw error;
      toast.success(`Level ${level.level} (${level.name}) saved!`);
    } catch (e: any) {
      toast.error(e.message || "Could not save level");
    } finally {
      setSavingLevel(null);
    }
  };

  const handleUploadAsset = async (
    levelNum: number,
    field: "seat_frame_url" | "entrance_effect_url" | "badge_url",
    file: File
  ) => {
    try {
      toast.info(`Uploading ${file.name} to R2...`);
      const res = await uploadToBucket("shop-assets", file, `cp-levels/lv-${levelNum}`);
      patchLevel(levelNum, { [field]: res.url });
      toast.success("Asset uploaded! Click 'Save Level' to persist changes.");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Couple Progression Levels & Assets</h2>
          <p className="text-xs text-muted-foreground">
            Configure intimacy thresholds, exclusive profile badges, shared joint seat frames, and room entrance effects.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLevels}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-white/5 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500 mb-2" />
          <span>Loading CP Progression Configuration...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {levels.map((level) => (
            <div
              key={level.level}
              className="flex flex-col justify-between rounded-2xl border border-pink-500/20 bg-card p-4 space-y-3 shadow-sm hover:border-pink-500/40 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 flex items-center justify-center font-black text-white text-xs shadow">
                    {level.level}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Level {level.level}</h3>
                    <span className="text-[10px] text-muted-foreground">Threshold: {level.min_intimacy.toLocaleString()} pts</span>
                  </div>
                </div>
                <span className="rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-bold text-pink-400 border border-pink-500/20">
                  {level.name}
                </span>
              </div>

              {/* Title & Min Intimacy */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-semibold">
                  Level Title
                  <input
                    type="text"
                    value={level.name}
                    onChange={(e) => patchLevel(level.level, { name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs"
                  />
                </label>
                <label className="block text-[11px] font-semibold">
                  Min Intimacy
                  <input
                    type="number"
                    min={0}
                    value={level.min_intimacy}
                    onChange={(e) => patchLevel(level.level, { min_intimacy: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs"
                  />
                </label>
              </div>

              {/* Badge URL */}
              <div className="rounded-xl border border-border/70 bg-background/40 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Couple Profile Badge</span>
                  <label className="text-[10px] text-pink-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                    <Upload className="h-2.5 w-2.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadAsset(level.level, "badge_url", file);
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={level.badge_url ?? ""}
                  onChange={(e) => patchLevel(level.level, { badge_url: e.target.value })}
                  placeholder="https://... badge image"
                  className="w-full rounded-lg border border-border bg-background p-1.5 text-[11px]"
                />
              </div>

              {/* Joint Seat Frame */}
              <div className="rounded-xl border border-border/70 bg-background/40 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Joint Seat Frame</span>
                  <label className="text-[10px] text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                    <Upload className="h-2.5 w-2.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*,.svga"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadAsset(level.level, "seat_frame_url", file);
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={level.seat_frame_url ?? ""}
                  onChange={(e) => patchLevel(level.level, { seat_frame_url: e.target.value })}
                  placeholder="https://... joint frame URL"
                  className="w-full rounded-lg border border-border bg-background p-1.5 text-[11px]"
                />
              </div>

              {/* Entrance Effect */}
              <div className="rounded-xl border border-border/70 bg-background/40 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Room Entrance Effect</span>
                  <label className="text-[10px] text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                    <Upload className="h-2.5 w-2.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept=".mp4,.webm,.svga,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadAsset(level.level, "entrance_effect_url", file);
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={level.entrance_effect_url ?? ""}
                  onChange={(e) => patchLevel(level.level, { entrance_effect_url: e.target.value })}
                  placeholder="https://... entrance effect (.webm/.svga)"
                  className="w-full rounded-lg border border-border bg-background p-1.5 text-[11px]"
                />
              </div>

              <button
                type="button"
                disabled={savingLevel === level.level}
                onClick={() => void saveLevel(level)}
                className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {savingLevel === level.level ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Level {level.level}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// TAB 3: SEATS & STAGE EFFECTS SHOWROOM
// =========================================================================
function CpSeatsShowroomTab() {
  const [previewAdjacent, setPreviewAdjacent] = useState(true);
  const [previewLevel, setPreviewLevel] = useState(15);
  const [partnerActive, setPartnerActive] = useState(true);

  // Mock couple for interactive preview
  const mockCouple = useMemo(() => {
    return {
      partnerA: {
        seatIndex: 1,
        userId: "user-1",
        username: "Prince",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
        cpLevel: previewLevel,
      },
      partnerB: {
        seatIndex: previewAdjacent ? 2 : 4,
        userId: "user-2",
        username: "Princess",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
        cpLevel: previewLevel,
      },
      intimacyScore: 12500,
      daysTogether: 42,
    };
  }, [previewAdjacent, previewLevel]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Voice Room Stage & Mic Effects Showroom</h2>
          <p className="text-xs text-muted-foreground">
            Test and inspect how Couple Auras, Royal Couple Sofa brackets, and Romantic Laser Beams appear in real voice rooms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewAdjacent(!previewAdjacent)}
            className="rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-400 hover:bg-pink-500/20 cursor-pointer"
          >
            Mode: {previewAdjacent ? "Adjacent Seats (Sofa Bracket)" : "Separated Seats (Laser Beam)"}
          </button>
          <button
            type="button"
            onClick={() => setPartnerActive(!partnerActive)}
            className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-400 hover:bg-purple-500/20 cursor-pointer"
          >
            Partner On Stage: {partnerActive ? "Yes (Sync)" : "No (Solo)"}
          </button>
        </div>
      </div>

      {/* Level Slider */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span>Test CP Aura Level: <span className="text-pink-400 font-bold">Level {previewLevel}</span></span>
          <span className="text-muted-foreground">
            {previewLevel <= 5
              ? "Tier 1: Rose Blossom"
              : previewLevel <= 10
              ? "Tier 2: Violet Royalty"
              : previewLevel < 20
              ? "Tier 3: Golden Rose"
              : "Tier 4: Celestial Sovereign"}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={previewLevel}
          onChange={(e) => setPreviewLevel(Number(e.target.value))}
          className="w-full accent-pink-500 cursor-pointer"
        />
      </div>

      {/* Simulated Voice Room Mic Grid */}
      <div className="relative rounded-3xl border border-pink-500/30 bg-radial from-slate-900 to-black p-6 overflow-visible shadow-2xl">
        <div className="mb-4 flex items-center justify-between text-xs text-pink-300/80">
          <span className="font-bold flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
            <span>Voice Room Stage Preview (10-Seat Grid)</span>
          </span>
          <span className="text-[11px] text-muted-foreground">Tap heart badge to trigger Flying Kiss</span>
        </div>

        {/* The Actual Stage Overlay Component */}
        <div className="relative h-44 w-full max-w-lg mx-auto">
          <CpStageConnectionOverlay couple={partnerActive ? mockCouple : null} capacity={10} />

          {/* Seat Placeholders */}
          <div className="grid grid-cols-5 gap-2 h-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((idx) => {
              const isPartnerA = idx === mockCouple.partnerA.seatIndex;
              const isPartnerB = partnerActive && idx === mockCouple.partnerB.seatIndex;
              const isOccupied = isPartnerA || isPartnerB;
              const partner = isPartnerA ? mockCouple.partnerA : isPartnerB ? mockCouple.partnerB : null;

              return (
                <div key={idx} className="relative flex flex-col items-center justify-center p-1">
                  <div className="relative h-14 w-14 flex items-center justify-center">
                    {isOccupied && partner ? (
                      <CpSeatAura
                        cpLevel={partner.cpLevel}
                        partnerPresentOnStage={partnerActive}
                        isSpeaking={true}
                      >
                        <img
                          src={partner.avatar || ""}
                          alt={partner.username}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-pink-500"
                        />
                      </CpSeatAura>
                    ) : (
                      <div className="h-11 w-11 rounded-full border border-dashed border-white/20 bg-white/5 flex items-center justify-center text-[10px] text-white/40">
                        No.{idx}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-white/80 mt-1 truncate max-w-full">
                    {partner ? partner.username : `Seat ${idx}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explanatory cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
          <h4 className="font-bold text-xs flex items-center gap-1.5 text-pink-400">
            <Heart className="h-4 w-4" />
            <span>Tiered Seat Aura</span>
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When a user has an active partner, their mic seat emits a romantic pulse. If both partners are seated on stage together, the aura triggers <strong>"Love Sync"</strong> with synchronized glowing hearts.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
          <h4 className="font-bold text-xs flex items-center gap-1.5 text-amber-400">
            <Crown className="h-4 w-4" />
            <span>Royal Couple Sofa</span>
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When partners sit side-by-side on adjacent mic seats, their individual frames merge into a shared golden bracket featuring their Days Together counter and Royal Couple badge.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
          <h4 className="font-bold text-xs flex items-center gap-1.5 text-purple-400">
            <Sparkles className="h-4 w-4" />
            <span>Romantic Laser Beam</span>
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When partners sit on separated seats across the stage, a neon laser beam connects them with traveling hearts, letting anyone in the room tap the center badge to send flying kisses.
          </p>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// TAB 4: ACTIVE COUPLES MONITOR
// =========================================================================
function CpCouplesMonitorTab() {
  const [couples, setCouples] = useState<CoupleMonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCouples = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cp_relations")
        .select(`
          id,
          user1_id,
          user2_id,
          ring_level,
          intimacy_score,
          status,
          created_at
        `)
        .order("intimacy_score", { ascending: false });

      if (error) throw error;
      const rows = data ?? [];

      // Fetch profiles for all partner IDs
      const userIds = Array.from(new Set(rows.flatMap((r) => [r.user1_id, r.user2_id])));
      let profileMap: Record<string, { username: string; avatar: string | null }> = {};

      if (userIds.length > 0) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, username, avatar")
          .in("id", userIds);

        if (pData) {
          for (const p of pData) {
            profileMap[p.id] = { username: p.username || "User", avatar: p.avatar };
          }
        }
      }

      const merged: CoupleMonitorRow[] = rows.map((r) => ({
        ...r,
        user1: profileMap[r.user1_id] ?? { username: "User 1", avatar: null },
        user2: profileMap[r.user2_id] ?? { username: "User 2", avatar: null },
      }));

      setCouples(merged);
    } catch (e: any) {
      toast.error(e.message || "Failed to load couples list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCouples();
  }, []);

  const filteredCouples = useMemo(() => {
    return couples.filter((c) => {
      const q = search.toLowerCase();
      return (
        c.user1?.username.toLowerCase().includes(q) ||
        c.user2?.username.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [couples, search]);

  const activeCount = useMemo(() => couples.filter((c) => c.status === "active").length, [couples]);
  const totalIntimacy = useMemo(
    () => couples.reduce((sum, c) => sum + (c.intimacy_score || 0), 0),
    [couples]
  );

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-pink-500/20 bg-card p-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Active Couples</span>
          <div className="text-2xl font-black text-foreground mt-1 flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500 fill-pink-500" />
            <span>{activeCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-card p-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Intimacy Generated</span>
          <div className="text-2xl font-black text-foreground mt-1 flex items-center gap-2">
            <Flame className="h-6 w-6 text-rose-500 fill-rose-500" />
            <span>{totalIntimacy.toLocaleString()}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-card p-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Top Royal Couple</span>
          <div className="text-sm font-bold text-foreground mt-1 truncate">
            {couples[0] ? (
              <span className="text-amber-400">
                {couples[0].user1?.username} 💕 {couples[0].user2?.username} ({couples[0].intimacy_score.toLocaleString()} pts)
              </span>
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search couple by partner username..."
            className="w-full rounded-xl border border-border bg-card/60 pl-9 pr-4 py-2 text-xs sm:text-sm text-foreground focus:border-pink-500 focus:outline-hidden"
          />
        </div>
        <button
          type="button"
          onClick={fetchCouples}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-white/5 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500 mb-2" />
          <span>Loading Couples Data...</span>
        </div>
      ) : filteredCouples.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No couples found matching your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-[10px] font-black uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">Couple Partners</th>
                <th className="p-3">Ring Level</th>
                <th className="p-3">Intimacy Points</th>
                <th className="p-3">Status</th>
                <th className="p-3">Anniversary Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredCouples.map((c) => {
                const ringLabel =
                  c.ring_level === 3 ? "Diamond" : c.ring_level === 2 ? "Gold" : "Silver";
                return (
                  <tr key={c.id} className="hover:bg-white/5 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <img
                            src={c.user1?.avatar || "/gifts/basic/giftbox.png"}
                            alt=""
                            className="h-8 w-8 rounded-full border-2 border-background object-cover"
                          />
                          <img
                            src={c.user2?.avatar || "/gifts/basic/giftbox.png"}
                            alt=""
                            className="h-8 w-8 rounded-full border-2 border-background object-cover"
                          />
                        </div>
                        <div className="font-bold text-foreground">
                          <span>{c.user1?.username}</span>
                          <span className="text-pink-400 mx-1.5">❤️</span>
                          <span>{c.user2?.username}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-400 border border-amber-500/20">
                        {ringLabel} Ring
                      </span>
                    </td>

                    <td className="p-3 font-bold text-pink-400">
                      {c.intimacy_score.toLocaleString()} pts
                    </td>

                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.status === "active"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3 text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CpAdminHub;
