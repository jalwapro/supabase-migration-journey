import { createFileRoute } from "@tanstack/react-router";
import { uploadFileAtPath } from "@/lib/uploads";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Loader2, Save, X, Trash2, Zap, Upload, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/spotlights")({
  component: SpotlightsAdmin,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Failed to load: {error?.message}</div>
  ),
});

type Anim = {
  id: string;
  name: string;
  label: string;
  overlay_asset_url: string | null;
  bg_animation_url: string | null;
  duration_ms: number;
  tier_required: "any" | "vip" | "svip" | "host_only";
  sort_order: number;
  is_active: boolean;
};

type Trigger = {
  id: string;
  user_id: string;
  room_id: string | null;
  trigger_type: string;
  animation_id: string | null;
  triggered_at: string;
  seen_count: number;
};

function SpotlightsAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"animations" | "trigger" | "recent">("animations");

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <AdminPageHeader title="Profile Spotlights" subtitle="Cinematic frames for top gifters / hosts" />

      <div className="mt-4 flex gap-2">
        {(["animations", "trigger", "recent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition ${
              tab === t
                ? "bg-gradient-to-r from-amber-500 to-fuchsia-500 text-black"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {t === "trigger" ? "Manual Trigger" : t}
          </button>
        ))}
      </div>

      {tab === "animations" && <AnimationsTab qc={qc} />}
      {tab === "trigger" && <TriggerTab />}
      {tab === "recent" && <RecentTab />}
    </div>
  );
}

function AnimationsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: anims = [], isLoading } = useQuery({
    queryKey: ["admin_spotlight_anims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spotlight_animations")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Anim[];
    },
  });

  const [draft, setDraft] = useState<Partial<Anim> | null>(null);
  const [uploading, setUploading] = useState<"overlay" | "bg" | null>(null);

  const upload = async (file: File, kind: "overlay" | "bg") => {
    if (file.size > 15 * 1024 * 1024) return toast.error("Max 15 MB");
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `spotlight/${crypto.randomUUID()}.${ext}`;
      const publicUrl = await uploadFileAtPath("shop-assets", path, file);
      setDraft((d) => ({
        ...(d ?? {}),
        [kind === "overlay" ? "overlay_asset_url" : "bg_animation_url"]: publicUrl,
      }));
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = useMutation({
    mutationFn: async (d: Partial<Anim>) => {
      const row = {
        name: (d.name ?? "").trim(),
        label: (d.label ?? "").trim() || "Top Fan",
        overlay_asset_url: d.overlay_asset_url || null,
        bg_animation_url: d.bg_animation_url || null,
        duration_ms: d.duration_ms ?? 3500,
        tier_required: d.tier_required ?? "any",
        sort_order: d.sort_order ?? 0,
        is_active: d.is_active ?? true,
      };
      if (!row.name) throw new Error("Name required");
      if (d.id) {
        const { error } = await supabase.from("spotlight_animations").update(row).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("spotlight_animations").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_spotlight_anims"] });
      qc.invalidateQueries({ queryKey: ["spotlight_anims"] });
      toast.success("Saved");
      setDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spotlight_animations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_spotlight_anims"] });
      toast.success("Deleted");
    },
  });

  return (
    <div className="mt-4">
      <button
        onClick={() =>
          setDraft({ name: "", label: "Top Fan", duration_ms: 3500, tier_required: "any", is_active: true })
        }
        className="mb-3 rounded-lg bg-gradient-to-r from-amber-500 to-fuchsia-500 px-3 py-2 text-xs font-black text-black"
      >
        <Plus className="mr-1 inline h-3 w-3" /> New animation
      </button>

      {isLoading ? (
        <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-white/50" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {anims.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-white">
              <div className="flex items-center justify-between">
                <div className="font-black">{a.name}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    a.tier_required === "any"
                      ? "bg-slate-500/30 text-slate-200"
                      : "bg-amber-500/30 text-amber-200"
                  }`}
                >
                  {a.tier_required}
                </span>
              </div>
              <div className="mt-1 text-xs text-white/70">{a.label}</div>
              <div className="mt-1 text-[10px] text-white/40">{a.duration_ms} ms</div>
              {a.overlay_asset_url && (
                <img src={a.overlay_asset_url} alt="" className="mt-2 h-16 w-full rounded object-contain" />
              )}
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => setDraft(a)}
                  className="flex-1 rounded-md bg-white/10 py-1 text-[11px] font-semibold hover:bg-white/20"
                >
                  Edit
                </button>
                <button
                  onClick={() => confirm("Delete?") && del.mutate(a.id)}
                  className="rounded-md bg-red-500/20 px-2 py-1 text-red-200 hover:bg-red-500/30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-slate-900 p-5 text-white sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-black">{draft.id ? "Edit" : "New"} animation</h2>
              <button onClick={() => setDraft(null)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <input
                value={draft.name ?? ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Name"
                className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
              />
              <input
                value={draft.label ?? ""}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Label (e.g. 👑 Top Gifter)"
                className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={draft.duration_ms ?? 3500}
                  onChange={(e) => setDraft({ ...draft, duration_ms: parseInt(e.target.value) || 3500 })}
                  placeholder="Duration ms"
                  className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                />
                <select
                  value={draft.tier_required ?? "any"}
                  onChange={(e) =>
                    setDraft({ ...draft, tier_required: e.target.value as Anim["tier_required"] })
                  }
                  className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                >
                  <option value="any">any</option>
                  <option value="vip">vip</option>
                  <option value="svip">svip</option>
                  <option value="host_only">host_only</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-white/60">Overlay (DP frame, PNG/WebM)</label>
                <input
                  value={draft.overlay_asset_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, overlay_asset_url: e.target.value })}
                  placeholder="https://..."
                  className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                />
                <label
                  htmlFor="overlay-up"
                  className="mt-1 flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-white/20 bg-white/5 text-[11px] hover:bg-white/10"
                >
                  {uploading === "overlay" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  Upload overlay
                </label>
                <input
                  id="overlay-up"
                  type="file"
                  className="hidden"
                  accept="image/*,video/webm,video/mp4"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "overlay")}
                />
              </div>
              <div>
                <label className="text-[11px] text-white/60">Background animation (optional MP4/WebM)</label>
                <input
                  value={draft.bg_animation_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, bg_animation_url: e.target.value })}
                  placeholder="https://..."
                  className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                />
                <label
                  htmlFor="bg-up"
                  className="mt-1 flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-white/20 bg-white/5 text-[11px] hover:bg-white/10"
                >
                  {uploading === "bg" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload bg
                </label>
                <input
                  id="bg-up"
                  type="file"
                  className="hidden"
                  accept="video/webm,video/mp4"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "bg")}
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.is_active ?? true}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                Active
              </label>
              <button
                onClick={() => save.mutate(draft)}
                disabled={save.isPending}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-fuchsia-500 font-black text-black disabled:opacity-50"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TriggerTab() {
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string | null } | null>(null);
  const [roomId, setRoomId] = useState("");
  const [animId, setAnimId] = useState("");
  const [label, setLabel] = useState("");

  const { data: anims = [] } = useQuery({
    queryKey: ["admin_spotlight_anims_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("spotlight_animations")
        .select("id,name,label")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: userResults = [] } = useQuery({
    queryKey: ["spotlight_user_search", userSearch],
    queryFn: async () => {
      const q = userSearch.trim();
      if (!q) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .or(`username.ilike.%${q}%,user_code.ilike.%${q}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: userSearch.trim().length > 1,
  });

  const trigger = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Pick a user");
      if (!animId) throw new Error("Pick an animation");
      const { error } = await supabase.from("spotlight_triggers").insert({
        user_id: selectedUser.id,
        room_id: roomId || null,
        animation_id: animId,
        trigger_type: "manual",
        label_override: label || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_spotlight_recent"] });
      toast.success("Spotlight fired 🚀");
      setSelectedUser(null);
      setLabel("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-white">
      <div>
        <label className="text-xs text-white/60">User</label>
        {selectedUser ? (
          <div className="flex items-center justify-between rounded-md bg-emerald-500/20 px-3 py-2 text-sm">
            <span>@{selectedUser.username ?? selectedUser.id.slice(0, 8)}</span>
            <button onClick={() => setSelectedUser(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by username or user code"
                className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-sm"
              />
            </div>
            {userResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-white/10 bg-black/40">
                {userResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser({ id: u.id, username: u.username })}
                    className="flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                  >
                    {u.avatar && <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />}
                    @{u.username ?? u.id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="text-xs text-white/60">Room ID (optional — leave blank for global)</label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="uuid…"
          className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-white/60">Animation</label>
        <select
          value={animId}
          onChange={(e) => setAnimId(e.target.value)}
          className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
        >
          <option value="">— Pick —</option>
          {anims.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-white/60">Custom label (optional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 💎 Star of the Night"
          className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-2 text-sm"
        />
      </div>

      <button
        onClick={() => trigger.mutate()}
        disabled={trigger.isPending || !selectedUser || !animId}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-fuchsia-500 font-black text-black disabled:opacity-50"
      >
        {trigger.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        Fire Spotlight
      </button>
    </div>
  );
}

function RecentTab() {
  const { data: recent = [], isLoading } = useQuery({
    queryKey: ["admin_spotlight_recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("spotlight_triggers")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Trigger[];
    },
  });

  return (
    <div className="mt-4">
      {isLoading ? (
        <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-white/50" />
      ) : (
        <div className="space-y-2">
          {recent.map((t) => (
            <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white">
              <div className="flex items-center justify-between">
                <span className="font-black">{t.trigger_type}</span>
                <span className="text-white/50">{new Date(t.triggered_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-white/70">
                User: {t.user_id.slice(0, 8)} · Room: {t.room_id?.slice(0, 8) ?? "global"} · Seen: {t.seen_count}
              </div>
            </div>
          ))}
          {!recent.length && (
            <div className="py-12 text-center text-sm text-white/50">No triggers yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
