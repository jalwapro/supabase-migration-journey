import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RoomGame = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  game_url: string;
  enabled: boolean;
  sort_order: number;
};

const KEY = ["room_games"];

/** Public read — used by the room's Games popup. Only enabled games. */
export function useRoomGames() {
  return useQuery({
    queryKey: KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_games")
        .select("*")
        .eq("enabled", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as RoomGame[];
    },
  });
}

/** Admin read — includes disabled rows too, for the admin panel list. */
export function useAdminRoomGames() {
  return useQuery({
    queryKey: ["admin_room_games"],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_games").select("*").order("sort_order");
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
