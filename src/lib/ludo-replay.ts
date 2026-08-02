import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LudoMatchRow = {
  id: string;
  room_id: string | null;
  status: "active" | "finished" | "aborted";
  bet_coins: number;
  winner_id: string | null;
  turn_count: number;
  created_at: string;
  finished_at: string | null;
  players: { id: string; username: string | null; avatar: string | null }[];
  event_count: number;
  invalid_count: number;
};

export type LudoEvent = {
  id: number;
  seq: number;
  actor_id: string | null;
  turn_no: number;
  kind: "start" | "roll" | "move" | "skip" | "capture" | "home" | "win" | "abort" | "error";
  dice: number | null;
  from_pos: number | null;
  to_pos: number | null;
  token_index: number | null;
  valid: boolean;
  rejection: string | null;
  server_ms: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type LudoReplay = {
  match: LudoMatchRow;
  players: { id: string; username: string | null; avatar: string | null }[];
  events: LudoEvent[];
  is_admin: boolean;
};

/** Match list — players see their own, admins can target any user. */
export function useLudoMatches(userId?: string | null, limit = 30) {
  return useQuery({
    queryKey: ["ludo_matches", userId ?? "me", limit],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ludo_match_list", {
        p_user: userId ?? null,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LudoMatchRow[];
    },
  });
}

/** Full turn-by-turn replay with the server's validation verdicts. */
export function useLudoReplay(matchId: string | null) {
  return useQuery({
    queryKey: ["ludo_replay", matchId],
    enabled: !!matchId,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ludo_match_replay", { p_match: matchId });
      if (error) throw error;
      return data as unknown as LudoReplay;
    },
  });
}

/** Server-authoritative recorders used by the live Ludo game. */
export const ludoLog = {
  open: async (roomId: string | null, players: string[], bet = 0) => {
    const { data, error } = await supabase.rpc("ludo_open_match", {
      p_room: roomId,
      p_players: players,
      p_bet: bet,
    });
    if (error) throw error;
    return data as unknown as string;
  },
  roll: async (matchId: string, turn: number) => {
    const { data, error } = await supabase.rpc("ludo_roll", { p_match: matchId, p_turn: turn });
    if (error) throw error;
    return data as unknown as { seq: number; dice: number };
  },
  move: async (args: {
    matchId: string;
    turn: number;
    token: number;
    from: number;
    to: number;
    kind?: string;
    payload?: Record<string, unknown>;
  }) => {
    const { data, error } = await supabase.rpc("ludo_record_move", {
      p_match: args.matchId,
      p_turn: args.turn,
      p_token: args.token,
      p_from: args.from,
      p_to: args.to,
      p_kind: args.kind ?? "move",
      p_payload: args.payload ?? {},
    });
    if (error) throw error;
    return data as unknown as { seq: number; valid: boolean; rejection: string | null };
  },
  close: async (matchId: string, winnerId: string | null, status: "finished" | "aborted" = "finished") => {
    const { error } = await supabase.rpc("ludo_close_match", {
      p_match: matchId,
      p_winner: winnerId,
      p_status: status,
    });
    if (error) throw error;
  },
};
