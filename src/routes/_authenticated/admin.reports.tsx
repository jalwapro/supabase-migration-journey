import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Flag, User as UserIcon, DoorOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsAdmin,
});

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  room_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

type ProfileLite = { id: string; username: string | null; avatar: string | null };
type RoomLite = { id: string; title: string | null };

function ReportsAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "resolved" | "dismissed">("pending");

  const list = useQuery({
    queryKey: ["admin_reports", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_reports")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    list.data?.forEach((r) => {
      if (r.reporter_id) s.add(r.reporter_id);
      if (r.reported_user_id) s.add(r.reported_user_id);
    });
    return Array.from(s);
  }, [list.data]);

  const roomIds = useMemo(
    () => Array.from(new Set((list.data ?? []).map((r) => r.room_id).filter((v): v is string => !!v))),
    [list.data],
  );

  const profiles = useQuery({
    queryKey: ["admin_reports_profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, ProfileLite>;
      const { data, error } = await supabase.from("profiles").select("id,username,avatar").in("id", userIds);
      if (error) throw error;
      const map: Record<string, ProfileLite> = {};
      (data ?? []).forEach((p: ProfileLite) => { map[p.id] = p; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const rooms = useQuery({
    queryKey: ["admin_reports_rooms", roomIds],
    queryFn: async () => {
      if (roomIds.length === 0) return {} as Record<string, RoomLite>;
      const { data, error } = await supabase.from("live_rooms").select("id,title").in("id", roomIds);
      if (error) throw error;
      const map: Record<string, RoomLite> = {};
      (data ?? []).forEach((r: RoomLite) => { map[r.id] = r; });
      return map;
    },
    enabled: roomIds.length > 0,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("user_reports").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("admin_logs").insert({ action: `report_${status}`, target: id });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin_reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = profiles.data?.[id];
    return p?.username ? `@${p.username}` : id.slice(0, 8);
  };
  const roomOf = (id: string | null | undefined) => {
    if (!id) return null;
    const r = rooms.data?.[id];
    return r?.title ?? id.slice(0, 8);
  };

  return (
    <>
      <AdminPageHeader title="Report Center" subtitle="User & room abuse reports" />
      <div className="mb-3 flex gap-2">
        {(["pending", "resolved", "dismissed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${tab === s ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r) => {
            const roomLabel = roomOf(r.room_id);
            return (
              <div key={r.id} className="glass rounded-2xl p-3">
                <div className="flex items-start gap-2">
                  <Flag className="mt-0.5 h-4 w-4 text-red-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.reason}</p>
                    {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-muted-foreground">
                        by {nameOf(r.reporter_id)}
                      </span>
                      {r.reported_user_id && (
                        <Link
                          to="/u/$userId"
                          params={{ userId: r.reported_user_id }}
                          className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-300 hover:bg-red-500/25"
                        >
                          <UserIcon className="h-3 w-3" /> {nameOf(r.reported_user_id)}
                        </Link>
                      )}
                      {r.room_id && roomLabel && (
                        <Link
                          to="/room/$roomId"
                          params={{ roomId: r.room_id }}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary hover:bg-primary/25"
                        >
                          <DoorOpen className="h-3 w-3" /> {roomLabel}
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {tab === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setStatus.mutate({ id: r.id, status: "resolved" })}
                      className="flex-1 rounded-full bg-emerald-500/20 py-1.5 text-xs font-bold text-emerald-400"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => setStatus.mutate({ id: r.id, status: "dismissed" })}
                      className="flex-1 rounded-full bg-white/10 py-1.5 text-xs font-bold text-muted-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {list.data?.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No reports</p>}
        </div>
      )}
    </>
  );
}
