import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Swords } from "lucide-react";
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

function PkAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_pk"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pk_battles").select("*").order("started_at", { ascending: false }).limit(150);
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

  return (
    <>
      <AdminPageHeader title="PK Management" subtitle="PK battle history & moderation" />
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
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
                  You {b.my_score.toLocaleString()} vs {b.opponent_name} {b.opponent_score.toLocaleString()} · {new Date(b.started_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.result === "win" ? "bg-emerald-500/20 text-emerald-400" : b.result === "loss" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-muted-foreground"}`}>
                {b.result.toUpperCase()}
              </span>
              <button onClick={() => confirm("Delete battle log?") && remove.mutate(b.id)} className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-400">Delete</button>
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No PK battles</p>}
        </div>
      )}
    </>
  );
}
