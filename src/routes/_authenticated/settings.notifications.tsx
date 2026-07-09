import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { NotificationKind } from "@/hooks/useNotifications";

export const Route = createFileRoute("/_authenticated/settings/notifications")({ component: Page });

const GROUPS: { label: string; kinds: { key: NotificationKind; label: string }[] }[] = [
  { label: "Social", kinds: [
    { key: "friend_request", label: "Friend requests" },
    { key: "friend_accept", label: "Friend accepted" },
    { key: "dm_new", label: "Direct messages" },
    { key: "mention", label: "Mentions" },
  ] },
  { label: "Room", kinds: [
    { key: "host_live", label: "Followed host went live" },
    { key: "seat_invite", label: "Seat invites" },
    { key: "mod_added", label: "You became a moderator" },
    { key: "kicked", label: "You were kicked" },
  ] },
  { label: "Economy", kinds: [
    { key: "gift_received", label: "Gifts received" },
    { key: "recharge_approved", label: "Recharge approved" },
    { key: "recharge_rejected", label: "Recharge rejected" },
    { key: "withdrawal_approved", label: "Withdrawal approved" },
    { key: "withdrawal_rejected", label: "Withdrawal rejected" },
    { key: "vip_expiring", label: "VIP about to expire" },
    { key: "vip_expired", label: "VIP expired" },
  ] },
  { label: "System", kinds: [
    { key: "system_broadcast", label: "Announcements" },
    { key: "account_warning", label: "Warnings" },
    { key: "account_action", label: "Account actions" },
  ] },
];

type Prefs = {
  user_id: string;
  in_app: Record<string, boolean>;
  push: Record<string, boolean>;
  email: Record<string, boolean>;
  push_enabled: boolean;
  email_enabled: boolean;
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_prefs")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Prefs | null) ?? {
        user_id: user!.id, in_app: {}, push: {}, email: {},
        push_enabled: true, email_enabled: true,
      };
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      if (!user || !q.data) return;
      const next = { ...q.data, ...patch, user_id: user.id };
      const { error } = await supabase.from("notification_prefs").upsert(next);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs", user?.id] }),
  });

  const toggle = (channel: "in_app" | "push" | "email", kind: NotificationKind, val: boolean) => {
    if (!q.data) return;
    const nextMap = { ...(q.data[channel] ?? {}), [kind]: val };
    save.mutate({ [channel]: nextMap } as Partial<Prefs>);
  };

  const val = (channel: "in_app" | "push" | "email", kind: NotificationKind) => {
    const m = q.data?.[channel] ?? {};
    return m[kind] !== false; // default on
  };

  return (
    <>
      <AppShell
        title="Notification prefs"
        right={
          <Link to="/settings" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/60">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <div className="px-3 py-4">
          {q.isLoading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="glass mb-4 rounded-2xl p-4">
                <MasterToggle label="Push notifications (mobile/browser)" value={q.data?.push_enabled ?? true}
                  onChange={(v) => save.mutate({ push_enabled: v })} />
                <div className="mt-3 border-t border-border pt-3">
                  <MasterToggle label="Email notifications" value={q.data?.email_enabled ?? true}
                    onChange={(v) => save.mutate({ email_enabled: v })} />
                </div>
              </div>

              {GROUPS.map((g) => (
                <div key={g.label} className="glass mb-4 rounded-2xl p-4">
                  <h3 className="mb-1 font-bold">{g.label}</h3>
                  <div className="mb-3 grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span />
                    <span className="w-10 text-center">App</span>
                    <span className="w-10 text-center">Push</span>
                    <span className="w-10 text-center">Email</span>
                  </div>
                  <ul className="space-y-2">
                    {g.kinds.map((k) => (
                      <li key={k.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                        <span className="truncate text-sm">{k.label}</span>
                        <Check3 v={val("in_app", k.key)} onChange={(v) => toggle("in_app", k.key, v)} />
                        <Check3 v={val("push", k.key)} onChange={(v) => toggle("push", k.key, v)} />
                        <Check3 v={val("email", k.key)} onChange={(v) => toggle("email", k.key, v)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function MasterToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-[color:var(--primary)]" : "bg-muted"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function Check3({ v, onChange }: { v: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!v)}
      className={`h-6 w-10 rounded-full border transition ${v ? "border-[color:var(--primary)] bg-[color:var(--primary)]/20" : "border-border bg-transparent"}`}
      aria-pressed={v}
    >
      <span className={`mx-auto block h-2 w-2 rounded-full ${v ? "bg-[color:var(--primary)]" : "bg-muted-foreground/40"}`} />
    </button>
  );
}
