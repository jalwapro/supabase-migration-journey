import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Search, UserCog, Ban, Coins, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/profile-admin")({
  component: ProfileAdmin,
});

type P = {
  id: string;
  username: string | null;
  avatar: string | null;
  full_name: string | null;
  coins: number;
  diamonds: number;
  level: number;
  is_vip: boolean;
  status: string;
};

function ProfileAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<P | null>(null);

  const search = useQuery({
    queryKey: ["admin_profile_search", q],
    enabled: q.trim().length > 0,
    queryFn: async () => {
      const term = q.trim().replace(/^@/, "");
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,full_name,coins,diamonds,level,is_vip,status")
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<P>) => {
      if (!selected) throw new Error("No user selected");
      const { error } = await supabase.from("profiles").update(patch).eq("id", selected.id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: "profile_admin_edit", target: selected.id, details: patch });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_profile_search"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Profile Admin" subtitle="Search users, adjust balance / status / VIP" />
      <div className="glass mb-4 flex items-center gap-2 rounded-full px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username or name" className="w-full bg-transparent text-sm outline-none" />
      </div>

      {search.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {search.data?.map((p) => (
            <button key={p.id} onClick={() => setSelected(p)} className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-primary/20">
                {p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" alt="" /> : <UserCog className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">@{p.username ?? "user"}</p>
                <p className="truncate text-[11px] text-muted-foreground">Lv{p.level} · 💰 {p.coins.toLocaleString()} · 💎 {p.diamonds.toLocaleString()} · {p.status}</p>
              </div>
              {p.is_vip && <Crown className="h-4 w-4 text-[color:var(--gold)]" />}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSelected(null)} />
          <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-background p-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
            <p className="mb-2 text-lg font-bold">@{selected.username}</p>
            <p className="mb-3 text-[11px] text-muted-foreground">Lv{selected.level} · 💰 {selected.coins.toLocaleString()} · 💎 {selected.diamonds.toLocaleString()}</p>

            <div className="space-y-2">
              <ActionBtn
                icon={Coins}
                label="Add / deduct coins"
                onClick={() => {
                  const n = Number(prompt("Coins delta (positive to add, negative to deduct)"));
                  if (!Number.isFinite(n)) return;
                  update.mutate({ coins: Math.max(0, selected.coins + n) });
                }}
              />
              <ActionBtn
                icon={Crown}
                label={selected.is_vip ? "Remove VIP" : "Grant VIP"}
                onClick={() => update.mutate({ is_vip: !selected.is_vip })}
              />
              <ActionBtn
                icon={Ban}
                label={selected.status === "banned" ? "Unban user" : "Ban user"}
                danger
                onClick={() => update.mutate({ status: selected.status === "banned" ? "active" : "banned" })}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ActionBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Coins; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${danger ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border bg-card"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
