import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { openNotification } from "@/components/NotificationPopup";
import { playNotifySound } from "@/lib/notify-sound";
import type { NotificationRow } from "@/hooks/useNotifications";

/**
 * Global realtime bridge for the signed-in user.
 *
 * Performance rules:
 * - One multiplexed Supabase channel per signed-in session.
 * - The channel is removed while the document is hidden, so background
 *   WebSockets do not keep the Android radio/CPU awake.
 * - Low-frequency catalog tables share the same channel instead of opening a
 *   delayed second socket.
 */
type Sub = {
  table: string;
  filter?: string;
  keys?: string[];
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  onChange?: (payload: any) => void;
};

function subscribe(
  qc: QueryClient,
  channelName: string,
  subs: Sub[],
  onStatus?: (status: string, error?: unknown) => void,
) {
  let ch = supabase.channel(channelName);
  const pendingKeys = new Map<string, string>();
  let flushTimer: number | null = null;
  const queueKeys = (keys: string[]) => {
    for (const key of keys) pendingKeys.set(key, key);
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      const queued = [...pendingKeys.values()];
      pendingKeys.clear();
      for (const key of queued) {
        void qc.invalidateQueries({ queryKey: [key], refetchType: "active" });
      }
    }, 75);
  };

  for (const sub of subs) {
    ch = (
      ch as unknown as {
        on: (
          type: string,
          cfg: Record<string, unknown>,
          cb: (payload: any) => void,
        ) => typeof ch;
      }
    ).on(
      "postgres_changes",
      {
        event: sub.event ?? "*",
        schema: "public",
        table: sub.table,
        ...(sub.filter ? { filter: sub.filter } : {}),
      },
      (payload: any) => {
        if (sub.keys?.length) queueKeys(sub.keys);
        sub.onChange?.(payload);
      },
    );
  }

  ch.subscribe((status, error) => {
    onStatus?.(status, error);
    // SUBSCRIBED only means the socket is ready; it is not a database change.
    // Invalidating every mapped key here caused profile, wallet, and room queries
    // to refetch whenever Android backgrounded/resumed or Realtime reconnected.
    // Initial queries fetch on mount, and actual Postgres events invalidate their
    // own keys through the callbacks above.
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      console.warn("[Realtime]", channelName, status, error);
    }
  });

  return ch;
}

const CATALOG_QUERY_KEYS: Record<string, string[]> = {
  banners: ["banners"],
  gifts: ["gifts"],
  gift_categories: ["gift-categories", "gifts"],
  themes: ["themes", "theme-shop"],
  user_themes: ["user-themes", "user-owned-items", "theme-shop"],
  dp_frames: ["dp-frames", "frames"],
  user_frames: ["user-frames", "frames"],
  room_backgrounds: ["room-backgrounds"],
  ads: ["ads"],
  cms_pages: ["cms-pages"],
  vip_level_config: ["vip-level-config"],
  custom_themes: ["custom-themes"],
  room_top_frames: ["room_top_frames_active"],
  entrance_effects: ["entrance-effects"],
  profile_cards: ["profile-cards"],
  user_profile_cards: ["user-profile-cards"],
  app_customization_published: ["published-global-config"],
  app_customization_assets: ["app-customization-assets"],
  room_slides: ["room-slides"],
  spotlight_animations: ["spotlight-animations"],
  theme_categories: ["theme-categories"],
};

export function useGlobalRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const uid = user.id;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const catalogTables = [
      "banners",
      "gifts",
      "dp_frames",
      "room_backgrounds",
    ] as const;

    const subs: Sub[] = [
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
      {
        table: "follows",
        filter: `follower_id=eq.${uid}`,
        keys: ["friends", "is-following", "me-counts", "public-profile-stats", "following-list", "chat-followers"],
      },
      {
        table: "follows",
        filter: `following_id=eq.${uid}`,
        keys: ["friends", "is-following", "me-counts", "public-profile-stats", "followers-list", "chat-followers"],
      },
      {
        table: "blocked_users",
        filter: `blocker_id=eq.${uid}`,
        keys: ["blocked", "friends"],
      },
      {
        table: "direct_messages",
        filter: `recipient_id=eq.${uid}`,
        keys: ["dm", "dm_index", "dm-thread", "dm-threads", "dm-unread", "messages", "conversations", "msg-notif-count"],
      },
      {
        table: "direct_messages",
        filter: `sender_id=eq.${uid}`,
        keys: ["dm", "dm_index", "dm-thread", "dm-threads", "messages", "conversations"],
      },
      {
        table: "gift_sends",
        filter: `receiver_id=eq.${uid}`,
        keys: ["wallet", "wallet_tx", "me-counts", "gifts-received", "profile"],
      },
      {
        table: "gift_sends",
        filter: `sender_id=eq.${uid}`,
        keys: ["wallet", "wallet_tx", "me-counts", "gifts-sent", "profile"],
      },
      {
        table: "host_popularity_stats",
        filter: `host_id=eq.${uid}`,
        keys: ["host-popularity", "profile", "public-profile", "me"],
      },
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
      {
        table: "notifications",
        event: "INSERT",
        filter: `user_id=eq.${uid}`,
        keys: ["notif-unread", "notif-feed", "msg-notif-count"],
        onChange: (payload: { new: NotificationRow }) => {
          const row = payload.new;
          if (!row?.title) return;
          playNotifySound();
          toast(row.title, {
            description: row.body ?? undefined,
            action: { label: "Open", onClick: () => openNotification(row) },
          });
        },
      },
      {
        table: "milestone_broadcasts",
        event: "INSERT",
        onChange: (payload: { new: { host_username: string | null; room_title: string | null } }) => {
          const who = payload.new.host_username ?? "Host";
          toast.success(`🏆 @${who} ka popularity task complete ho gaya!`, {
            description: payload.new.room_title ?? undefined,
            duration: 8000,
          });
        },
      },
      ...catalogTables.map((table) => ({
        table,
        keys: CATALOG_QUERY_KEYS[table] ?? [],
      })),
    ];

    const start = () => {
      if (channel || document.visibilityState !== "visible") return;
      channel = subscribe(qc, `global-realtime:${uid}`, subs);
    };

    const stop = () => {
      if (!channel) return;
      const current = channel;
      channel = null;
      void supabase.removeChannel(current);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    let lastOnlineReconcile = 0;
    const reconcile = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastOnlineReconcile < 15_000) return;
      lastOnlineReconcile = now;
      [
        "me", "me-counts", "profile", "public-profile", "auth-profile",
        "wallet", "wallet_tx", "friends", "dm", "dm_index", "dm-thread",
        "dm-threads", "dm-unread", "messages", "conversations", "msg-notif-count",
        "notifications", "notif-unread", "notif-feed", "my-rooms", "rooms",
        "gallery", "gallery-unlocks", "album-access", "user-themes",
        "recharge", "recharge-history", "withdraw", "withdraw-history",
        "host-popularity",
      ].forEach((key) => void qc.invalidateQueries({ queryKey: [key], refetchType: "active" }));
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", reconcile);
    start();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", reconcile);
      stop();
    };
  }, [user, qc]);
}
