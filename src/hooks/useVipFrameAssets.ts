import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { frameForLevel } from "@/lib/levelFrames";
import { vipTierForLevel } from "@/lib/vip-levels";

export type VipTierAssetRow = {
  level: number;
  threshold_coins: number;
  tier: string;
  title: string;
  frame_url: string | null;
  popup_frame_url: string | null;
  profile_card_bg_url: string | null;
  frame_animation: string | null;
  name_color: string | null;
  badge_url: string | null;
};

export type VipFrameAssets = {
  level: number;
  tierName: string;
  title: string;
  color: string;
  dpFrameUrl: string | null;
  cardBgUrl: string | null;
  popupFrameUrl: string | null;
  animation: string;
};

export const VIP_TIER_ASSETS_KEY = ["vip-tier-assets"] as const;

/** All tier rows (≈101), cached app-wide. */
export function useVipTierAssets() {
  return useQuery({
    queryKey: VIP_TIER_ASSETS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_level_config")
        .select("level,threshold_coins,tier,title,frame_url,popup_frame_url,profile_card_bg_url,frame_animation,name_color,badge_url")
        .order("level");
      if (error) throw error;
      return (data ?? []) as VipTierAssetRow[];
    },
  });
}

/** Highest configured level <= `level` that has `field` set. */
function pick(rows: VipTierAssetRow[], level: number, field: keyof VipTierAssetRow): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.level <= level && r[field]) return String(r[field]);
  }
  return null;
}

export function resolveVipAssets(
  rows: VipTierAssetRow[],
  level: number,
  overrides?: { frame?: string | null; card?: string | null; popup?: string | null },
): VipFrameAssets {
  const lvl = Math.max(0, Math.floor(level || 0));
  const row = rows.find((r) => r.level === lvl);
  const tier = vipTierForLevel(lvl);
  const fallbackFrame = lvl > 0 ? frameForLevel(lvl) : null;
  return {
    level: lvl,
    tierName: row?.tier || tier.label,
    title: row?.title || tier.label,
    color: row?.name_color || tier.color,
    dpFrameUrl: overrides?.frame || pick(rows, lvl, "frame_url") || fallbackFrame,
    cardBgUrl: overrides?.card || pick(rows, lvl, "profile_card_bg_url"),
    popupFrameUrl: overrides?.popup || pick(rows, lvl, "popup_frame_url") || fallbackFrame,
    animation: row?.frame_animation || "glow",
  };
}

/** Effective VIP assets for a user (live level + admin overrides). */
export function useVipFrameAssets(userId: string | null | undefined, fallbackLevel?: number | null) {
  const tiers = useVipTierAssets();
  const user = useQuery({
    queryKey: ["vip-user-overrides", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("vip_level,vip_level_override,vip_frame_override_url,vip_card_override_url,vip_popup_override_url")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        vip_level: number | null;
        vip_level_override: number | null;
        vip_frame_override_url: string | null;
        vip_card_override_url: string | null;
        vip_popup_override_url: string | null;
      } | null;
    },
  });
  const u = user.data;
  const level = u?.vip_level_override ?? u?.vip_level ?? fallbackLevel ?? 0;
  const assets = resolveVipAssets(tiers.data ?? [], Number(level), {
    frame: u?.vip_frame_override_url,
    card: u?.vip_card_override_url,
    popup: u?.vip_popup_override_url,
  });
  return { assets, isLoading: tiers.isLoading || user.isLoading };
}

export const isVideoUrl = (url?: string | null) => !!url && /\.(webm|mp4|mov)(\?|$)/i.test(url);
