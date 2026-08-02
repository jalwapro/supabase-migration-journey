import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Power, Save, Trash2, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useSupportActions, useSupportAdminOverview } from "@/lib/support-room";

export const Route = createFileRoute("/_authenticated/admin/support-room")({
  component: SupportRoomAdmin,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Failed to load: {error?.message}</div>
  ),
});

function SupportRoomAdmin() {
  const overview = useSupportAdminOverview();
  const { kick, endSession } = useSupportActions();
  const [hostQuery, setHostQuery] = useState("");
  const [cfg, setCfg] = useState<Record<string, string | number | boolean>>({});

  const data = overview.data;
  const config = data?.state.config;

  const saveConfig = async () => {
    const { error } = await supabase.rpc("support_admin_config", {
      _title: (cfg["title"] as string) ?? null,
      _enabled: (cfg["enabled"] as boolean) ?? null,
      _maintenance: (cfg["maintenance"] as boolean) ?? null,
      _max_users: cfg["max_users"] != null ? Number(cfg["max_users"]) : null,
      _announcement: (cfg["announcement"] as string) ?? null,
      _cover_url: (cfg["cover_url"] as string) ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Support room updated");
    setCfg({});
    overview.refetch();
  };

  const addHost = async () => {
    const q = hostQuery.trim();
    if (!q) return;
    let userId = q;
    if (!/^[0-9a-f-]{36}$/i.test(q)) {
      const { data: p } = await supabase.from("profiles").select("id").eq("username", q).maybeSingle();
      if (!p) return toast.error("User not found");
      userId = p.id as string;
    }
    const { error } = await supabase.rpc("support_admin_set_host", { _user: userId, _active: true, _note: null });
    if (error) return toast.error(error.message);
    toast.success("Support host added");
    setHostQuery("");
    overview.refetch();
  };

  const toggleHost = async (userId: string, active: boolean) => {
    const { error } = await supabase.rpc("support_admin_set_host", { _user: userId, _active: active, _note: null });
    if (error) return toast.error(error.message);
    overview.refetch();
  };

  const removeHost = async (userId: string) => {
    const { error } = await supabase.rpc("support_admin_remove_host", { _user: userId });
    if (error) return toast.error(error.message);
    overview.refetch();
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="24/7 Support Room"
        subtitle="Manage support hosts, room capacity, the waiting queue and live sessions."
      />

      {overview.isLoading && (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Status" value={data.state.online ? "LIVE" : "Offline"} />
            <Stat label="Host" value={data.state.host?.username ?? "—"} />
            <Stat label="In room" value={`${data.state.seats.length}/${config?.max_users ?? 2}`} />
            <Stat label="Waiting" value={String(data.state.queue_count)} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Room settings</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Title">
                <input
                  defaultValue={config?.title}
                  onChange={(e) => setCfg((c) => ({ ...c, title: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Max users (excl. host)">
                <input
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={config?.max_users}
                  onChange={(e) => setCfg((c) => ({ ...c, max_users: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Announcement">
                <input
                  defaultValue={config?.announcement ?? ""}
                  onChange={(e) => setCfg((c) => ({ ...c, announcement: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Cover URL (R2)">
                <input
                  defaultValue={config?.cover_url ?? ""}
                  onChange={(e) => setCfg((c) => ({ ...c, cover_url: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  defaultChecked={config?.enabled}
                  onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
                  className="accent-[color:var(--primary)]"
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  defaultChecked={config?.maintenance}
                  onChange={(e) => setCfg((c) => ({ ...c, maintenance: e.target.checked }))}
                  className="accent-[color:var(--primary)]"
                />
                Maintenance mode
              </label>
              <button
                onClick={saveConfig}
                className="ml-auto flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-bold text-white"
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button
                onClick={() =>
                  endSession.mutate(undefined, {
                    onSuccess: () => {
                      toast.success("Session force-closed");
                      overview.refetch();
                    },
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                className="flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-bold text-red-400"
              >
                <Power className="h-4 w-4" /> Force close
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Support hosts</h3>
            <div className="mb-3 flex gap-2">
              <input
                value={hostQuery}
                onChange={(e) => setHostQuery(e.target.value)}
                placeholder="Username or user id"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={addHost}
                className="flex items-center gap-1 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="divide-y divide-border">
              {data.hosts.length === 0 && <p className="py-3 text-sm text-muted-foreground">No support hosts yet.</p>}
              {data.hosts.map((h) => (
                <div key={h.user_id} className="flex items-center gap-3 py-2">
                  <span className="text-sm font-semibold">{h.username ?? h.user_id.slice(0, 8)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      h.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {h.is_active ? "active" : "paused"}
                  </span>
                  <button
                    onClick={() => toggleHost(h.user_id, !h.is_active)}
                    className="ml-auto rounded-lg border border-border px-3 py-1 text-xs"
                  >
                    {h.is_active ? "Pause" : "Activate"}
                  </button>
                  <button
                    onClick={() => removeHost(h.user_id)}
                    className="rounded-lg border border-red-500/40 p-1.5 text-red-400"
                    aria-label="Remove host"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Waiting queue</h3>
            {data.queue.length === 0 && <p className="text-sm text-muted-foreground">Queue is empty.</p>}
            <div className="divide-y divide-border">
              {data.queue.map((q, i) => (
                <div key={q.user_id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-6 text-muted-foreground">#{i + 1}</span>
                  <span className="font-semibold">{q.username ?? q.user_id.slice(0, 8)}</span>
                  <span className="truncate text-xs text-muted-foreground">{q.reason ?? ""}</span>
                  <button
                    onClick={() =>
                      kick.mutate(
                        { userId: q.user_id, reason: "admin" },
                        { onSuccess: () => overview.refetch() },
                      )
                    }
                    className="ml-auto rounded-lg border border-red-500/40 p-1.5 text-red-400"
                    aria-label="Remove from queue"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Recent sessions</h3>
            <div className="divide-y divide-border text-sm">
              {data.sessions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-semibold">{s.username ?? s.host_id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleString()} →{" "}
                    {s.ended_at ? new Date(s.ended_at).toLocaleTimeString() : "live"}
                  </span>
                  <span className="ml-auto text-xs">{s.users_served} served</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Moderation logs</h3>
            <div className="max-h-64 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
              {data.logs.map((l) => (
                <div key={l.id} className="flex gap-2">
                  <span className="font-mono">{new Date(l.created_at).toLocaleTimeString()}</span>
                  <span className="font-semibold text-foreground">{l.action}</span>
                  <span className="truncate">{JSON.stringify(l.meta)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-black">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
