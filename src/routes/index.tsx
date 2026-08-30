import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { DailySpinPopup } from "@/components/DailySpinPopup";
import { MiniGamesFloatingButton } from "@/components/MiniGamesFloatingButton";
import { SupportFloatingButton } from "@/components/SupportFloatingButton";
import { DiscoverRankings } from "@/components/discover/DiscoverRankings";
import { RoomRecoveryCard } from "@/components/room/RoomRecoveryCard";
import { ShareSheet } from "@/components/ShareSheet";
import { Search, Radio, Users, Bell, MoreVertical } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

type Room = {
  id: string;
  title: string;
  cover_url: string | null;
  room_type: "voice" | "video";
  viewer_count: number;
  seat_count: number;
  is_locked: boolean;
  pk_battle: boolean | null;
  host_id: string;
  host: { username: string | null; avatar: string | null } | null;
};

type LiveUser = { id: string; username: string | null; avatar: string | null };
type SearchUser = { id: string; username: string | null; full_name: string | null; avatar: string | null; user_code: string | null };

function Home() {
  const { user, profile, loading } = useAuth();
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("splash_shown")) navigate({ to: "/splash", replace: true });
    } catch {}
  }, [navigate]);

  useRealtimeInvalidate("home-live", [
    { table: "live_rooms", invalidate: [["home-rooms"], ["home-live-users"]] },
    { table: "banners", invalidate: [["home-banners"]] },
  ]);

  const liveUsers = useQuery({
    queryKey: ["home-live-users"],
    queryFn: async () => {
      const since = new Date(Date.now() - 120000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .gte("last_seen", since)
        .order("last_seen", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LiveUser[];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const rooms = useQuery({
    queryKey: ["home-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select("id,title,cover_url,room_type,viewer_count,seat_count,is_locked,pk_battle,host_id,host:profiles!live_rooms_host_id_fkey(username,avatar)")
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as Room[];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const searchUsers = useQuery({
    queryKey: ["home-user-search", query.trim()],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const safe = query.trim().replace(/[,()%*.\\"']/g, " ").trim();
      if (safe.length < 2) return [] as SearchUser[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar,user_code")
        .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%,user_code.ilike.%${safe}%`)
        .limit(12);
      if (error) throw error;
      return (data ?? []) as SearchUser[];
    },
  });

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms.data ?? [];
    return (rooms.data ?? []).filter((room) =>
      room.title.toLowerCase().includes(q) || (room.host?.username ?? "").toLowerCase().includes(q),
    );
  }, [rooms.data, query]);

  return (
    <>
      <div className="min-h-[100dvh] pb-28">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
            <Link to={user ? "/me" : "/auth"} aria-label="Profile" className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-background">
              {profile?.avatar ? <img src={profile.avatar} alt={profile.username ?? "Profile"} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bg-card text-xs font-bold">J</div>}
            </Link>
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people or rooms" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div className="flex items-center gap-1">
              <Link to="/notifications" aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5">
                <Bell className="h-5 w-5" />
                {!!user && (unread.data ?? 0) > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] font-bold text-white">{unread.data! > 99 ? "99+" : unread.data}</span>}
              </Link>
              <button type="button" onClick={() => setMenuOpen(true)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5"><MoreVertical className="h-5 w-5" /></button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md">
          <RoomRecoveryCard />

          {query.trim().length >= 2 && (
            <section className="px-4 pt-3 space-y-2">
              {(searchUsers.data ?? []).map((u) => (
                <Link key={u.id} to="/u/$userId" params={{ userId: u.id }} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-card">{u.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xs font-bold">{(u.username ?? "?").charAt(0).toUpperCase()}</span>}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{u.full_name ?? u.username ?? "User"}</p><p className="truncate text-[11px] text-muted-foreground">{u.username ?? "user"}{u.user_code ? ` · ID ${u.user_code}` : ""}</p></div>
                </Link>
              ))}
            </section>
          )}

          <section className="mt-5">
            <div className="flex items-center justify-between px-4"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Live now</p><span className="text-[10px] font-bold">{liveUsers.data?.length ?? 0} online</span></div>
            <div className="mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
              {(liveUsers.data ?? []).map((u) => <Link key={u.id} to="/u/$userId" params={{ userId: u.id }} className="flex w-16 shrink-0 flex-col items-center gap-1"><span className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-primary/50">{u.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-card text-sm font-bold">{(u.username ?? "?").charAt(0).toUpperCase()}</span>}</span><span className="w-full truncate text-center text-[10px]">{u.username ?? "user"}</span></Link>)}
            </div>
          </section>

          <section className="mt-5 px-4"><DiscoverRankings /></section>

          <section className="mt-5 space-y-3 px-4">
            <div className="flex items-center gap-2"><Radio className="h-4 w-4" /><h2 className="text-xs font-black uppercase tracking-wider">Live Rooms</h2><span className="ml-auto text-[10px] text-muted-foreground">{filteredRooms.length}</span></div>
            {rooms.isLoading ? <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-3xl bg-white/5" />)}</div> : filteredRooms.length ? <div className="space-y-2">{filteredRooms.map((room) => <Link key={room.id} to="/room/$roomId" params={{ roomId: room.id }} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><div className="h-16 w-16 overflow-hidden rounded-xl bg-card">{room.cover_url ? <img src={room.cover_url} alt="" className="h-full w-full object-cover" /> : <Radio className="m-5 h-6 w-6" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{room.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{room.host?.username ?? "Host"} · {room.viewer_count} viewers · {room.seat_count} seats</p></div>{room.is_locked && <span className="text-[10px] font-bold">LOCKED</span>}</Link>)}</div> : <div className="rounded-2xl border border-white/10 p-6 text-center text-sm text-muted-foreground">No live rooms right now.</div>}
          </section>
        </main>
      </div>
      <BottomNav />
      <DailySpinPopup />
      <MiniGamesFloatingButton />
      <SupportFloatingButton />
      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} />
      {menuOpen && <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setMenuOpen(false)}><div className="absolute right-4 top-16 w-48 rounded-2xl border border-white/10 bg-background p-2" onClick={(e) => e.stopPropagation()}><Link to="/settings" className="block rounded-xl p-3 text-sm">Settings</Link><button type="button" className="w-full rounded-xl p-3 text-left text-sm" onClick={() => { setShareOpen(true); setMenuOpen(false); }}>Share</button></div></div>}
    </>
  );
}
