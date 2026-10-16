import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a CP couple-memory photo to the cp-photos bucket.
 *
 * The storage bucket and its RLS policies must restrict uploads to the
 * authenticated user's own folder. Never trust a caller-provided userId as
 * authorization; it is used only after it matches the active auth session.
 */
export async function uploadCpPhoto(file: File, userId: string): Promise<string> {
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!userId?.trim()) throw new Error("User ID is required");
  if (file.size <= 0) throw new Error("The selected image is empty");
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image size must be 10 MB or less");
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Please choose a JPG, PNG, WebP, or GIF image");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Please sign in to upload a CP photo");
  if (authData.user.id !== userId) {
    throw new Error("You can only upload photos to your own account");
  }

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extension = extensionByType[file.type];
  const randomSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const filePath = `${userId}/${randomSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("cp-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("CP photo upload failed:", uploadError.message);
    throw uploadError;
  }

  const { data } = supabase.storage.from("cp-photos").getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Photo uploaded, but its public URL could not be generated");
  }

  return data.publicUrl;
}
