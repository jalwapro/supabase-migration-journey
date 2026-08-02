/**
 * Premium asset platform — DP profile frames + entrance effects.
 * Frames live in `dp_frames` (image_url = PNG/SVG on Cloudflare R2).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FRAME_CATEGORIES = [
  "VIP",
  "Premium",
  "Royal",
  "Diamond",
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
  "Galaxy",
  "Neon",
  "Fire",
  "Ice",
  "Dragon",
  "Lion",
  "Phoenix",
  "Cyber",
  "Anime",
  "Luxury",
  "Crown",
  "Champion",
] as const;

export const FRAME_RARITIES = ["classic", "rare", "epic", "legendary", "mythic", "premium"] as const;

export type PremiumFrame = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  price: number;
  duration_days: number;
  media_type: "css" | "png" | "svg" | "webp" | "gif";
  image_url: string | null;
  thumbnail_url: string | null;
  from_color: string;
  to_color: string;
  glow: string;
  effect: string;
  min_vip_level: number;
  min_level: number;
  vip_only: boolean;
  is_active: boolean;
  is_limited: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort: number;
  purchase_count: number;
  equip_count: number;
};

export type AssetType = "entrance" | "frame";

const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Public catalogue (active only) or the full list for admins. */
export function useFrames(opts: { admin?: boolean } = {}) {
  return useQuery({
    queryKey: ["premium-frames", opts.admin ? "admin" : "shop"],
    staleTime: 60_000,
    queryFn: async () => {
      let q = db.from("dp_frames").select("*").order("sort", { ascending: true });
      if (!opts.admin) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PremiumFrame[];
    },
  });
}

/** Frames the signed-in user owns, with expiry. */
export function useOwnedFrames(userId?: string | null) {
  return useQuery({
    queryKey: ["owned-frames", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("user_frames")
        .select("frame_id, expires_at")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as { frame_id: string; expires_at: string }[];
    },
  });
}

/** Favourites work for both entrances and frames. */
export function useFavorites(type: AssetType, userId?: string | null) {
  return useQuery({
    queryKey: ["asset-favorites", type, userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("asset_favorites")
        .select("asset_id")
        .eq("user_id", userId)
        .eq("asset_type", type);
      if (error) throw error;
      return new Set((data ?? []).map((r: { asset_id: string }) => r.asset_id));
    },
  });
}

export function useToggleFavorite(type: AssetType, userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, on }: { assetId: string; on: boolean }) => {
      if (!userId) throw new Error("Sign in first");
      if (on) {
        const { error } = await db
          .from("asset_favorites")
          .insert({ user_id: userId, asset_type: type, asset_id: assetId });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await db
          .from("asset_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("asset_type", type)
          .eq("asset_id", assetId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-favorites", type, userId] }),
  });
}

export async function purchaseFrame(frameId: string) {
  const { error } = await db.rpc("purchase_frame", { _frame_id: frameId });
  if (error) throw new Error(error.message);
}

export async function equipFrame(frameId: string | null) {
  const { error } = await db.rpc("equip_frame", { _frame_id: frameId });
  if (error) throw new Error(error.message);
}

/** True when a limited asset is currently inside its event window. */
export function isAvailableNow(a: { is_limited: boolean; starts_at: string | null; ends_at: string | null }) {
  if (!a.is_limited) return true;
  const now = Date.now();
  if (a.starts_at && now < new Date(a.starts_at).getTime()) return false;
  if (a.ends_at && now > new Date(a.ends_at).getTime()) return false;
  return true;
}

export type AssetStats = {
  entrances: {
    id: string;
    name: string;
    category: string;
    purchase_count: number;
    play_count: number;
    owners: number;
    is_active: boolean;
  }[];
  frames: {
    id: string;
    name: string;
    category: string;
    purchase_count: number;
    equip_count: number;
    owners: number;
    is_active: boolean;
  }[];
};

export function useAssetStats() {
  return useQuery({
    queryKey: ["admin-asset-stats"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_asset_stats");
      if (error) throw new Error(error.message);
      return data as AssetStats;
    },
  });
}
