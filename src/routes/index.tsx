import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
const jalwaLogo = "/__l5e/assets-v1/4d052932-1040-4825-a7d9-cbabb2b9707d/jalwa-logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Radio,
  Users,
  Lock,
  Video,
  Mic,
  Search,
  Shield,
  Wallet as WalletIcon,
  Swords,
  Flame,
  UserRound,
  MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

type Banner = { id: string; title: string | null; image_url: string; link_url: string | null };
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
type LiveUser = {
  id: string;
  username: string | null;
  avatar: string | null;
  frame: string | null;
  last_seen: string | null;
};
type SearchUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  user_code: string | null;
};

type TabKey = "video" | "voice" | "pk";
const TABS: { key: TabKey; label: string; Icon: typeof Video }[] = [
  { key: "video", label: "Video Room", Icon: Video },
  { key: "voice", label: "Voice Room", Icon: Mic },
  { key: "pk", label: "PK Battle", Icon: Swords },
];

function Home() {
  const { user, profile, isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>("video");
  const [q, setQ] = useState("");
  const [friendsOpen, setFriendsOpen] = useState(false);
  const query = q.trim();

  const friends = useQuery({
    queryKey: ["home-mutual-friends-online", user?.id],
    enabled: !!user?.id && friendsOpen,
    refetchInterval: friendsOpen ? 30_000 : false,
    queryFn: async () => {
      const uid = user!.id;
      const [{ data: outRows, error: e1 }, { data: inRows, error: e2 }] =
        await Promise.all([
          supabase.from("follows").select("following_id").eq("follower_id", uid),
          supabase.from("follows").select("follower_id").eq("following_id", uid),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const following = new Set((outRows ?? []).map((r) => r.following_id as string));
      const followers = new Set((inRows ?? []).map((r) => r.follower_id as string));
      const mutual = [...following].filter((id) => followers.has(id));
      if (mutual.length === 0) return [] as LiveUser[];
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,frame,last_seen")
        .in("id", mutual)
        .gte("last_seen", since)
        .order("last_seen", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LiveUser[];
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

  const liveUsers = useQuery({
    queryKey: ["home-live-users"],
    queryFn: async () => {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,frame,last_seen")
        .gte("last_seen", since)
        .order("last_seen", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LiveUser[];
    },
    refetchInterval: 30_000,
  });

  const rooms = useQuery({
    queryKey: ["home-rooms", tab],
    queryFn: async () => {
      let sel = supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,room_type,viewer_count,seat_count,is_locked,pk_battle,host_id,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .limit(40);
      if (tab === "pk") sel = sel.eq("pk_battle", true);
      else sel = sel.eq("room_type", tab);
      const { data, error } = await sel;
      if (error) throw error;
      return (data ?? []) as unknown as Room[];
    },
    refetchInterval: 20_000,
  });

  const filteredRooms = useMemo(() => {
    if (!rooms.data) return [];
    if (!query) return rooms.data;
    const s = query.toLowerCase();
    return rooms.data.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        (r.host?.username ?? "").toLowerCase().includes(s),
    );
  }, [rooms.data, query]);

  const userSearch = useQuery({
    queryKey: ["home-user-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar,user_code")
        .or(
          `username.ilike.%${query}%,full_name.ilike.%${query}%,user_code.ilike.%${query}%`,
        )
        .limit(12);
      if (error) throw error;
      return (data ?? []) as SearchUser[];
    },
  });

  return (
    <>
      <div className="min-h-[100dvh] pb-24">
        {/* Premium top bar */}
        <header
          className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
            <Link to={user ? "/me" : "/auth"} className="relative shrink-0">
              <span
                aria-hidden
                className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] opacity-90 blur-[1px]"
              />
              <span className="relative block h-10 w-10 overflow-hidden rounded-full ring-2 ring-background">
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.username ?? "me"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={jalwaLogo}
                    alt="Jalwa"
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
            </Link>

            <label className="flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-2 shadow-inner">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search rooms, users, ID…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <div className="flex shrink-0 items-center gap-1.5">
              {user && (
                <button
                  type="button"
                  onClick={() => setFriendsOpen(true)}
                  aria-label="Friends online"
                  className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/60 text-foreground/80 hover:text-[color:var(--primary)]"
                >
                  <UserRound className="h-4 w-4" />
                </button>
              )}
              {profile && (
                <Link
                  to="/wallet"
                  className="flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1.5 text-[11px] font-semibold"
                >
                  <WalletIcon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                  <span>{profile.coins.toLocaleString()}</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  aria-label="Admin"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
              {!user && (
                <Link
                  to="/auth"
                  className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-md">
          {/* Search results (users) */}
          {query.length >= 2 && (
            <section className="px-4 pt-3">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Users
              </p>
              {userSearch.isLoading ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Searching…
                </p>
              ) : userSearch.data && userSearch.data.length > 0 ? (
                <div className="space-y-2">
                  {userSearch.data.map((u) => (
                    <div
                      key={u.id}
                      className="glass flex items-center gap-3 rounded-2xl p-2.5"
                    >
                      <div className="grid h-10 w-10 shrink-0 overflow-hidden rounded-full bg-card">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[color:var(--primary)]/40 to-[color:var(--secondary)]/40 text-xs font-bold">
                            {(u.username ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {u.full_name ?? u.username ?? "User"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          @{u.username ?? "user"}
                          {u.user_code ? ` · ID ${u.user_code}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No users found
                </p>
              )}
            </section>
          )}

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
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Live user slider */}
          <section className="mt-4">
            <div className="flex items-center justify-between px-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Live now
              </p>
              <span className="text-[10px] font-semibold text-[color:var(--gold)]">
                {liveUsers.data?.length ?? 0} online
              </span>
            </div>
            <div className="scrollbar-hide mt-2 -mx-1 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {(liveUsers.data ?? []).map((u) => (
                <Link
                  key={u.id}
                  to="/messages/$peerId"
                  params={{ peerId: u.id }}
                  className="flex w-16 shrink-0 snap-start flex-col items-center gap-1"
                >
                  <span className="relative">
                    <span
                      aria-hidden
                      className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)]"
                    />
                    <span className="relative block h-14 w-14 overflow-hidden rounded-full ring-2 ring-background">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-card text-sm font-bold">
                          {(u.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </span>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-foreground/80">
                    @{u.username ?? "user"}
                  </span>
                </Link>
              ))}
              {(!liveUsers.data || liveUsers.data.length === 0) && (
                <p className="py-4 text-xs text-muted-foreground">
                  No one online right now
                </p>
              )}
            </div>
          </section>

          {/* Tabs */}
          <section className="mt-3 px-4">
            <div className="glass grid grid-cols-3 gap-1 rounded-full p-1">
              {TABS.map(({ key, label, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-[0_6px_20px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
                        : "text-foreground/70"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{label}</span>
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
            ) : filteredRooms.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredRooms.map((r) => (
                  <RoomCard key={r.id} room={r} />
                ))}
              </div>
            ) : (
              <EmptyRooms tab={tab} />
            )}
          </section>
        </div>
      </div>
      <BottomNav />

      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)]/30 to-[color:var(--secondary)]/30">
                <UserRound className="h-4 w-4" />
              </span>
              Friends online
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto">
            {friends.isLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Loading…
              </p>
            ) : friends.data && friends.data.length > 0 ? (
              friends.data.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5"
                >
                  <span className="relative shrink-0">
                    <span className="block h-10 w-10 overflow-hidden rounded-full">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-card text-sm font-bold">
                          {(u.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </span>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      @{u.username ?? "user"}
                    </p>
                    <p className="text-[11px] text-emerald-500">Online now</p>
                  </div>
                  <Link
                    to="/messages/$peerId"
                    params={{ peerId: u.id }}
                    onClick={() => setFriendsOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                    aria-label="Message"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold">No friends online</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mutual follows (you follow each other) will appear here when they're online.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
      {room.pk_battle && (
        <div className="absolute left-2 top-8 flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
          <Flame className="h-2.5 w-2.5" />
          PK
        </div>
      )}
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

function EmptyRooms({ tab }: { tab: TabKey }) {
  const label =
    tab === "pk" ? "PK battles" : tab === "video" ? "video rooms" : "voice rooms";
  return (
    <div className="glass mt-2 rounded-2xl p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--primary)]/20">
        <Radio className="h-6 w-6 text-[color:var(--primary)]" />
      </div>
      <h3 className="mt-3 font-bold">No live {label} yet</h3>
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
