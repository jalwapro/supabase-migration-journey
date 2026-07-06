import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Radio, Users, Lock, Video, Mic } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

type Category = { id: string; name: string; slug: string; icon: string | null };
type Banner = { id: string; title: string | null; image_url: string; link_url: string | null };
type Room = {
  id: string;
  title: string;
  cover_url: string | null;
  category_id: string | null;
  room_type: "voice" | "video";
  viewer_count: number;
  seat_count: number;
  is_locked: boolean;
  host_id: string;
  host: { username: string | null; avatar: string | null } | null;
};

function Home() {
  const { user } = useAuth();
  const [activeCat, setActiveCat] = useState<string>("foryou");

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,icon")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const banners = useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("id,title,image_url,link_url")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Banner[];
    },
  });

  const catId =
    activeCat === "foryou"
      ? null
      : cats.data?.find((c) => c.slug === activeCat)?.id ?? null;

  const rooms = useQuery({
    queryKey: ["rooms", activeCat, catId],
    queryFn: async () => {
      let q = supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,category_id,room_type,viewer_count,seat_count,is_locked,host_id,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .limit(30);
      if (catId) q = q.eq("category_id", catId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Room[];
    },
  });

  return (
    <>
      <AppShell
        title="Jalwa"
        subtitle="Create · Share · Shine"
        right={
          !user && (
            <Link
              to="/auth"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          )
        }
      >
        {/* Banners */}
        <section className="px-4 pt-3">
          {banners.data && banners.data.length > 0 ? (
            <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
              {banners.data.map((b) => (
                <a
                  key={b.id}
                  href={b.link_url ?? "#"}
                  className="relative aspect-[16/7] w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl border border-border"
                >
                  <img
                    src={b.image_url}
                    alt={b.title ?? ""}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[color:var(--gold)]/30 via-[color:var(--primary)]/40 to-[color:var(--secondary)]/40 p-5">
              <div className="flex h-full flex-col justify-between">
                <span className="w-fit rounded-full bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                  Welcome
                </span>
                <div>
                  <h2 className="text-2xl font-black leading-tight">
                    Go live. Get gifts.
                    <br />
                    Shine bright.
                  </h2>
                  <p className="mt-1 text-xs text-foreground/70">
                    Host a voice or video party in seconds.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Categories */}
        <section className="mt-4">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
            {(cats.data ?? []).map((c) => {
              const active = activeCat === c.slug;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.slug)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                      : "border border-border bg-card/60 text-foreground/80"
                  }`}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Rooms grid */}
        <section className="mt-4 px-4">
          {rooms.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-2xl bg-card/60"
                />
              ))}
            </div>
          ) : rooms.data && rooms.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {rooms.data.map((r) => (
                <RoomCard key={r.id} room={r} />
              ))}
            </div>
          ) : (
            <EmptyRooms />
          )}
        </section>
      </AppShell>
      <BottomNav />
    </>
  );
}

function RoomCard({ room }: { room: Room }) {
  const TypeIcon = room.room_type === "video" ? Video : Mic;
  return (
    <Link
      to="/room/$roomId"
      params={{ roomId: room.id }}
      className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card"
    >
      {room.cover_url ? (
        <img
          src={room.cover_url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[color:var(--secondary)]/60 to-[color:var(--primary)]/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/90 px-2 py-0.5 text-[10px] font-bold uppercase">
        <Radio className="h-2.5 w-2.5" />
        Live
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold">
        <Users className="h-2.5 w-2.5" />
        {room.viewer_count}
      </div>
      {room.is_locked && (
        <div className="absolute right-2 bottom-2 grid h-6 w-6 place-items-center rounded-full bg-black/60">
          <Lock className="h-3 w-3" />
        </div>
      )}
      <div className="absolute inset-x-2 bottom-2">
        <div className="flex items-center gap-1 text-[10px] text-white/80">
          <TypeIcon className="h-3 w-3" />
          <span className="truncate">@{room.host?.username ?? "host"}</span>
        </div>
        <h3 className="mt-0.5 line-clamp-2 text-xs font-bold text-white">
          {room.title}
        </h3>
      </div>
    </Link>
  );
}

function EmptyRooms() {
  return (
    <div className="glass mt-2 rounded-2xl p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--primary)]/20">
        <Radio className="h-6 w-6 text-[color:var(--primary)]" />
      </div>
      <h3 className="mt-3 font-bold">No live rooms yet</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Be the first to go live and start the party.
      </p>
      <Link
        to="/create-room"
        className="mt-4 inline-flex rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-5 py-2 text-xs font-bold text-primary-foreground"
      >
        Go Live
      </Link>
    </div>
  );
}
