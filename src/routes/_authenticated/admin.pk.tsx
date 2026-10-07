import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pk")({
  component: PkAdmin,
});

type Match = {
  id: string;
  host_a: string;
  host_b: string;
  room_a: string;
  room_b: string;
  duration_sec: number;
  started_at: string;
  ends_at: string;
  ended_at: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  status: string;
};

function PkAdmin() {
  const qc = useQueryClient();

  const matches = useQuery({
    queryKey: ["admin-pk-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pk_matches")
        .select("id,host_a,host_b,room_a,room_b,duration_sec,started_at,ends_at,ended_at,score_a,score_b,winner_id,status")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Match[];
    },
    refetchInterval: (query) => query.state.data?.some((match) => match.status === "active") ? 5000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-pk-matches-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pk_matches" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin-pk-matches"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  const endMatch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("pk_end_match", { _match_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PK match ended");
      qc.invalidateQueries({ queryKey: ["admin-pk-matches"] });
    },
    onError: (e: Error) => toast.error(e.message || "Unable to end PK"),
  });

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="PK Management"
        subtitle="Monitor active and recent PK matches"
      />

      {matches.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card/50 p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : matches.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          Unable to load PK matches.
        </div>
      ) : matches.data?.length ? (
        <div className="space-y-2">
          {matches.data.map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-card/50 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Swords className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black uppercase">{m.status}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                      {Math.round(m.duration_sec / 60)} min
                    </span>
                  </div>
                  <p className="mt-1 break-all text-[10px] text-muted-foreground">
                    {m.host_a} vs {m.host_b}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {Number(m.score_a).toLocaleString()} — {Number(m.score_b).toLocaleString()}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Started {new Date(m.started_at).toLocaleString()}
                  </p>
                </div>
                {m.status === "active" && (
                  <button
                    type="button"
                    disabled={endMatch.isPending}
                    onClick={() => endMatch.mutate(m.id)}
                    className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-400 disabled:opacity-50"
                  >
                    End PK
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          No PK matches found.
        </div>
      )}
    </div>
  );
}
