import { supabase } from "@/integrations/supabase/client";

export type StudioAsset = { id: string; name: string; url: string; type: string; category: string; metadata?: Record<string, unknown> };
const bucket = "app-studio-assets";

/** The production schema uses app_customization_assets (not app_studio_assets). */
export async function listStudioAssets() {
  const { data, error } = await supabase.from("app_customization_assets").select("id,name,public_url,category,mime_type,metadata,storage_path").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, url: row.public_url ?? "", type: row.mime_type?.startsWith("font/") || /\.(woff2?|ttf|otf)$/i.test(row.name) ? "font" : row.mime_type?.startsWith("video/") ? "video" : "image", category: row.category, metadata: { ...(row.metadata ?? {}), storagePath: row.storage_path } })) as StudioAsset[];
}

export async function uploadStudioAsset(file: File, category = "images") {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `app-studio/${category}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  const type = file.type.startsWith("font/") || /\.(woff2?|ttf|otf)$/i.test(file.name) ? "font" : file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "asset";
  const { data, error } = await supabase.from("app_customization_assets").insert({ name: file.name, category, storage_path: path, public_url: publicData.publicUrl, mime_type: file.type || null, metadata: { size: file.size, mime: file.type, storagePath: path } }).select("id,name,public_url,category,mime_type,metadata,storage_path").single();
  if (error) { await supabase.storage.from(bucket).remove([path]); throw error; }
  return { id: data.id, name: data.name, url: data.public_url ?? "", type, category: data.category, metadata: { ...(data.metadata ?? {}), storagePath: data.storage_path } } as StudioAsset;
}

export async function deleteStudioAsset(asset: StudioAsset) {
  const path = typeof asset.metadata?.storagePath === "string" ? asset.metadata.storagePath : null;
  if (path) await supabase.storage.from(bucket).remove([path]);
  const { error } = await supabase.from("app_customization_assets").delete().eq("id", asset.id);
  if (error) throw error;
}

export function applyStudioFont(asset: StudioAsset, fontFamily = "StudioUploadedFont") {
  if (typeof document === "undefined") return;
  const id = `studio-font-${asset.id}`;
  if (!document.getElementById(id)) {
    const style = document.createElement("style"); style.id = id;
    const format = /\.woff2($|\?)/i.test(asset.url) ? "woff2" : /\.woff($|\?)/i.test(asset.url) ? "woff" : "truetype";
    style.textContent = `@font-face{font-family:'${fontFamily.replace(/'/g, "")}' ;src:url('${asset.url}') format('${format}');font-display:swap}`;
    document.head.appendChild(style);
  }
  document.documentElement.style.setProperty("--studio-font-uploaded", `'${fontFamily.replace(/'/g, "")}'`);
}
