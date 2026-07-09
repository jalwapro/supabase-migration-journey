import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DoorOpen, X, Loader2, Trash2, Eye, Mic, Video } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/rooms")({
  component: RoomsAdmin,
});

type Room = {
  id: string;
  title: string;
  room_type: "voice" | "video";
  cover_url: string | null;
  status: "live" | "ended" | string;
  viewer_count: number;
  seat_count: number;
  host_id: string;
  is_locked: boolean;
  created_at: string;
  ended_at: string | null;
  host: { username: string | null; avatar: string | null } | null;
};

function RoomsAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");

  const list = useQuery({
    queryKey: ["admin_rooms", filter],
    queryFn: async () => {
      let q = supabase
        .from("live_rooms")
        .select(
          "id,title,room_type,cover_url,status,viewer_count,seat_count,host_id,is_locked,created_at,ended_at,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Room[];
    },
    refetchInterval: 15_000,
  });

  const endLive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("live_rooms")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      const { error: logErr } = await supabase
        .from("admin_logs")
        .insert({ action: "force_end_room", target: id });
      if (logErr) console.warn("[admin_logs]", logErr.message);
    },
    onSuccess: () => {
      toast.success("Room ended");
      qc.invalidateQueries({ queryKey: ["admin_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("live_rooms").delete().eq("id", id);
      if (error) throw error;
      const { error: logErr } = await supabase
        .from("admin_logs")
        .insert({ action: "delete_room", target: id });
      if (logErr) console.warn("[admin_logs]", logErr.message);
    },
    onSuccess: () => {
      toast.success("Room deleted");
      qc.invalidateQueries({ queryKey: ["admin_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Rooms"
        subtitle="All voice & video rooms — monitor, end live, delete"
        right={
          <div className="flex gap-1 rounded-full bg-card/60 p-1 text-[11px] font-bold">
            {(["all", "live", "ended"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 uppercase tracking-wider ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {k}
              </button>
            ))}
          </div>
        }
      />
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => {
            const TypeIcon = r.room_type === "video" ? Video : Mic;
            const isLive = r.status === "live";
            return (
              <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-card">
                  {r.cover_url ? <img src={r.cover_url} alt="" className="h-full w-full object-cover" /> : <DoorOpen className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <TypeIcon className="mr-1 inline h-3 w-3" />
                    {r.room_type} · @{r.host?.username ?? "host"} · {r.viewer_count} viewers · {r.seat_count} seats
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isLive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-muted-foreground"}`}>
                  {isLive ? "LIVE" : (r.status ?? "OFF").toUpperCase()}
                </span>
                {isLive && (
                  <Link
                    to="/room/$roomId"
                    params={{ roomId: r.id }}
                    className="rounded-full bg-primary/15 p-1.5 text-primary"
                    title="Monitor room"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                )}
                {isLive && (
                  <button
                    onClick={() => confirm("End this live room?") && endLive.mutate(r.id)}
                    className="rounded-full bg-amber-500/15 p-1.5 text-amber-400"
                    title="End live"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => confirm("Delete this room permanently?") && del.mutate(r.id)}
                  className="rounded-full bg-red-500/15 p-1.5 text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No rooms yet</p>}
        </div>
      )}
    </>
  );
}
