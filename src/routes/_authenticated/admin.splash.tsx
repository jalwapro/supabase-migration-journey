import { createFileRoute } from "@tanstack/react-router";
import { uploadFileAtPath } from "@/lib/uploads";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/splash")({
  component: SplashAdmin,
});

type Settings = {
  splash_enabled: boolean;
  splash_video: string | null;
  splash_video_poster: string | null;
  splash_image: string | null;
  splash_duration: number;
};

function SplashAdmin() {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLInputElement | null>(null);
  const posterRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<"video" | "poster" | null>(null);

  const settings = useQuery({
    queryKey: ["admin_splash_cfg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("splash_enabled,splash_video,splash_video_poster,splash_image,splash_duration")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw error;
      return (data ?? {
        splash_enabled: true,
        splash_video: null,
        splash_video_poster: null,
        splash_image: null,
        splash_duration: 3,
      }) as Settings;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await supabase
        .from("app_settings")
        .update(patch)
        .eq("id", "global");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Splash updated");
      qc.invalidateQueries({ queryKey: ["admin_splash_cfg"] });
      qc.invalidateQueries({ queryKey: ["splash_cfg"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadFile(kind: "video" | "poster", file: File) {
    if (kind === "video" && !file.type.startsWith("video/")) {
      toast.error("Please pick a video file");
      return;
    }
    if (kind === "poster" && !file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      toast.error("Max 40 MB");
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
      const path = `${kind}-${Date.now()}.${ext}`;
      const url = await uploadFileAtPath("splash", path, file);
      await save.mutateAsync(kind === "video" ? { splash_video: url } : { splash_video_poster: url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const s = settings.data;

  return (
    <>
      <AdminPageHeader title="Splash & Animation" subtitle="Video that plays when the app opens" />
      {settings.isLoading || !s ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Splash video (auto-plays on domain open)
            </p>
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
              {s.splash_video ? (
                <video
                  key={s.splash_video}
                  src={s.splash_video}
                  poster={s.splash_video_poster ?? undefined}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-xs text-white/60">
                  <div className="flex flex-col items-center gap-2">
                    <Play className="h-8 w-8" />
                    No video set (animated fallback will show)
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => videoRef.current?.click()}
                disabled={uploading === "video"}
                className="glow-4d inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                {uploading === "video" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Upload video (mp4/webm, ≤ 40 MB)
              </button>
              {s.splash_video && (
                <button
                  onClick={() => save.mutate({ splash_video: null })}
                  className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile("video", f);
                  if (videoRef.current) videoRef.current.value = "";
                }}
              />
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Video poster (first frame image)
            </p>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/40">
              {s.splash_video_poster ? (
                <img src={s.splash_video_poster} className="h-full w-full object-cover" alt="poster" />
              ) : (
                <div className="grid h-full place-items-center text-xs text-white/50">Optional</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => posterRef.current?.click()}
                disabled={uploading === "poster"}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold disabled:opacity-60"
              >
                {uploading === "poster" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Upload poster
              </button>
              {s.splash_video_poster && (
                <button
                  onClick={() => save.mutate({ splash_video_poster: null })}
                  className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
              <input
                ref={posterRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile("poster", f);
                  if (posterRef.current) posterRef.current.value = "";
                }}
              />
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-3 py-2 text-xs">
                <span className="font-bold">Splash enabled</span>
                <input
                  type="checkbox"
                  checked={s.splash_enabled}
                  onChange={(e) => save.mutate({ splash_enabled: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-3 py-2 text-xs">
                <span className="font-bold">Fallback duration (seconds)</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={s.splash_duration ?? 3}
                  onChange={(e) => save.mutate({ splash_duration: Number(e.target.value) || 3 })}
                  className="w-16 rounded-md border border-border bg-input px-2 py-1 text-right"
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Recommended video: portrait 9:16 (e.g. 1080×1920), ≤ 5 seconds, MP4/H.264, ≤ 8 MB for fast open.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
