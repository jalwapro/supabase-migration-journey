import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CasinoSlug =
  | "dragon_tiger"
  | "in_out"
  | "crash"
  | "plinko"
  | "under_over_7"
  | "crash_point"
  | "scratch_card"
  | "apple_fortune"
  | "spin_win"
  | "vampire_curse";


export type CasinoGame = {
  slug: CasinoSlug;
  name: string;
  icon: string;
  enabled: boolean;
  maintenance: boolean;
  min_bet: number;
  max_bet: number;
  rtp_bp: number;
  jackpot: number;
  announcement: string | null;
  sort_order: number;
  config: Record<string, unknown>;
};

export type CasinoResult = {
  game: CasinoSlug;
  bet: number;
  payout: number;
  multiplier: number;
  won: boolean;
  balance: number;
  // dragon_tiger
  dragon_card?: number;
  tiger_card?: number;
  winner?: string;
  odds?: number;
  // in_out
  ball?: number;
  in_low?: number;
  in_high?: number;
  // crash
  crash_at?: number;
  target?: number;
  cashed_out?: boolean;
  // plinko
  path?: boolean[];
  bucket?: number;
  multipliers?: number[];
  risk?: string;
  rows?: number;
};

export const CASINO_CHIPS = [10, 50, 100, 500, 1000, 5000, 10000];

/** Catalogue of the casino games (config comes from the admin panel). */
export function useCasinoGames() {
  return useQuery({
    queryKey: ["casino_games"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("casino_games").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as CasinoGame[];
    },
  });
}

export function useCasinoGame(slug: CasinoSlug) {
  const games = useCasinoGames();
  return games.data?.find((g) => g.slug === slug) ?? null;
}

/** Server-authoritative round. The client never decides a result. */
export function useCasinoPlay(slug: CasinoSlug, roomId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bet, params }: { bet: number; params: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc("casino_play" as never, {
        p_game: slug,
        p_bet: bet,
        p_params: params,
        p_room_id: roomId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as CasinoResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casino_recent", slug] });
    },
  });
}

/** Recent winners feed for a game. */
export function useCasinoRecent(slug: CasinoSlug, open: boolean) {
  return useQuery({
    queryKey: ["casino_recent", slug],
    enabled: open,
    refetchInterval: open ? 15_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("casino_recent" as never, {
        p_game: slug,
        p_limit: 10,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as {
        username: string;
        avatar: string | null;
        bet: number;
        payout: number;
        created_at: string;
      }[];
    },
  });
}

export function useCasinoLeaderboard(slug: CasinoSlug | null, open: boolean) {
  return useQuery({
    queryKey: ["casino_leaderboard", slug],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("casino_leaderboard" as never, {
        p_game: slug,
        p_days: 7,
        p_limit: 20,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as {
        user_id: string;
        username: string;
        avatar: string | null;
        total_bet: number;
        total_won: number;
        net: number;
        rounds: number;
      }[];
    },
  });
}

// --------------------------------------------------------------------------
// Admin
// --------------------------------------------------------------------------

export function useCasinoAdmin() {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: async ({ slug, ...patch }: Partial<CasinoGame> & { slug: string }) => {
      const { error } = await supabase
        .from("casino_games")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("slug", slug);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["casino_games"] }),
  });
  return { update };
}

export function useCasinoStats(days = 7) {
  return useQuery({
    queryKey: ["casino_stats", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("casino_admin_stats" as never, { p_days: days } as never);
      if (error) throw error;
      return (data ?? []) as unknown as {
        game: string;
        rounds: number;
        players: number;
        total_bet: number;
        total_won: number;
        revenue: number;
      }[];
    },
  });
}

/** Light haptic tap (no-op on desktop). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

/** Tiny WebAudio blip — avoids shipping sound files. */
let audioCtx: AudioContext | null = null;
export function blip(freq = 660, dur = 0.09, type: OscillatorType = "triangle") {
  if (typeof window === "undefined") return;
  try {
    audioCtx ??= new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* ignore */
  }
}
