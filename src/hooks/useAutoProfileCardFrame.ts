import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileCard } from "@/lib/profileCards/registry";

export type AutoProfileCardFrame = Pick<
  ProfileCard,
  "frame_media_url" | "frame_media_type" | "frame_chromakey" | "frame_effect" | "accent_color" | "glow_color"
> & { profile_frame_required_level: number };

export function useAutoProfileCardFrame(level: number | null | undefined) {
  const normalizedLevel = Math.max(0, Number(level ?? 0));
  return useQuery({
    queryKey: ["auto-profile-card-frame", normalizedLevel],
    enabled: normalizedLevel >= 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
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
      if (error) throw error;
      return (data ?? null) as AutoProfileCardFrame | null;
    },
  });
}
