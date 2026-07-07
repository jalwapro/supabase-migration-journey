import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsAdmin,
});

type Settings = {
  splash_enabled: boolean;
  splash_duration: number;
  splash_image: string | null;
  splash_video: string | null;
};

function SettingsAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });

  const [form, setForm] = useState<Settings>({
    splash_enabled: true,
    splash_duration: 3,
    splash_image: null,
    splash_video: null,
  });

  useEffect(() => {
    if (!q.data) return;
    setForm({
      splash_enabled: Boolean(q.data.splash_enabled ?? true),
      splash_duration: Number(q.data.splash_duration ?? 3),
      splash_image: (q.data.splash_image as string | null) ?? null,
      splash_video: (q.data.splash_video as string | null) ?? null,
    });
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").update(form).eq("id", "global");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin_settings"] });
      qc.invalidateQueries({ queryKey: ["splash_cfg"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Settings" subtitle="Global platform toggles" />
      {q.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="glass max-w-2xl space-y-3 rounded-2xl p-4">
          <label className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2 text-sm">
            <span className="font-bold">Splash screen enabled</span>
            <input type="checkbox" checked={form.splash_enabled} onChange={(e) => setForm({ ...form, splash_enabled: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2 text-sm">
            <span className="font-bold">Splash duration (s)</span>
            <input type="number" min={1} max={20} value={form.splash_duration} onChange={(e) => setForm({ ...form, splash_duration: Number(e.target.value) || 3 })} className="w-16 rounded-md border border-border bg-input px-2 py-1 text-right text-xs" />
          </label>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Splash image URL</p>
            <input value={form.splash_image ?? ""} onChange={(e) => setForm({ ...form, splash_image: e.target.value || null })} className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Splash video URL</p>
            <input value={form.splash_video ?? ""} onChange={(e) => setForm({ ...form, splash_video: e.target.value || null })} className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
            <p className="mt-1 text-[10px] text-muted-foreground">Upload via Admin → Splash & Animation. Portrait 9:16, ≤ 8 MB recommended.</p>
          </div>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="glow-4d mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
            <Save className="h-3 w-3" /> Save settings
          </button>
        </div>
      )}
    </>
  );
}
