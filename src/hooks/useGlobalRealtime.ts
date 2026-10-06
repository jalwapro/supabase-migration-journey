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
 * Subscribes to user-scoped tables and invalidates the matching React Query
 * keys so open screens refresh without a manual page reload.
 */
type Sub = {
  table: string;
  filter: string;
  keys: string[];
};

function subscribe(qc: QueryClient, channelName: string, subs: Sub[], onStatus?: (status: string, error?: unknown) => void) {
  let ch = supabase.channel(channelName);
  const pendingKeys = new Map<string, string>();
  let flushTimer: number | null = null;
  let flushAllActive = false;
  const queueAllActive = () => {
    flushAllActive = true;
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      if (!flushAllActive) return;
      flushAllActive = false;
      pendingKeys.clear();
      void qc.invalidateQueries({ refetchType: "active" });
    }, 100);
  };
  const queueKeys = (keys: string[]) => {
    for (const key of keys) pendingKeys.set(key, key);
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      const keys = [...pendingKeys.values()];
      pendingKeys.clear();
      for (const key of keys) void qc.invalidateQueries({ queryKey: [key], refetchType: "active" });
    }, 75);
  };
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
      () => queueKeys(s.keys),
    );
  }
  ch.subscribe((status, error) => {
    onStatus?.(status, error);
    if (status === "SUBSCRIBED") {
      // Reconcile any writes that happened while the socket was reconnecting.
      queueKeys(subs.flatMap((s) => s.keys))
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      console.warn("[Realtime]", channelName, status, error);
    }
  });
  return ch;
}

const CATALOG_QUERY_KEYS: Record<string, string[]> = {
  banners: ["banners"], gifts: ["gifts"], gift_categories: ["gift-categories", "gifts"],
  themes: ["themes", "theme-shop"], user_themes: ["user-themes", "user-owned-items", "theme-shop"],
  dp_frames: ["dp-frames", "frames"], user_frames: ["user-frames", "frames"],
  room_backgrounds: ["room-backgrounds"], ads: ["ads"], cms_pages: ["cms-pages"],
  vip_level_config: ["vip-level-config"], custom_themes: ["custom-themes"],
  room_top_frames: ["room_top_frames_active"], entrance_effects: ["entrance-effects"],
  profile_cards: ["profile-cards"], user_profile_cards: ["user-profile-cards"],
  app_customization_published: ["published-global-config"],
  app_customization_assets: ["app-customization-assets"], room_slides: ["room-slides"],
  spotlight_animations: ["spotlight-animations"], theme_categories: ["theme-categories"],
};

const APP_REALTIME_TABLES_UNUSED = [
  "user_roles","coin_packages","recharge_requests","banners","payment_accounts",
  "gifts","gift_categories","gallery_images","gallery_unlocks","themes","user_themes","vip_tiers",
  "withdrawal_requests","dp_frames","user_frames","room_backgrounds","ads","cms_pages","support_tickets",
  "user_reports","admin_logs","theme_categories","partners","categories","friendships","games","game_rounds",
  "families","family_members","vip_level_config","vip_rewards_claimed","vip_level_events","custom_themes",
  "spin_prizes","pk_invites","pk_matches","recharge_orders","seat_requests","pk_champions",
  "room_bans","support_conversations","support_messages","spotlight_animations",
  "spotlight_triggers","room_top_frames","entrance_effects","user_entrance_effects","entrance_purchases",
  "profile_cards","user_profile_cards","profile_card_purchases",
  "mini_games",
  "support_room_config","support_hosts","support_room_sessions","support_room_seats","support_room_queue",
  "asset_favorites","gift_render_presets","slots_config","slots_jackpot","slots_free_spins",
  "casino_games","room_games","app_customization_pages","app_customization_sections",
  "app_customization_components","app_customization_themes","app_customization_assets",
  "app_customization_navigation","app_customization_layouts","app_customization_versions",
  "app_customization_drafts","app_customization_published","app_customization_change_log",
  "payment_gateway_configs","payment_gateway_transactions","admin_payment_2fa","app_studio_documents",
  "app_studio_design_tokens","platform_events","platform_event_participants","room_slides",
  "card_recharge_orders"
] as const;

