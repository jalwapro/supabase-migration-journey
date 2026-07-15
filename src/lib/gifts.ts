// JSON-catalog gifts — merged into the GiftSheet alongside DB gifts.
// Each entry here appears in the sheet without any DB row. To actually
// `send_gift`, the same `id` must also exist in the DB `gifts` table
// (or the RPC needs a catalog-slug path).
import catalog from "./gifts.catalog.sample.json";
import type { Gift } from "@/components/GiftSheet";

type CatalogEntry = {
  id: string;
  name: string;
  description?: string;
  category: string;
  rarity?: string;
  price_diamonds: number;
  gifter_xp?: number;
  duration_ms?: number;
  thumbnail_url?: string | null;
  animation?: {
    type?: string;
    mp4_url?: string | null;
    webm_url?: string | null;
    has_alpha?: boolean;
    loop?: boolean;
  } | null;
  sound_url?: string | null;
  tags?: string[];
  min_vip_level?: number;
  is_combo_enabled?: boolean;
  is_active?: boolean;
};

const LOVABLE_ORIGIN = "https://cloud-to-soul.lovable.app";

function absolutize(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/__l5e/")) return `${LOVABLE_ORIGIN}${url}`;
  return url;
}

function toGift(entry: CatalogEntry): Gift & { rarity?: string; source: "catalog" } {
  const clip = absolutize(entry.animation?.webm_url ?? entry.animation?.mp4_url ?? entry.thumbnail_url);
  const clipType = entry.animation?.webm_url ? "webm" : entry.animation?.mp4_url ? "mp4" : null;
  return {
    id: entry.id,
    name: entry.name,
    icon: "🎁",
    emoji: "🎁",
    image_url: null,
    price_coins: entry.price_diamonds,
    price: entry.price_diamonds,
    diamonds_value: entry.price_diamonds,
    category: entry.category,
    animation: entry.animation?.type ?? "pop",
    clip_path: clip,
    clip_type: clipType,
    sound_url: absolutize(entry.sound_url),
    rarity: entry.rarity,
    source: "catalog",
  };
}

export const CATALOG_GIFTS: (Gift & { rarity?: string; source: "catalog" })[] = (
  (catalog.gifts as CatalogEntry[]) ?? []
)
  .filter((g) => g.is_active !== false)
  .map(toGift);
