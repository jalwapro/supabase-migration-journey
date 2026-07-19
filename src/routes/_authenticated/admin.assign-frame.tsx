import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Search, Crown, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/assign-frame")({
  component: AssignFrameAdmin,
});

type Theme = {
  id: string;
  name: string;
  preview_url: string | null;
  animation_url: string | null;
  is_active: boolean;
};
type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  frame: string | null;
  frame_expires_at: string | null;
  user_code: string | null;
};

function isVideo(url: string | null) {
  return !!url && /\.(mp4|webm|mov)($|\?)/i.test(url);
}

function AssignFrameAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [days, setDays] = useState<number>(30);
  const [permanent, setPermanent] = useState(true);

  const themes = useQuery({
    queryKey: ["admin_assign_frames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("themes")
        .select("id,name,preview_url,animation_url,is_active")
        .order("sort");
      if (error) throw error;
      return (data ?? []) as Theme[];
    },
  });

  const users = useQuery({
    queryKey: ["admin_assign_users", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar,frame,frame_expires_at,user_code")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%,user_code.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const assign = useMutation({
    mutationFn: async ({ theme, userId }: { theme: Theme; userId: string }) => {
      if (!(theme.animation_url || theme.preview_url)) throw new Error("Frame has no media");
      const expires = permanent ? null : new Date(Date.now() + days * 86400_000).toISOString();
      const { error } = await supabase.rpc("admin_assign_frame", {
        _user_id: userId,
        _theme_id: theme.id,
        _equip: true,
        _expires_at: expires,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Frame assigned & equipped");
      qc.invalidateQueries({ queryKey: ["admin_assign_users"] });
      setSelectedUser((u) => u); // keep current selection while the list refreshes
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const removeFrame = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ frame: null, theme_id: null, frame_expires_at: null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Frame removed");
      qc.invalidateQueries({ queryKey: ["admin_assign_users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const availableThemes = useMemo(
    () => (themes.data ?? []).filter((t) => t.animation_url || t.preview_url),
    [themes.data],
  );

  return (
    <div className="p-4 space-y-4">
      <AdminPageHeader
        title="Assign DP Frame"
        subtitle="Kisi bhi user ko frame gift/assign karo (CEO, VIP, exclusive frames)"
      />

      {/* Search user */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 opacity-60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Username, name, ya user code se dhoondo (min 2 chars)"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        {users.isFetching && <div className="text-xs opacity-60">Searching…</div>}
        {users.data && users.data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {users.data.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`flex items-center gap-3 rounded-xl p-2 text-left border transition ${
                  selectedUser?.id === u.id
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:bg-white/5"
                }`}
              >
                {u.avatar ? (
                  <img src={u.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-sm font-black text-primary">
                    {(u.username || u.full_name || "J").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{u.username || u.full_name || "—"}</div>
                  <div className="text-[11px] opacity-60 truncate">
                    {u.user_code ? `#${u.user_code}` : u.id.slice(0, 8)}
                    {u.frame && " · has frame"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected user */}
      {selectedUser && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                {selectedUser.avatar ? (
                  <img src={selectedUser.avatar} className="w-14 h-14 rounded-full object-cover" alt="" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/20 text-lg font-black text-primary">
                    {(selectedUser.username || selectedUser.full_name || "J").slice(0, 1).toUpperCase()}
                  </span>
                )}
              <div>
                <div className="font-semibold">{selectedUser.username || selectedUser.full_name}</div>
                <div className="text-xs opacity-60">
                  {selectedUser.frame ? `Current: ${selectedUser.frame.split("/").pop()}` : "No frame equipped"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedUser.frame && (
                <button
                  onClick={() => removeFrame.mutate(selectedUser.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-400/40 text-red-300 hover:bg-red-500/10"
                >
                  Remove frame
                </button>
              )}
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permanent}
                onChange={(e) => setPermanent(e.target.checked)}
              />
              Permanent
            </label>
            {!permanent && (
              <label className="flex items-center gap-2">
                Days:
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 1)}
                  className="w-20 px-2 py-1 rounded bg-black/30 border border-white/10"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Frames grid */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">Available Frames ({availableThemes.length})</div>
        {themes.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {availableThemes.map((t) => {
              const url = t.animation_url || t.preview_url!;
              return (
                <div key={t.id} className="rounded-xl border border-white/10 bg-black/30 p-2 flex flex-col">
                  <div className="aspect-square rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                    {isVideo(url) ? (
                      <video src={url} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                    ) : (
                      <img src={url} className="w-full h-full object-contain" alt={t.name} />
                    )}
                  </div>
                  <div className="text-xs font-medium mt-2 truncate">{t.name}</div>
                  {!t.is_active && <div className="text-[10px] text-[color:var(--gold)]">Admin only</div>}
                  <button
                    disabled={!selectedUser || assign.isPending}
                    onClick={() => selectedUser && assign.mutate({ theme: t, userId: selectedUser.id })}
                    className="mt-2 text-xs py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90"
                  >
                    {assign.isPending ? "…" : selectedUser ? "Assign" : "Pick user first"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
