import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MiniGame = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  category: string;
  enabled: boolean;
  maintenance: boolean;
  entry_cost: number;
  reward_base: number;
  xp_reward: number;
  daily_limit: number;
  cooldown_seconds: number;
  difficulty: string;
  min_duration_ms: number;
  max_duration_ms: number;
  max_score: number;
  sort_order: number;
  config: GameConfig;
};

export type GameTier = { min: number; mult: number; label?: string };
export type GamePrize = { label: string; coins?: number; mult?: number; weight: number };
export type GameConfig = {
  mode?: "score" | "weighted";
  tiers?: GameTier[];
  prizes?: GamePrize[];
  seconds?: number;
  rounds?: number;
  pairs?: number;
  size?: number;
  questions?: number;
};

export type StartResult = {
  session_id: string;
  slug: string;
  entry_cost: number;
  payload: { prize_index?: number } & Record<string, unknown>;
  resumed: boolean;
  balance: number;
};

export type FinishResult = {
  session_id: string;
  slug: string;
  score: number;
  multiplier: number;
  label: string | null;
  reward_coins: number;
  entry_cost: number;
  xp: number;
  win: boolean;
  balance: number;
  replay?: boolean;
};

const GAMES_KEY = ["mini_games"];

export function useMiniGames() {
  return useQuery({
    queryKey: GAMES_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mini_games")
        .select("*")
        .eq("enabled", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MiniGame[];
    },
  });
}

export function useMiniGame(slug: string) {
  return useQuery({
    queryKey: ["mini_game", slug],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mini_games")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MiniGame) ?? null;
    },
  });
}

/** Server-authoritative play session. The client never computes a reward. */
export function useGameSession(slug: string) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const refreshWallet = () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["mg_summary", user?.id] });
    qc.invalidateQueries({ queryKey: ["mg_leaderboard"] });
  };

  const start = useMutation({
    mutationKey: ["mg_start", slug],
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mg_start_session", { p_slug: slug });
      if (error) throw error;
      return data as unknown as StartResult;
    },
    onSuccess: refreshWallet,
  });

  const finish = useMutation({
    mutationKey: ["mg_finish", slug],
    mutationFn: async (args: { sessionId: string; score: number; meta?: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc("mg_finish_session", {
        p_session: args.sessionId,
        p_score: Math.max(0, Math.round(args.score)),
        p_meta: args.meta ?? {},
      });
      if (error) throw error;
      return data as unknown as FinishResult;
    },
    onSuccess: refreshWallet,
  });

  return { start, finish };
}

export function useMyGameSummary(userId?: string | null) {
  return useQuery({
    queryKey: ["mg_summary", userId],
    enabled: !!userId,
    staleTime: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mg_profile_summary", { p_user: userId });
      if (error) throw error;
      return data as unknown as {
        plays: number;
        wins: number;
        coins_spent: number;
        coins_won: number;
        xp: number;
        streak: number;
        games: { slug: string; name: string; icon: string | null; best_score: number; plays: number; wins: number; coins_won: number }[];
        history: { slug: string; score: number; reward: number; entry: number; at: string }[];
      };
    },
  });
}

export function useLeaderboard(period: "daily" | "weekly" | "monthly" | "all", slug?: string | null) {
  return useQuery({
    queryKey: ["mg_leaderboard", period, slug ?? "all"],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mg_leaderboard", {
        p_period: period,
        p_slug: slug ?? null,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as {
        user_id: string;
        username: string | null;
        avatar: string | null;
        frame: string | null;
        score: number;
        coins_won: number;
        plays: number;
      }[];
    },
  });
}

export function friendlyGameError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const cd = msg.match(/COOLDOWN:(\d+)/);
  if (cd) {
    const s = Number(cd[1]);
    if (s > 3600) return `Come back in ${Math.ceil(s / 3600)}h`;
    if (s > 60) return `Come back in ${Math.ceil(s / 60)}m`;
    return `Come back in ${s}s`;
  }
  return msg.replace(/^.*?:\s*/, "").slice(0, 140) || "Something went wrong";
}
