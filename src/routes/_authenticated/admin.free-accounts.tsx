import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/free-accounts")({
  component: FreeAdmin,
});

type P = { id: string; username: string | null; avatar: string | null; is_free: boolean };

function FreeAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_free"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,username,avatar,is_free").eq("is_free", true).order("username");
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });

  const [uname, setUname] = useState("");

  const grant = useMutation({
    mutationFn: async () => {
      const u = uname.trim().replace(/^@/, "");
      if (!u) throw new Error("Username required");
      const { data: prof } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
      if (!prof) throw new Error("User not found");
      const { error } = await supabase.from("profiles").update({ is_free: true }).eq("id", prof.id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: "grant_free_account", target: prof.id });
    },
    onSuccess: () => {
      toast.success("Granted");
      setUname("");
      qc.invalidateQueries({ queryKey: ["admin_free"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ is_free: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_free"] }),
  });

  return (
    <>
      <AdminPageHeader title="Free Accounts" subtitle="Users exempted from recharge / limits" />
      <div className="glass mb-4 max-w-2xl rounded-2xl p-4">
        <div className="flex gap-2">
          <input placeholder="username" value={uname} onChange={(e) => setUname(e.target.value)} className="flex-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs" />
          <button onClick={() => grant.mutate()} disabled={grant.isPending} className="glow-4d inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60">
            <Plus className="h-3 w-3" /> Grant
          </button>
        </div>
      </div>

      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((p) => (
            <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-primary/20">
                {p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" alt="" /> : <UserPlus className="h-3.5 w-3.5" />}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-bold">@{p.username ?? p.id.slice(0, 8)}</p>
              <button onClick={() => confirm("Revoke?") && revoke.mutate(p.id)} className="rounded-full bg-red-500/10 p-1.5 text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No free accounts</p>}
        </div>
      )}
    </>
  );
}
