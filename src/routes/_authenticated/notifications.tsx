import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Bell, Check, CheckCheck, Loader2, Settings2, UserPlus, MessageCircle, Gift, Wallet, Radio, Shield, AlertTriangle } from "lucide-react";
import type { NotificationRow, NotificationKind } from "@/hooks/useNotifications";
import { openNotification } from "@/components/NotificationPopup";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({ component: Page });

const TABS: { key: string; label: string; kinds: NotificationKind[] | null }[] = [
  { key: "all", label: "All", kinds: null },
  { key: "social", label: "Social", kinds: ["friend_request", "friend_accept", "dm_new", "mention"] },
  { key: "room", label: "Room", kinds: ["host_live", "seat_invite", "mod_added", "kicked"] },
  { key: "economy", label: "Economy", kinds: ["gift_received", "recharge_approved", "recharge_rejected", "withdrawal_approved", "withdrawal_rejected", "vip_expiring", "vip_expired"] },
  { key: "system", label: "System", kinds: ["system_broadcast", "account_warning", "account_action"] },
];

function iconFor(kind: NotificationKind) {
  if (kind === "friend_request" || kind === "friend_accept") return UserPlus;
  if (kind === "dm_new" || kind === "mention") return MessageCircle;
  if (kind === "gift_received") return Gift;
  if (kind.startsWith("recharge") || kind.startsWith("withdrawal") || kind.startsWith("vip")) return Wallet;
  if (kind === "host_live" || kind === "seat_invite" || kind === "mod_added" || kind === "kicked") return Radio;
  if (kind === "system_broadcast") return Shield;
  return AlertTriangle;
}

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");

  const feed = useQuery({
    queryKey: ["notif-feed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!feed.data) return [];
    const kinds = TABS.find((t) => t.key === tab)?.kinds;
    if (!kinds) return feed.data;
    return feed.data.filter((n) => kinds.includes(n.kind));
  }, [feed.data, tab]);

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-feed", user?.id] });
      qc.invalidateQueries({ queryKey: ["notif-unread", user?.id] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("notif_mark_all_read");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All marked read");
      qc.invalidateQueries({ queryKey: ["notif-feed", user?.id] });
      qc.invalidateQueries({ queryKey: ["notif-unread", user?.id] });
    },
  });

  return (
    <>
      <AppShell
        title="Notifications"
        right={
          <Link
            to="/settings/notifications"
            aria-label="Notification settings"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/60"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        }
      >
        <div className="sticky top-[56px] z-20 flex gap-1.5 overflow-x-auto border-b border-border bg-background/95 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center">
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || !feed.data?.some((n) => !n.read_at)}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              <CheckCheck className="h-3 w-3" /> Mark all
            </button>
          </div>
        </div>

        <div className="px-3 py-3">
          {feed.isLoading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Bell className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((n) => {
                const Icon = iconFor(n.kind);
                const unread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    onClick={() => unread && markRead.mutate([n.id])}
                    className={`glass flex gap-3 rounded-2xl p-3 transition ${unread ? "ring-1 ring-[color:var(--primary)]/40" : "opacity-80"}`}
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--primary)]/15 text-[color:var(--primary)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {unread && <div className="h-2 w-2 shrink-0 self-center rounded-full bg-[color:var(--primary)]" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
