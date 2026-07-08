import { supabase } from "@/integrations/supabase/client";

export type UploadResult = {
  url: string;
  path: string;
  mime: string;
  size: number;
};

/**
 * Upload a File to a Supabase storage bucket and return its public URL.
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
