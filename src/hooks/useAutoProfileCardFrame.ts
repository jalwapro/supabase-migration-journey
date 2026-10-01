import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileCard } from "@/lib/profileCards/registry";

export type EffectiveProfileCardFrame = Pick<
  ProfileCard,
  "frame_media_url" | "frame_media_type" | "frame_chromakey" | "frame_effect" | "accent_color" | "glow_color"
> & { profile_frame_required_level: number };

export function useEffectiveProfileCardFrame(userId: string | null | undefined, level: number | null | undefined) {
  const normalizedLevel = Math.max(0, Number(level ?? 0));
  return useQuery({
    queryKey: ["effective-profile-card-frame", userId, normalizedLevel],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: owned, error: ownedError } = await supabase
        .from("user_profile_cards")
        .select("purchased_at,expires_at,profile_cards:card_id(frame_media_url,frame_media_type,frame_chromakey,frame_effect,accent_color,glow_color,profile_frame_required_level)")
        .eq("user_id", userId!)
        .order("purchased_at", { ascending: false });
      if (ownedError) throw ownedError;

      const purchased = (owned ?? []).find((row: any) => {
        if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
        const card = row.profile_cards;
        return !!card?.frame_media_url && card.frame_media_type !== "none";
      })?.profile_cards as EffectiveProfileCardFrame | undefined;
      if (purchased) return purchased;

      const { data: auto, error: autoError } = await supabase
        .from("profile_cards")
        .select("frame_media_url,frame_media_type,frame_chromakey,frame_effect,accent_color,glow_color,profile_frame_required_level")
        .eq("is_active", true)
        .not("frame_media_url", "is", null)
        .lte("profile_frame_required_level", normalizedLevel)
        .order("profile_frame_required_level", { ascending: false })
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (autoError) throw autoError;
      return (auto ?? null) as EffectiveProfileCardFrame | null;
    },
  });
}
