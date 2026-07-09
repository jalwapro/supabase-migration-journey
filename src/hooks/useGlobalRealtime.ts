import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { openNotification } from "@/components/NotificationPopup";
import type { NotificationRow } from "@/hooks/useNotifications";



/**
 * Global realtime bridge for the signed-in user.
 * Subscribes to every user-scoped table once (filtered by user id) and
 * invalidates the matching React Query keys so any open screen refreshes
 * without the user having to pull-to-refresh.
 *
 * Filtered subscriptions only (per project scale rules): each `on()` sets
 * a `user_id=eq.<uid>` style filter so the Postgres replication stream
 * never fans out unrelated rows to this client.
 */
type Sub = {
  table: string;
  filter: string;
  keys: string[];
};

function subscribe(qc: QueryClient, channelName: string, subs: Sub[]) {
  let ch = supabase.channel(channelName);
  for (const s of subs) {
    ch = (
      ch as unknown as {
        on: (
          type: string,
          cfg: Record<string, unknown>,
          cb: () => void,
        ) => typeof ch;
      }
    ).on(
      "postgres_changes",
      { event: "*", schema: "public", table: s.table, filter: s.filter },
      () => {
        for (const k of s.keys) qc.invalidateQueries({ queryKey: [k] });
      },
    );
  }
  ch.subscribe();
  return ch;
}

export function useGlobalRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const uid = user.id;

    // Split into a few channels so a single bad filter can't kill everything.
    const ch1 = subscribe(qc, `me:${uid}`, [
      {
        table: "profiles",
        filter: `id=eq.${uid}`,
        keys: ["me", "me-counts", "profile", "public-profile", "auth-profile"],
      },
      {
        table: "wallet_transactions",
        filter: `user_id=eq.${uid}`,
        keys: ["wallet", "wallet_tx", "me-counts"],
      },
      {
        table: "notification_prefs",
        filter: `user_id=eq.${uid}`,
        keys: ["notification_prefs"],
      },

      {
        table: "push_subscriptions",
        filter: `user_id=eq.${uid}`,
        keys: ["push_subscriptions"],
      },
    ]);

    const ch2 = subscribe(qc, `social:${uid}`, [
      {
        table: "follows",
        filter: `follower_id=eq.${uid}`,
        keys: [
          "friends",
          "is-following",
          "me-counts",
          "public-profile-stats",
          "following-list",
        ],
      },
      {
        table: "follows",
        filter: `following_id=eq.${uid}`,
        keys: [
          "friends",
          "is-following",
          "me-counts",
          "public-profile-stats",
          "followers-list",
        ],
      },
      {
        table: "blocked_users",
        filter: `blocker_id=eq.${uid}`,
        keys: ["blocked", "friends"],
      },
    ]);

    const ch3 = subscribe(qc, `dm-received:${uid}`, [
      {
        table: "direct_messages",
        filter: `recipient_id=eq.${uid}`,
        keys: ["dm", "dm_index", "dm-thread", "dm-threads", "messages", "conversations"],
      },
    ]);

    const ch3b = subscribe(qc, `dm-sent:${uid}`, [
      {
        table: "direct_messages",
        filter: `sender_id=eq.${uid}`,
        keys: ["dm", "dm_index", "dm-thread", "dm-threads", "messages", "conversations"],
      },
    ]);

    const ch3c = subscribe(qc, `gifts:${uid}`, [
      {
        table: "gift_sends",
        filter: `receiver_id=eq.${uid}`,
        keys: ["wallet", "wallet_tx", "me-counts", "gifts-received"],
      },
      {
        table: "gift_sends",
        filter: `sender_id=eq.${uid}`,
        keys: ["wallet", "wallet_tx", "me-counts", "gifts-sent"],
      },
    ]);

    const ch4 = subscribe(qc, `assets:${uid}`, [
      {
        table: "live_rooms",
        filter: `host_id=eq.${uid}`,
        keys: ["my-rooms", "rooms"],
      },
      {
        table: "gallery_images",
        filter: `owner_id=eq.${uid}`,
        keys: ["gallery", "user-public-gallery", "user-private-gallery"],
      },
      {
        table: "gallery_unlocks",
        filter: `user_id=eq.${uid}`,
        keys: ["gallery-unlocks", "album-access"],
      },
      {
        table: "gallery_unlocks",
        filter: `owner_id=eq.${uid}`,
        keys: ["gallery-unlocks", "album-access"],
      },
      {
        table: "user_themes",
        filter: `user_id=eq.${uid}`,
        keys: ["user-themes", "user-owned-items", "theme-shop"],
      },
      {
        table: "recharge_requests",
        filter: `user_id=eq.${uid}`,
        keys: ["recharge", "recharge-history", "wallet"],
      },
      {
        table: "withdrawal_requests",
        filter: `user_id=eq.${uid}`,
        keys: ["withdraw", "withdraw-history", "wallet"],
      },
    ]);

    // Dedicated notifications channel with toast + cache refresh.
    const chNotif = supabase
      .channel(`notif:${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload: { new: NotificationRow }) => {
          qc.invalidateQueries({ queryKey: ["notif-unread", uid] });
          qc.invalidateQueries({ queryKey: ["notif-feed", uid] });
          const row = payload.new;
          if (row?.title) {
            toast(row.title, {
              description: row.body ?? undefined,
              action: { label: "Open", onClick: () => openNotification(row) },
            });
          }
        },

      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch1);
      void supabase.removeChannel(ch2);
      void supabase.removeChannel(ch3);
      void supabase.removeChannel(ch3b);
      void supabase.removeChannel(ch3c);
      void supabase.removeChannel(ch4);
      void supabase.removeChannel(chNotif);
    };
  }, [user, qc]);
}

