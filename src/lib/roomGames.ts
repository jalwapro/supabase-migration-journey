import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RoomGame = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  /** "native" = a game built into the app (opened by slug), "iframe" = hosted URL. */
  kind: "native" | "iframe";
  category: string;
  icon_url: string | null;
  thumb_url: string | null;
  game_url: string | null;
  enabled: boolean;
  visible: boolean;
  sort_order: number;
};

const KEY = ["room_games"];
const COLS = "id,slug,name,subtitle,kind,category,icon_url,thumb_url,game_url,enabled,visible,sort_order";

/** Emoji fallback for native games that have no uploaded PNG yet. */
export const NATIVE_GAME_EMOJI: Record<string, string> = {
  ludo: "🎲",
  slots777: "🎰",
  crash_x: "🚀",
  dragon_tiger: "🐉",
  in_out: "🔴",
  plinko: "🟣",
  under_over_7: "7️⃣",
  crash_point: "📈",
  scratch_card: "🎟️",
  apple_fortune: "🍎",
  spin_win: "🎡",
  vampire_curse: "🧛",
};

/** Public read — used by the room's Games popup. Only enabled + visible games. */
export function useRoomGames() {
  return useQuery({
    queryKey: KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_games")
        .select(COLS)
        .eq("enabled", true)
        .eq("visible", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as RoomGame[];
    },
  });
}

/** Admin read — includes disabled/hidden rows too, for the admin panel list. */
export function useAdminRoomGames() {
  return useQuery({
    queryKey: ["admin_room_games"],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_games").select(COLS).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as RoomGame[];
    },
  });
}

export function useRoomGamesAdmin() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin_room_games"] });
    qc.invalidateQueries({ queryKey: KEY });
  };

  const create = useMutation({
    mutationFn: async (input: Omit<RoomGame, "id">) => {
      const { error } = await supabase.from("room_games").insert(input as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RoomGame> & { id: string }) => {
      const { error } = await supabase.from("room_games").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("room_games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
