import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Radio, Users, Eye, X, Mic, Video } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/live")({
  component: LiveAdmin,
});

type Live = {
  id: string;
  title: string;
  room_type: "voice" | "video";
  cover_url: string | null;
  viewer_count: number;
  seat_count: number;
  host_id: string;
  created_at: string;
  host: { username: string | null; avatar: string | null } | null;
};

function LiveAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select(
          "id,title,room_type,cover_url,viewer_count,seat_count,host_id,created_at,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Live[];
    },
    refetchInterval: 10_000,
  });

  const endLive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("live_rooms")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room ended");
      qc.invalidateQueries({ queryKey: ["admin_live"] });
      qc.invalidateQueries({ queryKey: ["admin_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = list.data?.length ?? 0;
  const viewers = list.data?.reduce((s, r) => s + (r.viewer_count ?? 0), 0) ?? 0;
  const voice = list.data?.filter((r) => r.room_type === "voice").length ?? 0;
  const video = list.data?.filter((r) => r.room_type === "video").length ?? 0;

  return (
    <>
      <AdminPageHeader title="Live Management" subtitle="Currently broadcasting voice & video rooms" />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Live rooms" value={total} />
        <Stat label="Concurrent viewers" value={viewers} />
        <Stat label="Voice rooms" value={voice} />
        <Stat label="Video rooms" value={video} />
      </div>
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => {
            const TypeIcon = r.room_type === "video" ? Video : Mic;
            return (
              <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-card">
                  {r.cover_url ? <img src={r.cover_url} className="h-full w-full object-cover" alt="" /> : <Radio className="h-4 w-4 text-red-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <TypeIcon className="mr-1 inline h-3 w-3" />
                    {r.room_type} · @{r.host?.username ?? "host"} · started {new Date(r.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">LIVE</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold"><Users className="h-3 w-3" /> {r.viewer_count}</span>
                <Link
                  to="/room/$roomId"
                  params={{ roomId: r.id }}
                  className="rounded-full bg-primary/15 p-1.5 text-primary"
                  title="Monitor"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => confirm("End this live room?") && endLive.mutate(r.id)}
                  className="rounded-full bg-red-500/15 p-1.5 text-red-400"
                  title="End live"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No one is live right now</p>}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
