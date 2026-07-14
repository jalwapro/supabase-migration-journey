import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationKind =
  | "friend_request" | "friend_accept" | "dm_new" | "mention"
  | "host_live" | "seat_invite" | "mod_added" | "kicked"
  | "gift_received" | "recharge_approved" | "recharge_rejected"
  | "withdrawal_approved" | "withdrawal_rejected" | "vip_expiring" | "vip_expired"
  | "system_broadcast" | "account_warning" | "account_action";

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notif-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("notif_unread_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
    staleTime: 30_000,
  });
}

// NOTE: `useNotificationRealtime` was removed — it duplicated the notification
// channel already opened by `useGlobalRealtime` (see src/hooks/useGlobalRealtime.ts).
// A second subscription per user doubled realtime channel load at scale.

