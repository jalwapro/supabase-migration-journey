import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupportSeat = {
  seat: number;
  muted: boolean;
  joined_at: string;
  user: { id: string; username: string | null; avatar: string | null };
};

export type SupportRoomState = {
  config: {
    room_id: string | null;
    title: string;
    cover_url: string | null;
    enabled: boolean;
    maintenance: boolean;
    max_users: number;
    announcement: string | null;
  };
  online: boolean;
  session: { id: string; host_id: string; started_at: string; users_served: number } | null;
  host: { id: string; username: string | null; avatar: string | null } | null;
  seats: SupportSeat[];
  queue_count: number;
  my_seat: number | null;
  my_position: number;
  is_host: boolean;
  is_admin: boolean;
};

/** Live state of the single permanent 24/7 support room. */
export function useSupportRoomState(pollMs = 4000) {
  return useQuery({
    queryKey: ["support_room_state"],
    refetchInterval: pollMs,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_room_state");
      if (error) throw error;
      return data as unknown as SupportRoomState;
    },
  });
}

export function useSupportActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["support_room_state"] });

  const join = useMutation({
    mutationFn: async (reason?: string) => {
      const { data, error } = await supabase.rpc("support_join", { _reason: reason ?? null });
      if (error) throw error;
      return data as unknown as { status: "seated" | "waiting" | "host"; seat?: number; position?: number; room_id: string | null };
    },
    onSuccess: refresh,
  });

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("support_leave");
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const goLive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("support_host_go_live");
      if (error) throw error;
      return data as unknown as { room_id: string; session_id: string };
    },
    onSuccess: refresh,
  });

  const endSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("support_host_end");
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const kick = useMutation({
    mutationFn: async (args: { userId: string; reason?: string }) => {
      const { error } = await supabase.rpc("support_host_kick", {
        _target: args.userId,
        _reason: args.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const setMute = useMutation({
    mutationFn: async (args: { userId: string; muted: boolean }) => {
      const { error } = await supabase.rpc("support_host_set_mute", {
        _target: args.userId,
        _muted: args.muted,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { join, leave, goLive, endSession, kick, setMute };
}

/** Admin overview: hosts, sessions, waiting queue and moderation logs. */
export function useSupportAdminOverview() {
  return useQuery({
    queryKey: ["support_admin_overview"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_admin_overview", { _limit: 50 });
      if (error) throw error;
      return data as unknown as {
        state: SupportRoomState;
        hosts: { user_id: string; username: string | null; avatar: string | null; is_active: boolean; note: string | null; created_at: string }[];
        sessions: { id: string; host_id: string; username: string | null; started_at: string; ended_at: string | null; users_served: number }[];
        queue: { user_id: string; username: string | null; reason: string | null; created_at: string }[];
        logs: { id: number; action: string; actor_id: string | null; target_id: string | null; created_at: string; meta: Record<string, unknown> }[];
      };
    },
  });
}

export function uidFromUuid(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 2_000_000_000) + 1;
}

export const SUPPORT_CHANNEL = "jalwa-support-247";
