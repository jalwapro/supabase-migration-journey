import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, ShieldCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/roles")({ component: RolesAdmin });

const ROLES = ["user", "host", "agent", "moderator", "finance_operator", "admin", "super_admin"] as const;
type Role = (typeof ROLES)[number];
type Row = { id: string; user_id: string; role: Role; created_at: string; username?: string | null };

const ROLE_LABELS: Record<Role, string> = {
  user: "User",
  host: "Host",
  agent: "Support Agent",
  moderator: "Moderator",
  finance_operator: "Finance Operator",
  admin: "Admin",
  super_admin: "Super Admin",
};

function RolesAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").neq("role", "user").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const ids = Array.from(new Set(rows.map((row) => row.user_id)));
      if (ids.length) {
        const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username").in("id", ids);
        if (profileError) throw profileError;
        const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.username as string | null]));
        rows.forEach((row) => { row.username = names.get(row.user_id) ?? null; });
      }
      return rows;
    },
  });

  const [form, setForm] = useState<{ username: string; role: Role }>({ username: "", role: "moderator" });
  const grant = useMutation({
    mutationFn: async () => {
      const username = form.username.trim().replace(/^@/, "");
      if (!username) throw new Error("Username required");
      const { data: profile, error: lookupError } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (lookupError) throw lookupError;
      if (!profile) throw new Error("User not found");
      const { error } = await supabase.rpc("manage_user_role", { _user_id: profile.id, _role: form.role, _action: "grant" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${ROLE_LABELS[form.role]} granted`);
      setForm({ username: "", role: "moderator" });
      void qc.invalidateQueries({ queryKey: ["admin_roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data: row, error: lookupError } = await supabase.from("user_roles").select("user_id,role").eq("id", id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!row) throw new Error("Role not found");
      const { error } = await supabase.rpc("manage_user_role", { _user_id: row.user_id, _role: row.role, _action: "revoke" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      void qc.invalidateQueries({ queryKey: ["admin_roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <>
    <AdminPageHeader title="Admin Roles" subtitle="Grant/revoke elevated privileges · Super Admin only" />
    <div className="glass mb-4 max-w-2xl rounded-2xl p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input placeholder="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="rounded-lg border border-border bg-input px-2 py-2 text-xs sm:col-span-2" />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="rounded-lg border border-border bg-input px-2 py-2 text-xs">
          {ROLES.filter((role) => role !== "user").map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
        </select>
      </div>
      <button onClick={() => grant.mutate()} disabled={grant.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
        {grant.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Grant role
      </button>
    </div>
    {list.isLoading ? <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : list.isError ? <p className="rounded-xl border border-red-500/30 p-4 text-sm text-red-400">Could not load role assignments. Check admin permissions and database access.</p> : (
      <div className="space-y-2">
        {list.data?.map((row) => <div key={row.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
          <div className="min-w-0 flex-1"><p className="truncate font-bold">@{row.username ?? row.user_id.slice(0, 8)}</p><p className="text-[11px] text-muted-foreground">since {new Date(row.created_at).toLocaleDateString()}</p></div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{ROLE_LABELS[row.role] ?? row.role}</span>
          <button disabled={revoke.isPending} aria-label={`Revoke ${row.role} role`} onClick={() => window.confirm(`Revoke ${ROLE_LABELS[row.role] ?? row.role} from @${row.username ?? row.user_id.slice(0, 8)}?`) && revoke.mutate(row.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>)}
        {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No elevated roles assigned.</p>}
      </div>
    )}
  </>;
}
