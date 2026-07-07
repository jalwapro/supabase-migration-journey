import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DoorOpen, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/rooms")({
  component: RoomsAdmin,
});

type Room = {
  id: string;
  title: string;
  room_type: string;
  category: string;
  cover: string | null;
  country: string | null;
  is_live: boolean;
  viewers: number;
  seat_count: number;
  total_points: number;
  host_id: string;
  created_at: string;
};

function RoomsAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").update({ is_live: false }).eq("id", id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: "force_close_room", target: id });
    },
    onSuccess: () => {
      toast.success("Room closed");
      qc.invalidateQueries({ queryKey: ["admin_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Rooms" subtitle="Live rooms directory & moderation" />
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => (
            <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-card">
                {r.cover ? <img src={r.cover} alt="" className="h-full w-full object-cover" /> : <DoorOpen className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {r.room_type} · {r.category} · {r.viewers} viewers · {r.total_points.toLocaleString()} pts
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.is_live ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-muted-foreground"}`}>
                {r.is_live ? "LIVE" : "OFF"}
              </span>
              {r.is_live && (
                <button
                  onClick={() => confirm("Force close this room?") && close.mutate(r.id)}
                  className="rounded-full bg-red-500/15 p-1.5 text-red-400"
                  title="Force close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No rooms yet</p>}
        </div>
      )}
    </>
  );
}
