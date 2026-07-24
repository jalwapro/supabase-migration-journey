// JSON-catalog gifts — merged into the GiftSheet alongside DB gifts.
// Each entry here appears in the sheet without any DB row. To actually
// `send_gift`, the same `id` must also exist in the DB `gifts` table
// (or the RPC needs a catalog-slug path).
import catalog from "./gifts.catalog.sample.json";
import type { Gift } from "@/components/GiftSheet";
import { absolutizeLovableAsset, resolvePlayableGiftUrl } from "@/lib/giftMedia";

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

function toGift(entry: CatalogEntry): Gift & { rarity?: string; source: "catalog" } {
  const clip = resolvePlayableGiftUrl(entry.animation?.webm_url ?? entry.animation?.mp4_url ?? entry.thumbnail_url);
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
    sound_url: absolutizeLovableAsset(entry.sound_url),
    rarity: entry.rarity,
    source: "catalog",
  };
}

// Sample catalog entries use non-UUID slug ids (e.g. "jalwa-ferrari") which
// send_gift's `_gift_id uuid` parameter rejects at runtime. Until every
// catalog entry is backed by a real DB row (or send_gift gains a slug path),
// suppress the merge so the shop only shows sendable gifts.
// Kept the import + toGift mapper for when the DB backfill lands.
void toGift;
void (catalog.gifts as CatalogEntry[] | undefined);
export const CATALOG_GIFTS: (Gift & { rarity?: string; source: "catalog" })[] = [];
