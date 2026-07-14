import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Radio, Users, Mic, Video } from "lucide-react";


export const Route = createFileRoute("/rooms")({
  component: RoomsPage,
});

type Room = {
  id: string;
  title: string;
  cover_url: string | null;
  room_type: "voice" | "video";
  viewer_count: number;
  is_locked: boolean;
  host: { username: string | null; avatar: string | null } | null;
  coin_score?: number;
};

const RANK_THRESHOLD = 300_000;

function RoomsPage() {
  useRealtimeInvalidate("rooms-list-live", [
    { table: "live_rooms", invalidate: [["rooms", "all"]] },
    { table: "gift_sends", invalidate: [["rooms", "all"]] },
  ]);
  const rooms = useQuery({
    queryKey: ["rooms", "all"],
    queryFn: async () => {
      // SCALE FIX: server-side pre-joined + ranked + paginated list.
      // Removes: 200-row fetch + second popularity query + client-side sort.
      const { data, error } = await supabase.rpc("list_live_rooms_ranked", {
        _limit: 60,
        _offset: 0,
      });
      if (error) throw error;
      return (data ?? []).map((r: {
        id: string; title: string; cover_url: string | null;
        room_type: string; viewer_count: number; is_locked: boolean;
        host_username: string | null; host_avatar: string | null;
        coin_score: number;
      }) => ({
        id: r.id,
        title: r.title,
        cover_url: r.cover_url,
        room_type: r.room_type as "voice" | "video",
        viewer_count: r.viewer_count,
        is_locked: r.is_locked,
        host: { username: r.host_username, avatar: r.host_avatar },
        coin_score: Number(r.coin_score ?? 0),
      })) as Room[];
    },
  });


  return (
    <>
      <AppShell title="Live Rooms" subtitle="Browse all live parties">
        <div className="px-4 pt-3">
          {rooms.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-card/60" />
              ))}
            </div>
          ) : rooms.data && rooms.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {rooms.data.map((r) => {
                const TypeIcon = r.room_type === "video" ? Video : Mic;
                return (
                  <Link
                    key={r.id}
                    to="/room/$roomId"
                    params={{ roomId: r.id }}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    {r.cover_url ? (
                      <img src={r.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[color:var(--secondary)]/60 to-[color:var(--primary)]/60" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/90 px-2 py-0.5 text-[10px] font-bold">
                      <Radio className="h-2.5 w-2.5" /> LIVE
                    </div>
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px]">
                      <Users className="h-2.5 w-2.5" /> {r.viewer_count}
                    </div>
                    {(r.coin_score ?? 0) >= RANK_THRESHOLD && (
                      <div className="absolute left-2 top-8 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-orange-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-lg">
                        🔥 Ranked
                      </div>
                    )}
                    <div className="absolute inset-x-2 bottom-2">
                      <div className="flex items-center gap-1 text-[10px] text-white/80">
                        <TypeIcon className="h-3 w-3" /> {r.host?.username ?? "host"}
                      </div>
                      <h3 className="line-clamp-2 text-xs font-bold text-white">{r.title}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="glass mt-4 rounded-2xl p-8 text-center">
              <Radio className="mx-auto h-8 w-8 text-[color:var(--primary)]" />
              <p className="mt-3 text-sm font-semibold">No live rooms right now</p>
              <Link
                to="/create-room"
                className="glow-4d mt-4 inline-flex rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-5 py-2 text-xs font-bold text-primary-foreground"
              >
                Start yours
              </Link>
            </div>
          )}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
