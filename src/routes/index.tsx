import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { DailySpinPopup } from "@/components/DailySpinPopup";
import { DailySpinFloatingButton } from "@/components/DailySpinFloatingButton";
import { formatCompact } from "@/lib/utils";

import jalwaLogo from "@/assets/jalwa-logo.png";
import jalwaFrameGold from "@/assets/jalwa-frame-gold.png.asset.json";
import jalwaFrameViolet from "@/assets/jalwa-frame-violet.png.asset.json";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShareSheet } from "@/components/ShareSheet";
import { RoomRecoveryCard } from "@/components/room/RoomRecoveryCard";
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
  Crown,
  Gift,
  Trophy,
  Sparkles,
  Palette,
  Rocket,
  Bell,
  MoreVertical,
  LifeBuoy,
  Share2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

type Banner = { id: string; title: string | null; image_url: string; link_url: string | null; expires_at?: string | null };
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
  coin_score?: number;
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
  { key: "video", label: "Video", Icon: Video },
  { key: "voice", label: "Voice", Icon: Mic },
  { key: "pk", label: "PK Battle", Icon: Swords },
];

// Empty by default — banners come from admin panel only (no mock imagery).
const DEFAULT_BANNERS: Banner[] = [];

function Home() {
  const { user, profile, isAdmin, loading } = useAuth();
  const unread = useUnreadCount();
  const unreadCount = user ? (unread.data ?? 0) : 0;
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("video");
  const [q, setQ] = useState("");
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const query = q.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);


  // Show splash once per browser session on domain open
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("splash_shown")) {
        navigate({ to: "/splash", replace: true });
      }
    } catch { /* no-op */ }
  }, [navigate]);

  // Live auto-refresh: any rooms / follows / banners change → refetch instantly.
  useRealtimeInvalidate("home-live", [
    { table: "live_rooms", invalidate: [["home-top-hosts"], ["home-rooms-page"], ["home-live-users"]] },
    { table: "follows", invalidate: [["home-mutual-friends-online"]] },
    { table: "banners", invalidate: [["banners"]] },
  ]);

  const friends = useQuery({

    queryKey: ["home-mutual-friends-online", user?.id],
    enabled: !!user?.id && friendsOpen,
    refetchInterval: friendsOpen ? 15_000 : false,
    refetchOnWindowFocus: true,
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
      const since = new Date(Date.now() - 2 * 60_000).toISOString();
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
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("banners")
        .select("id,title,image_url,link_url,expires_at")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("sort_order");
      if (error) throw error;
      return data as Banner[];
    },
  });

  const liveUsers = useQuery({
    queryKey: ["home-live-users"],
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,frame,last_seen")
        .gte("last_seen", since)
        .order("last_seen", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LiveUser[];
    },
    // Realtime handles updates via useRealtimeInvalidate above; a slow safety
    // poll is enough — 10s was hammering the DB and jittering the UI.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Top hosts: small server-side query (top 10 by viewer_count) re-ranked by
  // popularity/coin_score, take top 2. Cheap and independent of pagination.
  const topHostsQ = useQuery({
    queryKey: ["home-top-hosts", tab],
    queryFn: async () => {
      let sel = supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,room_type,viewer_count,seat_count,is_locked,pk_battle,host_id,host:profiles!live_rooms_host_id_fkey(username,avatar)",
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
      const ids = list.map((r) => r.id);
      const { data: pop } = await supabase
        .from("room_popularity")
        .select("room_id,coin_score")
        .in("room_id", ids);
      const scoreByRoom = new Map<string, number>(
        (pop ?? []).map((p: { room_id: string; coin_score: number | string }) => [
          p.room_id,
          Number(p.coin_score ?? 0),
        ]),
      );
      return list
        .map((r) => ({ ...r, coin_score: scoreByRoom.get(r.id) ?? 0 }))
        .sort(
          (a, b) =>
            (b.coin_score ?? 0) - (a.coin_score ?? 0) ||
            b.viewer_count - a.viewer_count,
        )
        .slice(0, 2);
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const topHosts = useMemo(() => {
    const list = topHostsQ.data ?? [];
    if (!debouncedQuery) return list;
    const s = debouncedQuery.toLowerCase();
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        (r.host?.username ?? "").toLowerCase().includes(s),
    );
  }, [topHostsQ.data, debouncedQuery]);

  const topIds = useMemo(() => new Set((topHostsQ.data ?? []).map((r) => r.id)), [topHostsQ.data]);

  // All Live Rooms: server-side pagination via .range(). Scales to millions.
  const PAGE_SIZE = 20;
  const restRoomsInfinite = useInfiniteQuery({
    queryKey: ["home-rooms-page", tab, debouncedQuery],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam as number;
      const to = from + PAGE_SIZE - 1;
      let sel = supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,room_type,viewer_count,seat_count,is_locked,pk_battle,host_id,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .range(from, to);
      if (tab === "pk") sel = sel.eq("pk_battle", true);
      else sel = sel.eq("room_type", tab);
      if (debouncedQuery) sel = sel.ilike("title", `%${debouncedQuery}%`);
      const { data, error } = await sel;
      if (error) throw error;
      return (data ?? []) as unknown as Room[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const restRooms = useMemo(() => {
    const flat = (restRoomsInfinite.data?.pages ?? []).flat();
    return flat.filter((r) => !topIds.has(r.id));
  }, [restRoomsInfinite.data, topIds]);

  const filteredRoomsCount = topHosts.length + restRooms.length;
  const isRoomsLoading = topHostsQ.isLoading || restRoomsInfinite.isLoading;




  const userSearch = useQuery({
    queryKey: ["home-user-search", debouncedQuery],
    enabled: debouncedQuery.length >= 2,
    queryFn: async () => {
      // Escape PostgREST reserved chars so `,`, `(`, `)`, `%`, `*`, `.` in
      // the search box don't break the .or() filter (silent 400).
      const safe = debouncedQuery.replace(/[,()%*.\\"']/g, " ").trim();
      if (safe.length < 2) return [] as SearchUser[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar,user_code")
        .or(
          `username.ilike.%${safe}%,full_name.ilike.%${safe}%,user_code.ilike.%${safe}%`,
        )
        .limit(12);

      if (error) throw error;
      return (data ?? []) as SearchUser[];
    },
  });


  // Auto-advance banners every 3s (fixed slider, transform-based)
  useEffect(() => {
    const list = (banners.data && banners.data.length > 0) ? banners.data : DEFAULT_BANNERS;
    if (list.length < 2) return;
    const t = setInterval(() => {
      setBannerIdx((i) => (i + 1) % list.length);
    }, 3000);
    return () => clearInterval(t);
  }, [banners.data]);

  const tabIndex = TABS.findIndex((t) => t.key === tab);

  return (
    <>
      <div className="min-h-[100dvh] pb-28">
        {/* Premium top bar */}
        <header
          className="sticky top-0 z-30 border-b border-white/5 bg-background/60 backdrop-blur-2xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
            {loading ? (
              <span className="relative shrink-0" aria-label="Profile">
                <span
                  aria-hidden
                  className="absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,var(--gold),var(--primary),var(--secondary),var(--gold))]"
                />
                <span className="relative block h-10 w-10 overflow-hidden rounded-full ring-2 ring-background">
                  <img src={jalwaLogo} alt="Jalwa" className="h-full w-full object-cover" />
                </span>
              </span>
            ) : (
            <Link to={user ? "/me" : "/auth"} className="relative shrink-0" aria-label="Profile">
              <span
                aria-hidden
                className="absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,var(--gold),var(--primary),var(--secondary),var(--gold))]"
              />
              <span className="relative block h-10 w-10 overflow-hidden rounded-full ring-2 ring-background">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt={profile.username ?? "me"} className="h-full w-full object-cover" />
                ) : (
                  <img src={jalwaLogo} alt="Jalwa" className="h-full w-full object-cover" />
                )}
              </span>
            </Link>
            )}

            <label className="group flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 shadow-inner backdrop-blur transition focus-within:border-[color:var(--primary)]/60 focus-within:bg-white/10">
              <Search className="h-4 w-4 text-muted-foreground transition group-focus-within:text-[color:var(--primary)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search rooms, users, ID…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <div className="flex shrink-0 items-center gap-1.5">
              {user && (
                <>
                  <Link
                    to="/notifications"
                    aria-label="Notifications"
                    className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground/80 hover:text-[color:var(--primary)]"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[color:var(--primary)] px-1 text-[9px] font-black text-primary-foreground ring-2 ring-background">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setFriendsOpen(true)}
                    aria-label="Friends online"
                    className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground/80 hover:text-[color:var(--primary)]"
                  >
                    <UserRound className="h-4 w-4" />
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </button>
                </>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  aria-label="Admin"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] ring-1 ring-[color:var(--gold)]/40"
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
              {user && (
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="More"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground/80 hover:text-[color:var(--primary)]"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
              {!loading && !user && (
                <Link
                  to="/auth"
                  className="glow-4d rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-md">
          {/* Priority: recover active/disconnected room */}
          <RoomRecoveryCard />
          {/* Search results (users) */}
          {query.length >= 2 && (
            <section className="px-4 pt-3">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Users</p>
              {userSearch.isLoading ? (
                <p className="py-3 text-center text-xs text-muted-foreground">Searching…</p>
              ) : userSearch.data && userSearch.data.length > 0 ? (
                <div className="space-y-2">
                  {userSearch.data.map((u) => (
                    <Link
                      key={u.id}
                      to="/u/$userId"
                      params={{ userId: u.id }}
                      className="glass flex items-center gap-3 rounded-2xl p-2.5"
                    >
                      <div className="grid h-10 w-10 shrink-0 overflow-hidden rounded-full bg-card">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="h-full w-full object-cover" />
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
                          {u.username ?? "user"}
                          {u.user_code ? ` · ID ${u.user_code}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}

                </div>
              ) : (
                <p className="py-3 text-center text-xs text-muted-foreground">No users found</p>
              )}
            </section>
          )}

          {/* Hero Banners — fixed slider (transform-based, auto 3s) */}
          <section className="px-4 pt-3">
            {(() => { const list = (banners.data && banners.data.length > 0) ? banners.data : DEFAULT_BANNERS; return list.length > 0 ? (
              <>
                <div className="glow-4d relative aspect-[11/4] w-full overflow-hidden rounded-3xl border border-white/10 bg-black">
                  <div
                    ref={bannerRef}
                    className="flex h-full w-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
                  >
                    {list.map((b) => (
                      <a
                        key={b.id}
                        href={b.link_url ?? "#"}
                        className="relative block h-full w-full shrink-0"
                      >
                        <img
                          src={b.image_url}
                          alt={b.title ?? ""}
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        {b.title && (
                          <div className="absolute inset-x-4 bottom-3">
                            <p className="text-sm font-bold text-white drop-shadow">{b.title}</p>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>

                {list.length > 1 && (
                  <div className="mt-2 flex justify-center gap-1.5">
                    {list.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === bannerIdx
                            ? "w-5 bg-[color:var(--primary)]"
                            : "w-1.5 bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="glow-4d relative aspect-[16/8] w-full overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--gold)_35%,transparent),transparent_60%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklab,var(--secondary)_50%,transparent),transparent_60%),linear-gradient(135deg,color-mix(in_oklab,var(--primary)_40%,transparent),color-mix(in_oklab,var(--secondary)_50%,transparent))] p-5">
                <div className="flex h-full flex-col justify-between">
                  <span className="w-fit rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
                    <Sparkles className="mr-1 inline h-3 w-3" /> Welcome
                  </span>
                  <div>
                    <h2 className="text-2xl font-black leading-tight drop-shadow">
                      Go live. Get gifts.
                      <br />
                      <span className="bg-gradient-to-r from-[color:var(--gold)] to-white bg-clip-text text-transparent">
                        Shine bright.
                      </span>
                    </h2>
                  </div>
                </div>
              </div>
            ); })()}
          </section>

          {/* (Quick actions removed per request) */}

          {/* Live user slider */}
          <section className="mt-5">
            <div className="flex items-center justify-between px-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live now
              </p>
              <span className="text-[10px] font-bold text-[color:var(--gold)]">
                {liveUsers.data?.length ?? 0} online
              </span>
            </div>
            <div className="scrollbar-hide mt-2 -mx-1 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {(liveUsers.data ?? []).map((u) => (
                <Link
                  key={u.id}
                  to="/u/$userId"
                  params={{ userId: u.id }}
                  className="flex w-16 shrink-0 snap-start flex-col items-center gap-1"
                >
                  <span className="relative">
                    <span
                      aria-hidden
                      className="absolute -inset-0.5 rounded-full bg-[conic-gradient(from_0deg,var(--gold),var(--primary),var(--secondary),var(--gold))]"
                    />
                    <span className="relative block h-14 w-14 overflow-hidden rounded-full ring-2 ring-background">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-card text-sm font-bold">
                          {(u.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </span>
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[8px] font-black text-white ring-2 ring-background">
                      LIVE
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-foreground/80">
                    {u.username ?? "user"}
                  </span>
                </Link>
              ))}
              {(!liveUsers.data || liveUsers.data.length === 0) && (
                <div className="flex items-center gap-2 py-4 pl-1 text-xs text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" /> No one online right now
                </div>
              )}
            </div>
          </section>

          {/* Tabs with sliding indicator */}
          <section className="mt-4 px-4">
            <div className="relative grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-transform duration-300"
                style={{ transform: `translateX(${tabIndex * 100}%)` }}
              />
              {TABS.map(({ key, label, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-bold transition ${
                      active ? "text-primary-foreground" : "text-foreground/70"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Rooms — Top Hosts + All Live */}
          <section className="mt-4 space-y-5 px-4">
            {isRoomsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : filteredRoomsCount > 0 ? (
              <>
                {topHosts.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-[color:var(--gold)]" />
                      <h2 className="text-xs font-black uppercase tracking-wider text-foreground/80">
                        Top Hosts
                      </h2>
                    </div>
                    <RoomFrameFilters />
                    <div className="grid grid-cols-2 gap-3">
                      {topHosts.map((r, i) => (
                        <RoomCard key={r.id} room={r} frameTone={i === 0 ? "gold" : "violet"} />
                      ))}
                    </div>
                  </div>
                )}

                {restRooms.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Radio className="h-4 w-4 text-[color:var(--primary)]" />
                      <h2 className="text-xs font-black uppercase tracking-wider text-foreground/80">
                        All Live Rooms
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {restRooms.map((r) => (
                        <RoomListItem key={r.id} room={r} />
                      ))}
                    </div>
                    {restRoomsInfinite.hasNextPage && (
                      <button
                        onClick={() => restRoomsInfinite.fetchNextPage()}
                        disabled={restRoomsInfinite.isFetchingNextPage}
                        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-foreground/80 hover:bg-white/10 disabled:opacity-50"
                      >
                        {restRoomsInfinite.isFetchingNextPage ? "Loading…" : "Load more"}
                      </button>
                    )}

                  </div>
                )}
              </>
            ) : (
              <EmptyRooms tab={tab} />
            )}
          </section>

        </div>
      </div>
      <BottomNav />
      <DailySpinPopup />
      <DailySpinFloatingButton />

      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="glow-4d grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)]/30 to-[color:var(--secondary)]/30">
                <UserRound className="h-4 w-4" />
              </span>
              Friends online
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto">
            {friends.isLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : friends.data && friends.data.length > 0 ? (
              friends.data.map((u) => (
                <Link
                  key={u.id}
                  to="/u/$userId"
                  params={{ userId: u.id }}
                  onClick={() => setFriendsOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5"
                >
                  <span className="relative shrink-0">
                    <span className="block h-10 w-10 overflow-hidden rounded-full">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-card text-sm font-bold">
                          {(u.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </span>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.username ?? "user"}</p>
                    <p className="text-[11px] text-emerald-500">Online now</p>
                  </div>
                  <MessageCircle className="h-4 w-4 shrink-0 text-[color:var(--primary)]" />
                </Link>
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

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle>Menu</DialogTitle>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setShareOpen(true); }}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-3 text-xs"
            >
              <Share2 className="h-5 w-5 text-[color:var(--primary)]" />
              Share app
            </button>
            <Link to="/support" onClick={() => setMenuOpen(false)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-3 text-xs">
              <LifeBuoy className="h-5 w-5 text-[color:var(--primary)]" />
              Support
            </Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-3 text-xs">
              <Sparkles className="h-5 w-5 text-[color:var(--primary)]" />
              Settings
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share Jalwa Live"
        target={{
          title: "Jalwa Live",
          text: "Join me on Jalwa Live — live rooms, PK battles, and more.",
          url: typeof window !== "undefined" ? window.location.origin : "https://cloud-to-soul.lovable.app",
        }}
      />
    </>

  );
}


type TopFrameRow = {
  slot: 1 | 2;
  media_url: string;
  media_type: "png" | "svga" | "mp4" | "webm" | "gif";
  chromakey: "none" | "green" | "black" | "luma";
};

function useTopRankFrames() {
  return useQuery({
    queryKey: ["room_top_frames_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_top_frames")
        .select("slot,media_url,media_type,chromakey")
        .in("slot", [1, 2])
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<1 | 2, TopFrameRow | null> = { 1: null, 2: null };
      for (const r of (data ?? []) as TopFrameRow[]) map[r.slot] = r;
      return map;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

function RoomFrameSquare({ tone }: { tone: "gold" | "violet" }) {
  const { data } = useTopRankFrames();
  const slot: 1 | 2 = tone === "gold" ? 1 : 2;
  const row = data?.[slot];
  const fallback = tone === "gold" ? jalwaFrameGold.url : jalwaFrameViolet.url;
  const src = row?.media_url ?? fallback;
  const mediaType = row?.media_type ?? "png";
  const isVideo = mediaType === "mp4" || mediaType === "webm";
  const chromakey = row?.chromakey ?? "none";
  // Video frames are green-screen sourced — always key unless admin says none.
  const filter =
    chromakey === "green" || chromakey === "luma" || (isVideo && chromakey !== "none")
      ? "url(#room-frame-green-key)"
      : chromakey === "black"
      ? "url(#room-frame-luma-key)"
      : undefined;
  // The frame overlays the whole card tile (the cover is inset inside it), so
  // crown / corner ornaments always render fully.
  const commonClass =
    "pointer-events-none absolute inset-0 h-full w-full max-w-none object-fill select-none z-30";




  if (mediaType === "mp4" || mediaType === "webm") {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        style={{ filter }}
        className={commonClass}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      style={{ filter }}
      className={commonClass}
    />
  );
}

function RoomFrameFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="room-frame-green-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -1.35 1 0 0.08" />
          <feComponentTransfer><feFuncA type="linear" slope="3.8" intercept="-0.08" /></feComponentTransfer>
        </filter>
        <filter id="room-frame-luma-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.2126 0.7152 0.0722 0 0" />
          <feComponentTransfer><feFuncA type="linear" slope="5.2" intercept="-0.48" /></feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}



function RoomCard({ room, frameTone }: { room: Room; frameTone?: "gold" | "violet" }) {
  const TypeIcon = room.room_type === "video" ? Video : Mic;
  const glow = frameTone === "gold"
    ? "shadow-[0_10px_30px_-6px_rgba(251,191,36,0.55)]"
    : frameTone === "violet"
    ? "shadow-[0_10px_30px_-6px_rgba(168,85,247,0.55)]"
    : "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)]";
  return (
    <div className="relative aspect-square">
      <Link
        to="/room/$roomId"
        params={{ roomId: room.id }}
        className={`group absolute overflow-hidden border border-white/10 bg-card ${glow} transition active:scale-[0.98] ${
          frameTone ? "inset-[7%] rounded-2xl" : "inset-0 rounded-3xl"
        }`}
      >

      {room.cover_url ? (
        <img
          src={room.cover_url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
        />
      ) : room.host?.avatar ? (
        <img
          src={room.host.avatar}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[color:var(--secondary)]/70 via-[color:var(--primary)]/50 to-[color:var(--gold)]/40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />



      {/* Live badge */}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[color:var(--destructive)]/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        Live
      </div>

      {room.pk_battle && (
        <div className="glow-4d absolute left-2 top-9 flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-2 py-0.5 text-[10px] font-black uppercase text-black">
          <Flame className="h-2.5 w-2.5" />
          PK
        </div>
      )}

      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
        <Users className="h-2.5 w-2.5" />
        {room.viewer_count}
      </div>

      {room.is_locked && (
        <div className="absolute right-2 top-9 grid h-6 w-6 place-items-center rounded-full bg-black/60 backdrop-blur">
          <Lock className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Host chip */}
      <div className="absolute inset-x-2 bottom-2">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/40">
            {room.host?.avatar ? (
              <img src={room.host.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center bg-white/10 text-[9px] font-bold text-white">
                {(room.host?.username ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-0.5 text-[10px] font-semibold text-white/90">
            <TypeIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{room.host?.username ?? "host"}</span>
          </span>
        </div>
        <h3 className="line-clamp-2 text-xs font-black text-white drop-shadow">
          {room.title}
        </h3>
      </div>
      </Link>
      {/* Rank frame paints ON TOP of the cover so its ornaments stay visible. */}
      {frameTone && <RoomFrameSquare tone={frameTone} />}

    </div>

  );
}


function RoomListItem({ room }: { room: Room }) {
  const TypeIcon = room.room_type === "video" ? Video : Mic;
  return (
    <Link
      to="/room/$roomId"
      params={{ roomId: room.id }}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-card/70 p-2.5 shadow-[0_6px_20px_-15px_rgba(0,0,0,0.6)] transition active:scale-[0.99]"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/5">
        {room.cover_url ? (
          <img src={room.cover_url} alt="" className="h-full w-full object-cover" />
        ) : room.host?.avatar ? (
          <img src={room.host.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[color:var(--secondary)]/70 via-[color:var(--primary)]/50 to-[color:var(--gold)]/40" />
        )}
        <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-[color:var(--destructive)]/95 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
          <span className="relative flex h-1 w-1">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1 w-1 rounded-full bg-white" />
          </span>
          Live
        </div>
        {room.is_locked && (
          <div className="absolute right-1 bottom-1 grid h-4 w-4 place-items-center rounded-full bg-black/70">
            <Lock className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-black">{room.title}</h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <TypeIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{room.host?.username ?? "host"}</span>
          {room.pk_battle && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
              <Flame className="h-2 w-2" /> PK
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 text-[11px]">
        <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-bold text-white">
          <Users className="h-2.5 w-2.5" /> {room.viewer_count}
        </span>
        {(room.coin_score ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-[color:var(--gold)]">
            <Trophy className="h-2.5 w-2.5" /> {formatCompact(room.coin_score ?? 0)}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyRooms({ tab }: { tab: TabKey }) {
  const label =
    tab === "pk" ? "PK battles" : tab === "video" ? "video rooms" : "voice rooms";
  return (
    <div className="glass mt-2 rounded-3xl border border-white/10 p-8 text-center">
      <div className="glow-4d mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)]/30 to-[color:var(--secondary)]/30">
        <Radio className="h-7 w-7 text-[color:var(--primary)]" />
      </div>
      <h3 className="mt-3 text-base font-black">No live {label} yet</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Be the first to go live and start the party.
      </p>
      <Link
        to="/create-room"
        className="glow-4d mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-5 py-2.5 text-xs font-black text-primary-foreground"
      >
        <Rocket className="h-3.5 w-3.5" /> Go Live
      </Link>
    </div>
  );
}
