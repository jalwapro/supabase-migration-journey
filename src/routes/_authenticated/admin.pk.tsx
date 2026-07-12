import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Swords, Trophy, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pk")({
  component: PkAdmin,
});

type PK = {
  id: string;
  room_id: string | null;
  room_title: string;
  host_id: string;
  my_score: number;
  opponent_name: string;
  opponent_score: number;
  result: string;
  started_at: string;
  ended_at: string;
};

type Champion = {
  id: string;
  host_id: string;
  wins_total: number;
  reached_at: string;
  approved: boolean;
  banner_expires_at: string | null;
  host?: { username: string | null; avatar: string | null } | null;
};

function PkAdmin() {
  const qc = useQueryClient();

  const champs = useQuery({
    queryKey: ["admin_pk_champions"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pk_champions")
        .select(
          "id,host_id,wins_total,reached_at,approved,banner_expires_at,host:profiles!pk_champions_host_id_fkey(username,avatar)",
        )
        .order("approved", { ascending: true })
        .order("reached_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Champion[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("pk_champion_approve", { _champion_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner live for 24 hours on home");
      qc.invalidateQueries({ queryKey: ["admin_pk_champions"] });
      qc.invalidateQueries({ queryKey: ["banners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("pk_champion_reject", { _champion_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.message("Rejected");
      qc.invalidateQueries({ queryKey: ["admin_pk_champions"] });
    },
  });

  const list = useQuery({
    queryKey: ["admin_pk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pk_battles")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as PK[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pk_battles").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: "pk_delete", target: id });
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin_pk"] });
    },
  });

  const pending = (champs.data ?? []).filter((c) => !c.approved);
  const approved = (champs.data ?? []).filter((c) => c.approved).slice(0, 10);

  return (
    <>
      <AdminPageHeader title="PK Management" subtitle="Champion approvals + battle history" />

      <div className="mb-6">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold)]">
          <Trophy className="h-3.5 w-3.5" /> Champion Approvals ({pending.length})
        </p>
        {champs.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!champs.isLoading && pending.length === 0 && (
          <p className="rounded-2xl bg-white/5 p-4 text-center text-xs text-muted-foreground">
            No pending champions. Hosts land here after every 10 PK wins.
          </p>
        )}
        <div className="space-y-2">
          {pending.map((c) => (
            <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--gold)]/30 to-[color:var(--destructive)]/30">
                {c.host?.avatar ? (
                  <img src={c.host.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Trophy className="h-5 w-5 text-[color:var(--gold)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">@{c.host?.username ?? "host"}</p>
                <p className="text-[11px] text-muted-foreground">
                  🏆 {c.wins_total} PK wins · {new Date(c.reached_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => approve.mutate(c.id)}
                disabled={approve.isPending}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--destructive)] px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
              >
                <Check className="h-3 w-3" /> Approve 24h Banner
              </button>
              <button
                onClick={() => reject.mutate(c.id)}
                disabled={reject.isPending}
                className="rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {approved.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Recent approved
            </p>
            <div className="space-y-1.5">
              {approved.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-[11px]">
                  <Trophy className="h-3 w-3 text-[color:var(--gold)]" />
                  <span className="font-bold">@{c.host?.username ?? "host"}</span>
                  <span className="text-muted-foreground">· {c.wins_total} wins</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {c.banner_expires_at && new Date(c.banner_expires_at) > new Date()
                      ? `Live · expires ${new Date(c.banner_expires_at).toLocaleString()}`
                      : "Expired / rejected"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        <Swords className="h-3.5 w-3.5" /> Battle History
      </p>
      {list.isLoading ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((b) => (
            <div key={b.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
                <Swords className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{b.room_title}</p>
                <p className="text-[11px] text-muted-foreground">
                  You {b.my_score.toLocaleString()} vs {b.opponent_name}{" "}
                  {b.opponent_score.toLocaleString()} · {new Date(b.started_at).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  b.result === "win"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : b.result === "loss"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-white/10 text-muted-foreground"
                }`}
              >
                {b.result.toUpperCase()}
              </span>
              <button
                onClick={() => confirm("Delete battle log?") && remove.mutate(b.id)}
                className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-400"
              >
                Delete
              </button>
            </div>
          ))}
          {list.data?.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">No PK battles</p>
          )}
        </div>
      )}
    </>
  );
}
