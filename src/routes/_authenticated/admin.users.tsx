import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Search, Shield, Ban, Coins as CoinsIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type Row = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  coins: number;
  diamonds: number;
  level: number;
  is_vip: boolean;
  status: string;
  user_code: string | null;
  last_seen: string | null;
};

function UsersAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const list = useQuery({
    queryKey: ["admin_users", q],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id,username,full_name,avatar,coins,diamonds,level,is_vip,status,user_code,last_seen")
        .order("last_seen", { ascending: false, nullsFirst: false })
        .limit(50);
      if (q.trim()) {
        query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%,user_code.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustCoins = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const row = list.data?.find((r) => r.id === id);
      const next = Math.max(0, (row?.coins ?? 0) + delta);
      const { error } = await supabase.from("profiles").update({ coins: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Search, moderate and adjust balances"
        right={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search username / code…"
              className="w-64 rounded-full border border-border bg-input py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
        }
      />
      <div className="glass overflow-hidden rounded-2xl">
        {list.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2 text-right">Coins</th>
                  <th className="px-3 py-2 text-right">Diamonds</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-card/60" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.username ?? u.full_name ?? "—"}</p>
                          <p className="truncate text-[10px] text-muted-foreground">Lvl {u.level} {u.is_vip && "· VIP"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{u.user_code ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{u.coins.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{u.diamonds.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            const v = Number(prompt("Add coins (negative to deduct):", "100"));
                            if (Number.isFinite(v) && v !== 0) adjustCoins.mutate({ id: u.id, delta: v });
                          }}
                          className="rounded-full bg-[color:var(--gold)]/15 p-1.5 text-[color:var(--gold)]"
                          title="Adjust coins"
                        >
                          <CoinsIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setStatus.mutate({ id: u.id, status: u.status === "banned" ? "active" : "banned" })}
                          className="rounded-full bg-red-500/15 p-1.5 text-red-400"
                          title={u.status === "banned" ? "Unban" : "Ban"}
                        >
                          {u.status === "banned" ? <Shield className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.data?.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
