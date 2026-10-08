import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileAtPath } from "@/lib/uploads";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Download, Upload, Trash2, Loader2, Smartphone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/apk")({
  component: ApkAdmin,
});

type ApkRow = {
  id: string;
  file_url: string | null;
  file_name: string;
  file_size: number | null;
  updated_at: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function ApkAdmin() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const current = useQuery({
    queryKey: ["admin_apk_download"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_downloads")
        .select("id,file_url,file_name,file_size,updated_at")
        .eq("id", "android")
        .maybeSingle();
      if (error) throw error;
      return data as ApkRow | null;
    },
  });

  async function uploadApk(file: File) {
    const isApk = file.name.toLowerCase().endsWith(".apk");
    if (!isApk) {
      toast.error("Please select an Android APK file.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("APK is too large. Maximum size is 500 MB.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFileAtPath("apk", "jalwa.apk", file);
      const { error } = await supabase
        .from("app_downloads")
        .upsert({
          id: "android",
          file_url: url,
          file_name: file.name || "JALWA.apk",
          file_size: file.size,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) throw error;
      toast.success("JALWA APK uploaded successfully.");
      await qc.invalidateQueries({ queryKey: ["admin_apk_download"] });
      await qc.invalidateQueries({ queryKey: ["public_apk_download"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "APK upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_downloads")
        .update({ file_url: null, file_size: null, file_name: "JALWA.apk", updated_at: new Date().toISOString() })
        .eq("id", "android");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("APK download disabled.");
      qc.invalidateQueries({ queryKey: ["admin_apk_download"] });
      qc.invalidateQueries({ queryKey: ["public_apk_download"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const apk = current.data;

  return (
    <>
      <AdminPageHeader
        title="APK Download"
        subtitle="Upload the Android APK that users can download from the separate public download page."
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass rounded-3xl border border-border p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black">JALWA Android APK</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Upload a new APK here. The public download page will automatically use the latest uploaded file.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-5 text-center">
            <Upload className="mx-auto h-8 w-8 text-primary/70" />
            <p className="mt-3 text-sm font-bold">Choose JALWA.apk</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Android APK only · maximum 500 MB</p>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="glow-4d mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-black text-primary-foreground disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading APK…" : "Upload APK"}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive,application/octet-stream"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadApk(file);
              }}
            />
          </div>
        </section>

        <section className="glass rounded-3xl border border-border p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current download</p>
          {current.isLoading ? (
            <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : apk?.file_url ? (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold">APK is live</span>
              </div>
              <p className="mt-3 break-all text-sm font-bold">{apk.file_name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatSize(apk.file_size)} · Updated {new Date(apk.updated_at).toLocaleString()}
              </p>
              <a
                href={apk.file_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-card"
              >
                <Download className="h-4 w-4" /> Test download
              </a>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="mt-4 flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Disable download
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-muted/30 p-4 text-xs text-muted-foreground">
              No APK uploaded yet. Upload one and it will immediately become available on the public download page.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
