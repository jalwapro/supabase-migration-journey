import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Radio, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/live")({
  component: LiveAdmin,
});

type Live = {
  id: string;
  title: string;
  room_type: string;
  cover: string | null;
  viewers: number;
  seat_count: number;
  total_points: number;
  host_id: string;
  created_at: string;
};

function LiveAdmin() {
  const list = useQuery({
    queryKey: ["admin_live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_live", true)
        .order("viewers", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Live[];
    },
    refetchInterval: 15_000,
  });

  const total = list.data?.length ?? 0;
  const viewers = list.data?.reduce((s, r) => s + (r.viewers ?? 0), 0) ?? 0;
  const points = list.data?.reduce((s, r) => s + Number(r.total_points ?? 0), 0) ?? 0;

  return (
    <>
      <AdminPageHeader title="Live Management" subtitle="Currently broadcasting rooms" />
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Live rooms" value={total} />
        <Stat label="Concurrent viewers" value={viewers} />
        <Stat label="Gift points today" value={points} />
      </div>
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => (
            <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-card">
                {r.cover ? <img src={r.cover} className="h-full w-full object-cover" alt="" /> : <Radio className="h-4 w-4 text-red-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">{r.room_type} · started {new Date(r.created_at).toLocaleTimeString()}</p>
              </div>
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">LIVE</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold"><Users className="h-3 w-3" /> {r.viewers}</span>
            </div>
          ))}
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
