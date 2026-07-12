import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Trash2, Upload, Loader2, Lock, Globe, Users, Check, X } from "lucide-react";
import { toast } from "sonner";
import { uploadToUserFolder } from "@/lib/uploads";

export const Route = createFileRoute("/_authenticated/gallery")({ component: Page });

type Img = { id: string; path: string; is_public: boolean; sort_order: number };
type Unlock = {
  id: string;
  viewer_id: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  viewer: { username: string | null; avatar: string | null } | null;
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"public" | "private" | "access">("public");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: images } = useQuery({
    queryKey: ["gallery", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, path, is_public, sort_order")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Img[];
    },
  });

  const { data: unlocks } = useQuery({
    queryKey: ["gallery-unlocks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_unlocks")
        .select("id, viewer_id, status, created_at, viewer:profiles!gallery_unlocks_viewer_id_fkey(username,avatar)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Unlock[];
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Max 15MB");
      return;
    }
    try {
      setUploading(true);
      const res = await uploadToUserFolder("gallery", file, user.id);
      const { error } = await supabase.from("gallery_images").insert({
        user_id: user.id,
        path: res.url,
        is_public: tab !== "private",
      });
      if (error) throw error;
      toast.success(tab === "private" ? "Added to private album" : "Photo added");
      qc.invalidateQueries({ queryKey: ["gallery"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function togglePrivacy(img: Img) {
    const { error } = await supabase
      .from("gallery_images")
      .update({ is_public: !img.is_public })
      .eq("id", img.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  async function removeImage(id: string) {
    if (!confirm("Delete this photo?")) return;
    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  async function decide(u: Unlock, status: "accepted" | "revoked") {
    const { error } = await supabase
      .from("gallery_unlocks")
      .update({ status })
      .eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success(status === "accepted" ? "Access granted" : "Access revoked");
    qc.invalidateQueries({ queryKey: ["gallery-unlocks"] });
  }

  const list = (images ?? []).filter((i) =>
    tab === "private" ? !i.is_public : i.is_public,
  );

  return (
    <>
      <AppShell title="Gallery">
        <div className="space-y-4 px-4 pt-4">
          {/* Tabs */}
          <div className="glass flex rounded-full p-1">
            {[
              { k: "public", label: "Public", icon: Globe },
              { k: "private", label: "Private", icon: Lock },
              { k: "access", label: "Access", icon: Users },
            ].map(({ k, label, icon: Icon }) => (
              <button
                key={k}
                onClick={() => setTab(k as typeof tab)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-xs font-bold transition ${
                  tab === k
                    ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-white"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {tab !== "access" ? (
            <>
              {/* Upload */}
              <div className="glass rounded-2xl p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  {tab === "private"
                    ? "Private album — sirf jinhe access dogay wo dekh sakenge"
                    : "Public gallery — sab dekh sakte hain"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[color:var(--primary)] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload from device
                </button>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-3 gap-2">
                {list.map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-square overflow-hidden rounded-xl bg-card/60"
                  >
                    <img src={img.path} alt="" className="h-full w-full object-cover" />
                    {!img.is_public && (
                      <div className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-[color:var(--gold)]">
                        <Lock className="h-3 w-3" />
                      </div>
                    )}
                    <button
                      onClick={() => togglePrivacy(img)}
                      className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white"
                    >
                      {img.is_public ? "Make private" : "Make public"}
                    </button>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {list.length === 0 && (
                  <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">
                    {tab === "private" ? "Koi private photo nahi" : "Koi photo nahi"}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Jinhone tumhare private album ka access maanga ya jinhe tum ne
                access diya
              </p>
              {(unlocks ?? []).map((u) => (
                <div key={u.id} className="glass flex items-center gap-2 rounded-2xl p-2.5">
                  <Link to="/u/$userId" params={{ userId: u.viewer_id }} className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/20">
                      {u.viewer?.avatar ? (
                        <img src={u.viewer.avatar} className="h-full w-full object-cover" alt="" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {u.viewer?.username ?? "user"}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {u.status}
                      </p>
                    </div>
                  </Link>

                  {u.status !== "accepted" && (
                    <button
                      onClick={() => decide(u, "accepted")}
                      className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-emerald-400"
                      title="Grant access"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {u.status !== "revoked" && (
                    <button
                      onClick={() => decide(u, "revoked")}
                      className="grid h-8 w-8 place-items-center rounded-full bg-red-500/20 text-red-400"
                      title="Revoke access"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {(unlocks ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Abhi koi access request nahi
                </p>
              )}
            </div>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
