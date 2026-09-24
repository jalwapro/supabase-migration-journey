import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Users, Mic, Video, Flame, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/room-frames-preview")({
  component: RoomFramesPreview,
});

type Tab = "voice" | "video" | "pk";

type TopFrameRow = {
  slot: 1 | 2;
  name: string;
  media_url: string;
  media_type: "png" | "svga" | "mp4" | "webm" | "gif";
  chromakey: "none" | "green" | "black" | "luma";
};

type Room = {
  id: string;
  title: string;
  cover_url: string | null;
  room_type: "voice" | "video";
  viewer_count: number;
  pk_battle: boolean | null;
  host_id: string;
  host: { username: string | null; avatar: string | null } | null;
  coin_score?: number;
};

function useActiveFrames() {
  return useQuery({
    queryKey: ["admin-room-frames-preview-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_top_frames")
        .select("slot,name,media_url,media_type,chromakey")
        .in("slot", [1, 2])
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<1 | 2, TopFrameRow | null> = { 1: null, 2: null };
      for (const r of (data ?? []) as TopFrameRow[]) map[r.slot] = r;
      return map;
    },
    staleTime: 10_000,
  });
}

function useTopLiveRooms(tab: Tab) {
  return useQuery({
    queryKey: ["admin-room-frames-preview-rooms", tab],
    queryFn: async () => {
      let sel = supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,room_type,viewer_count,pk_battle,host_id,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .limit(10);
      if (tab === "pk") sel = sel.eq("pk_battle", true);
      else sel = sel.eq("room_type", tab);
      const { data, error } = await sel;
      if (error) throw error;
      const list = (data ?? []) as unknown as Room[];
      if (list.length === 0) return list;
      const { data: pop } = await supabase
        .from("room_popularity")
        .select("room_id,coin_score")
        .in("room_id", list.map((r) => r.id));
      const score = new Map<string, number>(
        (pop ?? []).map((p: { room_id: string; coin_score: number | string }) => [
          p.room_id,
          Number(p.coin_score ?? 0),
        ]),
      );
      return list
        .map((r) => ({ ...r, coin_score: score.get(r.id) ?? 0 }))
        .sort(
          (a, b) =>
            (b.coin_score ?? 0) - (a.coin_score ?? 0) || b.viewer_count - a.viewer_count,
        )
        .slice(0, 2);
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

/** Mirrors the Home page frame renderer exactly (same classes + filters). */
function FrameOverlay({ row, tone }: { row: TopFrameRow | null; tone: "gold" | "violet" }) {
  if (!row) return null;
  const isVideo = row.media_type === "mp4" || row.media_type === "webm";
  const ck = row.chromakey;
  const filter =
    ck === "green" || ck === "luma" || (isVideo && ck !== "none")
      ? "url(#preview-frame-green-key)"
      : ck === "black"
        ? "url(#preview-frame-luma-key)"
        : undefined;
  const cls =
    "pointer-events-none absolute -inset-[7%] h-[114%] w-[114%] max-w-none object-contain select-none z-30";
  return isVideo ? (
    <video src={row.media_url} autoPlay loop muted playsInline aria-hidden style={{ filter }} className={cls} />
  ) : (
    <img src={row.media_url} alt="" aria-hidden style={{ filter }} className={cls} />
  );
}

function PreviewCard({
  room,
  frame,
  tone,
}: {
  room: Room;
  frame: TopFrameRow | null;
  tone: "gold" | "violet";
}) {
  const TypeIcon = room.room_type === "video" ? Video : Mic;
  const glow =
    tone === "gold"
      ? "shadow-[0_10px_30px_-6px_rgba(251,191,36,0.55)]"
      : "shadow-[0_10px_30px_-6px_rgba(168,85,247,0.55)]";
  const cover = room.cover_url ?? room.host?.avatar ?? null;
  return (
    <div className="relative aspect-square">
      <FrameOverlay row={frame} tone={tone} />
      <Link
        to="/room/$roomId"
        params={{ roomId: room.id }}
        className={`group absolute inset-0 overflow-hidden rounded-3xl border border-white/10 bg-card ${glow}`}
      >
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[color:var(--secondary)]/70 via-[color:var(--primary)]/50 to-[color:var(--gold)]/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </div>
        {room.pk_battle && (
          <div className="absolute left-2 top-9 flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-2 py-0.5 text-[10px] font-black uppercase text-black">
            <Flame className="h-2.5 w-2.5" /> PK
          </div>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
          <Users className="h-2.5 w-2.5" />
          {room.viewer_count}
        </div>
        <div className="absolute inset-x-2 bottom-2">
          <p className="truncate text-xs font-bold text-white">{room.title}</p>
          <p className="flex items-center gap-1 truncate text-[10px] text-white/70">
            <TypeIcon className="h-2.5 w-2.5" />
            {room.host?.username ?? "Host"} · {room.coin_score ?? 0} coins
          </p>
        </div>
      </Link>
    </div>
  );
}

function PreviewFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="preview-frame-green-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0 0.08" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="3.8" intercept="-0.08" />
          </feComponentTransfer>
        </filter>
        <filter id="preview-frame-luma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="5.2" intercept="-0.48" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

function RoomFramesPreview() {
  const [tab, setTab] = useState<Tab>("voice");
  const frames = useActiveFrames();
  const rooms = useTopLiveRooms(tab);
  const list = rooms.data ?? [];

  return (
    <>
      <AdminPageHeader
        title="Room Rank Frames — Live Preview"
        subtitle="Exactly how the top-1 / top-2 frames render over real live (Zego-connected) rooms on Home."
      />
      <PreviewFilters />

      <div className="mb-4 flex items-center gap-2">
        {(["voice", "video", "pk"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              tab === t
                ? "bg-[color:var(--gold)] text-black"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => {
            void frames.refetch();
            void rooms.refetch();
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${rooms.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {([1, 2] as const).map((slot) => {
          const f = frames.data?.[slot];
          return (
            <div key={slot} className="glass rounded-xl border border-border p-3 text-xs">
              <p className="font-bold">
                Slot {slot} — {slot === 1 ? "1st place (gold)" : "2nd place (violet)"}
              </p>
              {f ? (
                <p className="mt-1 text-muted-foreground">
                  {f.name} · {f.media_type.toUpperCase()} · chromakey: {f.chromakey}
                </p>
              ) : (
                <p className="mt-1 text-[color:var(--destructive)]">
                  No active frame assigned — Home shows the built-in fallback.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {rooms.isLoading ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="glass rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No live {tab} rooms right now. Start a room to preview the frames over real data.
        </div>
      ) : (
        <div className="mx-auto grid max-w-[460px] grid-cols-2 gap-5 px-3 py-4">
          {list.map((r, i) => (
            <PreviewCard
              key={r.id}
              room={r}
              tone={i === 0 ? "gold" : "violet"}
              frame={frames.data?.[i === 0 ? 1 : 2] ?? null}
            />
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link to="/admin/room-frames" className="text-xs font-bold text-[color:var(--gold)] underline">
          Manage Room Rank Frames
        </Link>
      </div>
    </>
  );
}
