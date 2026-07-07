import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, ShieldCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesAdmin,
});

const ROLES = ["user", "host", "agent", "moderator", "admin", "super_admin"] as const;
type Role = (typeof ROLES)[number];

type Row = { id: string; user_id: string; role: Role; created_at: string; username?: string | null };

function RolesAdmin() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .neq("role", "user")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      // Fetch usernames
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.username as string | null]));
        rows.forEach((r) => (r.username = map.get(r.user_id) ?? null));
      }
      return rows;
    },
  });

  const [form, setForm] = useState<{ username: string; role: Role }>({ username: "", role: "moderator" });

  const grant = useMutation({
    mutationFn: async () => {
      const u = form.username.trim().replace(/^@/, "");
      if (!u) throw new Error("Username required");
      const { data: prof, error: e1 } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
      if (e1) throw e1;
      if (!prof) throw new Error("User not found");
      const { error } = await supabase.from("user_roles").insert({ user_id: prof.id, role: form.role });
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: `grant_${form.role}`, target: prof.id });
    },
    onSuccess: () => {
      toast.success("Role granted");
      setForm({ username: "", role: "moderator" });
      qc.invalidateQueries({ queryKey: ["admin_roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: "revoke_role", target: id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_roles"] }),
  });

  return (
    <>
      <AdminPageHeader title="Admin Roles" subtitle="Grant/revoke elevated privileges" />
      <div className="glass mb-4 max-w-2xl rounded-2xl p-4">
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="col-span-2 rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs">
            {ROLES.filter((r) => r !== "user").map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={() => grant.mutate()} disabled={grant.isPending} className="glow-4d mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          <Plus className="h-3 w-3" /> Grant role
        </button>
      </div>

      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => (
            <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <ShieldCheck className="h-4 w-4 text-[color:var(--gold)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">@{r.username ?? r.user_id.slice(0, 8)}</p>
                <p className="text-[11px] text-muted-foreground">since {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{r.role}</span>
              <button onClick={() => confirm("Revoke role?") && revoke.mutate(r.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
