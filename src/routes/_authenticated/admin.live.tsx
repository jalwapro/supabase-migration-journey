import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Radio, Users, Eye, X, Mic, Video, Crown, Gift, MessageCircle, Megaphone, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
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
  coin_score: number;
  host: { username: string | null; avatar: string | null } | null;
};

function LiveAdmin() {
  const qc = useQueryClient();
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const list = useQuery({
    queryKey: ["admin_live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select(
          "id,title,room_type,cover_url,viewer_count,seat_count,host_id,created_at,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Live[];
      const ids = rows.map((r) => r.id);
      let scoreMap = new Map<string, number>();
      if (ids.length) {
        const { data: pop } = await supabase
          .from("room_popularity")
          .select("room_id,coin_score")
          .in("room_id", ids);
        (pop ?? []).forEach((p: any) => scoreMap.set(p.room_id, Number(p.coin_score ?? 0)));
      }
      rows.forEach((r) => (r.coin_score = scoreMap.get(r.id) ?? 0));
      rows.sort((a, b) =>
        (b.coin_score - a.coin_score) ||
        ((b.viewer_count ?? 0) - (a.viewer_count ?? 0)) ||
        (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
      return rows;
    },
    refetchInterval: 10_000,
  });

  const topRoom = list.data?.[0] ?? null;

  // Auto-pin the top room into the monitor as soon as we know who it is.
  useEffect(() => {
    if (!monitorId && topRoom) setMonitorId(topRoom.id);
  }, [monitorId, topRoom]);

  // If the currently monitored room drops off the live list, unpin it.
  useEffect(() => {
    if (!monitorId || !list.data) return;
    if (!list.data.some((r) => r.id === monitorId)) setMonitorId(null);
  }, [monitorId, list.data]);

  const monitorRoom = useMemo(
    () => list.data?.find((r) => r.id === monitorId) ?? null,
    [list.data, monitorId],
  );

  const endLive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_end_room", { _room_id: id, _reason: "admin panel" });
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      toast.success("Room ended");
      if (monitorId === id) setMonitorId(null);
      qc.invalidateQueries({ queryKey: ["admin_live"] });
      qc.invalidateQueries({ queryKey: ["admin_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to end room"),
  });

  const total = list.data?.length ?? 0;
  const viewers = list.data?.reduce((s, r) => s + (r.viewer_count ?? 0), 0) ?? 0;
  const voice = list.data?.filter((r) => r.room_type === "voice").length ?? 0;
  const video = list.data?.filter((r) => r.room_type === "video").length ?? 0;

  return (
    <>
      <AdminPageHeader title="Live Management" subtitle="Monitor, moderate & appreciate live rooms without leaving the panel" />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Live rooms" value={total} />
        <Stat label="Concurrent viewers" value={viewers} />
        <Stat label="Voice rooms" value={voice} />
        <Stat label="Video rooms" value={video} />
      </div>

      {/* Embedded monitor — top room auto-pinned; click any Eye to swap */}
      {monitorRoom && (
        <div className={`glass mb-4 overflow-hidden rounded-2xl border border-primary/30 ${expanded ? "fixed inset-2 z-[80]" : "relative"}`}>
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-2">
            <Crown className="h-4 w-4 text-yellow-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black uppercase tracking-wider">
                Monitoring · {monitorRoom.title}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                @{monitorRoom.host?.username ?? "host"} · 🪙 {monitorRoom.coin_score.toLocaleString()} · 👥 {monitorRoom.viewer_count}
              </p>
            </div>
            <Link
              to="/u/$userId"
              params={{ userId: monitorRoom.host_id }}
              className="rounded-full bg-primary/20 p-1.5 text-primary"
              title="Open host profile (gift / message / appreciate)"
            >
              <Gift className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full bg-white/10 p-1.5"
              title={expanded ? "Restore" : "Expand"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <a
              href={`/room/${monitorRoom.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/10 p-1.5"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => setMonitorId(null)}
              className="rounded-full bg-red-500/20 p-1.5 text-red-300"
              title="Close monitor"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <iframe
            key={monitorRoom.id}
            src={`/room/${monitorRoom.id}?adminMonitor=1`}
            title={`Room ${monitorRoom.id}`}
            className={`w-full bg-black ${expanded ? "h-[calc(100%-44px)]" : "h-[560px]"}`}
            allow="autoplay; microphone; camera; clipboard-write"
          />
          <div className="flex flex-wrap gap-1.5 border-t border-white/10 bg-black/40 px-3 py-2">
            <Link
              to="/u/$userId"
              params={{ userId: monitorRoom.host_id }}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary"
            >
              <Gift className="h-3 w-3" /> Gift host
            </Link>
            <Link
              to="/chat/$userId"
              params={{ userId: monitorRoom.host_id }}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold"
            >
              <MessageCircle className="h-3 w-3" /> Message
            </Link>
            <Link
              to="/admin/notifications"
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold"
            >
              <Megaphone className="h-3 w-3" /> Announcement
            </Link>
            <button
              onClick={() => confirm(`End "${monitorRoom.title}"?`) && endLive.mutate(monitorRoom.id)}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-300"
            >
              <X className="h-3 w-3" /> Force end
            </button>
          </div>
        </div>
      )}

      {list.isLoading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((r, i) => {
            const TypeIcon = r.room_type === "video" ? Video : Mic;
            const isTop = i === 0;
            const isMonitor = r.id === monitorId;
            return (
              <div
                key={r.id}
                className={`glass flex items-center gap-3 rounded-2xl p-3 ${isTop ? "ring-2 ring-yellow-400/60" : ""} ${isMonitor ? "bg-primary/5" : ""}`}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-card">
                  {r.cover_url ? <img src={r.cover_url} className="h-full w-full object-cover" alt="" /> : <Radio className="h-4 w-4 text-red-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-bold">
                    {isTop && <Crown className="h-3 w-3 shrink-0 text-yellow-400" />}
                    {r.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <TypeIcon className="mr-1 inline h-3 w-3" />
                    {r.room_type} · @{r.host?.username ?? "host"} · 🪙 {r.coin_score.toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">LIVE</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold"><Users className="h-3 w-3" /> {r.viewer_count}</span>
                <button
                  onClick={() => setMonitorId(r.id)}
                  className={`rounded-full p-1.5 ${isMonitor ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}
                  title="Monitor inside admin panel"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => confirm("End this live room?") && endLive.mutate(r.id)}
                  disabled={endLive.isPending}
                  className="rounded-full bg-red-500/15 p-1.5 text-red-400 disabled:opacity-50"
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
