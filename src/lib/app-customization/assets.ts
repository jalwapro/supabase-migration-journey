export type AssetKind = "image" | "icon" | "logo" | "background" | "frame" | "gift" | "animation" | "video" | "font";
export interface StudioAsset { id: string; name: string; kind: AssetKind; url: string; mimeType?: string; sizeBytes?: number; width?: number; height?: number; category?: string; metadata?: Record<string, unknown>; createdAt?: string; }
export const ASSET_KINDS: AssetKind[] = ["image","icon","logo","background","frame","gift","animation","video","font"];
export function isSafeAssetUrl(url: string) { try { const parsed = new URL(url); return parsed.protocol === "https:" || parsed.protocol === "http:"; } catch { return false; } }
export function filterAssets(assets: StudioAsset[], query = "", kind?: AssetKind) { const q = query.trim().toLowerCase(); return assets.filter(asset => (!kind || asset.kind === kind) && (!q || `${asset.name} ${asset.category ?? ""}`.toLowerCase().includes(q))); }
