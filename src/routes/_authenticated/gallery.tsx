import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gallery")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
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
      return data ?? [];
    },
  });

  async function addImage() {
    if (!url.trim() || !user) return;
    const { error } = await supabase.from("gallery_images").insert({
      user_id: user.id,
      path: url.trim(),
      is_public: true,
    });
    if (error) return toast.error(error.message);
    setUrl("");
    toast.success("Photo added");
    qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  async function removeImage(id: string) {
    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  return (
    <>
      <AppShell title="Gallery" showBack>
        <div className="space-y-4 px-4 pt-4">
          <div className="glass rounded-2xl p-3">
            <p className="mb-2 text-xs text-muted-foreground">Paste an image URL to add to your gallery</p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
              />
              <button
                onClick={addImage}
                className="flex items-center gap-1 rounded-xl bg-[color:var(--primary)] px-3 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(images ?? []).map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-card/60">
                <img src={img.path} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(images ?? []).length === 0 && (
              <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">No photos yet</p>
            )}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
