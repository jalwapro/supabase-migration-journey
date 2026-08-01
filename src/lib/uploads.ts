import { supabase } from "@/integrations/supabase/client";

export type UploadResult = {
  url: string;
  path: string;
  mime: string;
  size: number;
};

let r2Available: boolean | null = null;

/** Upload straight to Cloudflare R2 via a short-lived presigned URL. */
async function uploadToR2(key: string, file: File): Promise<UploadResult | null> {
  if (r2Available === false) return null;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return null;

    const signRes = await fetch("/api/r2-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: key, contentType: file.type || "application/octet-stream" }),
    });
    if (!signRes.ok) {
      if (signRes.status === 503) r2Available = false;
      return null;
    }
    const { uploadUrl, publicUrl } = (await signRes.json()) as {
      uploadUrl: string;
      publicUrl: string;
    };

    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: file.type ? { "Content-Type": file.type } : undefined,
    });
    if (!put.ok) throw new Error(`R2 upload failed (${put.status})`);

    r2Available = true;
    return { url: publicUrl, path: key, mime: file.type, size: file.size };
  } catch (e) {
    console.warn("R2 upload failed, falling back to Supabase storage:", e);
    return null;
  }
}

/**
 * Upload a File to an explicit `bucket/path` key and return its public URL.
 * Goes to Cloudflare R2 when configured, otherwise Supabase storage.
 */
export async function uploadFileAtPath(
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const r2 = await uploadToR2(`${bucket}/${path}`, file);
  if (r2) return r2.url;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload a File and return its public URL. Uses Cloudflare R2 when configured,
 * otherwise falls back to the Supabase storage bucket.
 * `folder` becomes the first path segment (e.g. "banners/uuid.png").
 */
export async function uploadToBucket(
  bucket: string,
  file: File,
  folder = "",
): Promise<UploadResult> {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = crypto.randomUUID();
  const path = folder ? `${folder}/${id}.${ext}` : `${id}.${ext}`;

  const r2 = await uploadToR2(`${bucket}/${path}`, file);
  if (r2) return { ...r2, path };

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, mime: file.type, size: file.size };
}


/**
 * Upload a File into the signed-in user's folder inside a bucket that uses
 * per-user folder policies (avatars, gallery, chat-media, voice-notes).
 */
export async function uploadToUserFolder(
  bucket: string,
  file: File,
  userId: string,
  subfolder = "",
): Promise<UploadResult> {
  const folder = subfolder ? `${userId}/${subfolder}` : userId;
  return uploadToBucket(bucket, file, folder);
}

/**
 * Upload into a PRIVATE bucket under the user's folder. Returns a
 * `storage://<bucket>/<path>` marker instead of a public URL, since public
 * URLs won't resolve for private buckets. Consumers use `useSignedMediaUrl`
 * (see `@/lib/signedMedia`) to render the media.
 */
export async function uploadPrivateToUserFolder(
  bucket: string,
  file: File,
  userId: string,
  subfolder = "",
): Promise<UploadResult> {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = crypto.randomUUID();
  const folder = subfolder ? `${userId}/${subfolder}` : userId;
  const path = `${folder}/${id}.${ext}`;

  // Private media also lives on R2; the `storage://` marker is resolved to a
  // short-lived presigned URL at render time (see `@/lib/signedMedia`).
  const r2 = await uploadToR2(`${bucket}/${path}`, file);
  if (!r2) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
      cacheControl: "3600",
    });
    if (error) throw error;
  }
  return { url: `storage://${bucket}/${path}`, path, mime: file.type, size: file.size };
}


