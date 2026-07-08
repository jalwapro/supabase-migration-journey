import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadToBucket, uploadToUserFolder } from "@/lib/uploads";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  /** Storage bucket to upload into (e.g. "banners", "ads", "shop-assets"). */
  bucket: string;
  /** Optional subfolder inside the bucket. */
  folder?: string;
  /** When true, uploads under `<uid>/<folder>` (required for user-scoped buckets). */
  perUser?: boolean;
  /** Current URL (controlled). */
  value?: string | null;
  onChange: (url: string | null) => void;
  /** MIME accept list. Defaults to any image. */
  accept?: string;
  /** Label shown when nothing is uploaded yet. */
  label?: string;
  /** Small preview kind: image / video / auto (detect by mime). */
  previewKind?: "image" | "video" | "auto";
  className?: string;
  maxSizeMB?: number;
};

export function FileUploader({
  bucket,
  folder = "",
  perUser = false,
  value,
  onChange,
  accept = "image/*",
  label = "Upload from device",
  previewKind = "auto",
  className = "",
  maxSizeMB = 20,
}: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking same file
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Max ${maxSizeMB}MB`);
      return;
    }
    try {
      setBusy(true);
      const res = perUser
        ? await uploadToUserFolder(bucket, file, user?.id ?? "anon", folder)
        : await uploadToBucket(bucket, file, folder);
      onChange(res.url);
      toast.success("Uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const isVideo =
    previewKind === "video" ||
    (previewKind === "auto" && !!value && /\.(mp4|webm|mov)($|\?)/i.test(value));

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handlePick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-[color:var(--gold)]/50 bg-input px-3 py-2 text-xs disabled:opacity-60"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {value ? "Change file" : label}
        </span>
        {value ? (
          isVideo ? (
            <video src={value} muted className="h-10 w-10 rounded object-cover" />
          ) : (
            <img src={value} alt="" className="h-10 w-10 rounded object-cover" />
          )
        ) : (
          <span className="text-[10px] text-muted-foreground">Choose file</span>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex items-center gap-1 text-[10px] text-red-400 hover:underline"
        >
          <X className="h-3 w-3" /> Remove
        </button>
      )}
    </div>
  );
}
