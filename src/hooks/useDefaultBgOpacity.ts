import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-controlled visibility (0..100) of the default Jalwa background.
 * 100 = no dark overlay, 0 = fully dark.
 */
export function useDefaultBgOpacity(): number {
  const { data } = useQuery({
    queryKey: ["default_bg_opacity"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("default_bg_opacity")
        .eq("id", "global")
        .maybeSingle();
      const v = Number((data as { default_bg_opacity?: number } | null)?.default_bg_opacity ?? 60);
      return Math.max(0, Math.min(100, isFinite(v) ? v : 60));
    },
  });
  return data ?? 60;
}
