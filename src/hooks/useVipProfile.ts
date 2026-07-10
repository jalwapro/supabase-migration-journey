import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { vipProgressFor, type VipProgress } from "@/lib/vip-levels";

export type VipProfileRow = {
  id: string;
  vip_level: number | null;
  vip_tier: string | null;
  vip_title: string | null;
  total_gifted_coins: number | null;
};

/**
 * Live VIP profile — subscribes to postgres_changes on `profiles` for this user
 * so the UI updates the instant a gift trigger bumps their level/xp.
 */
export function useVipProfile(userId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["vip-profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ row: VipProfileRow; progress: VipProgress } | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, vip_level, vip_tier, vip_title, total_gifted_coins")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as VipProfileRow;
      return {
        row,
        progress: vipProgressFor(row.total_gifted_coins ?? 0, row.vip_level ?? 0),
      };
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`vip-profile:${userId}`)
      .on(
        "postgres_changes" as never,
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["vip-profile", userId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, qc]);

  return query;
}