export function useGlobalRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const uid = user.id;

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
          "chat-followers",
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
          "chat-followers",
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
        keys: [
          "dm",
          "dm_index",
          "dm-thread",
          "dm-threads",
          "dm-unread",
          "messages",
          "conversations",
          "msg-notif-count",
        ],
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
        keys: ["wallet", "wallet_tx", "me-counts", "gifts-received", "profile"],
      },
      {
        table: "gift_sends",
        filter: `sender_id=eq.${uid}`,
        keys: ["wallet", "wallet_tx", "me-counts", "gifts-sent", "profile"],
      },
    ]);

    // Host popularity is persisted by the gift_sends trigger. Keep the
    // current user's host dashboard/profile caches in sync when that row moves.
    const chPopularity = subscribe(qc, `host-popularity:${uid}`, [
      {
        table: "host_popularity_stats",
        filter: `host_id=eq.${uid}`,
        keys: ["host-popularity", "profile", "public-profile", "me"],
      },
    ]);

    // The catalog contains many low-frequency admin/shop tables. Creating this
    // channel during first paint adds a large realtime subscription burst.
    // Defer it until the app has rendered, while keeping all user-critical
    // realtime channels above immediate.
    let chCatalog: ReturnType<typeof supabase.channel> | null = null;
    const catalogTimer = window.setTimeout(() => {
      // Catalog updates are low-frequency. Keep only the small set of catalog
      // tables that materially affect an active mobile session; everything else
      // is refreshed by React Query staleTime or targeted admin invalidation.
      const CRITICAL_CATALOG = ["banners", "gifts", "dp_frames", "room_backgrounds"] as const;
      let channel = supabase.channel(`app-catalog:${uid}`);
      for (const table of CRITICAL_CATALOG) {
        channel = (
          channel as unknown as {
            on: (
              type: string,
              cfg: Record<string, unknown>,
              cb: () => void,
            ) => typeof channel;
          }
        ).on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            const keys = CATALOG_QUERY_KEYS[table] ?? [];
            if (!keys.length) return;
            for (const key of keys) {
              void qc.invalidateQueries({ queryKey: [key], refetchType: "active" });
            }
          },
        );
      }
      chCatalog = channel;
      channel.subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[Realtime] app-catalog", status, error);
        }
      });
    }, 15000);

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

    const chNotif = supabase
      .channel(`notif:${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload: { new: NotificationRow }) => {
          qc.invalidateQueries({ queryKey: ["notif-unread", uid] });
          qc.invalidateQueries({ queryKey: ["notif-feed", uid] });
          qc.invalidateQueries({ queryKey: ["msg-notif-count", uid] });
          const row = payload.new;
          if (row?.title) {
            playNotifySound();
            toast(row.title, {
              description: row.body ?? undefined,
              action: { label: "Open", onClick: () => openNotification(row) },
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "milestone_broadcasts" },
        (payload: { new: { host_username: string | null; room_title: string | null } }) => {
          const who = payload.new.host_username ?? "Host";
          toast.success(`🏆 @${who} ka popularity task complete ho gaya!`, {
            description: payload.new.room_title ?? undefined,
            duration: 8000,
          });
        },
      )
      .subscribe();

    let lastOnlineReconcile = 0;
    const reconcile = () => {
      const now = Date.now();
      if (now - lastOnlineReconcile < 15_000) return;
      lastOnlineReconcile = now;
      ([
        "me", "me-counts", "profile", "public-profile", "auth-profile", "wallet", "wallet_tx",
        "friends", "dm", "dm_index", "dm-thread", "dm-threads", "dm-unread", "messages",
        "conversations", "msg-notif-count", "notifications", "notif-unread", "notif-feed",
        "my-rooms", "rooms", "gallery", "gallery-unlocks", "album-access", "user-themes",
        "recharge", "recharge-history", "withdraw", "withdraw-history", "host-popularity",
      ]).forEach((k) => void qc.invalidateQueries({ queryKey: [k], refetchType: "active" }));
    };
    window.addEventListener("online", reconcile);

    return () => {
      void supabase.removeChannel(ch1);
      void supabase.removeChannel(ch2);
      void supabase.removeChannel(ch3);
      void supabase.removeChannel(ch3b);
      void supabase.removeChannel(ch3c);
      void supabase.removeChannel(chPopularity);
      void supabase.removeChannel(ch4);
      window.clearTimeout(catalogTimer);
      if (chCatalog) void supabase.removeChannel(chCatalog);
      void supabase.removeChannel(chNotif);
      window.removeEventListener("online", reconcile);
    };
  }, [user, qc]);
}
