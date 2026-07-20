import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, Filter, PencilLine, MessageSquarePlus, Bell, BellOff,
  BadgeCheck, Crown, Loader2, Users, Home, Sparkles, UserPlus, X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Messages — Jalwa" },
      { name: "description", content: "Chats, followers, live rooms and official updates on Jalwa." },
    ],
  }),
});

const HEADING = { fontFamily: "'Archivo Black', system-ui, sans-serif" } as const;
const BODY = { fontFamily: "'Hind', system-ui, sans-serif" } as const;

type PeerProfile = {
  id: string;
  username: string | null;
  avatar: string | null;
  user_code?: string | null;
  vip_level?: number | null;
};

type InboxRow = {
  peer_id: string;
  peer_username: string | null;
  peer_avatar: string | null;
  peer_user_code: string | null;
  peer_vip_level?: number | null;
  last_message: string | null;
  last_kind: string | null;
  last_deleted: boolean;
  last_created_at: string;
  unread: number;
};

type LiveRoom = {
  id: string;
  title: string | null;
  cover_url: string | null;
  room_type: string | null;
  viewer_count: number | null;
  host_username: string | null;
  host_avatar: string | null;
};

type Tab = "all" | "unread" | "followers" | "rooms";

function classNames(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(" ");
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - d) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (s < 2 * 86400) return "Yesterday";
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function previewText(r: InboxRow): { text: string; icon?: string } {
  if (r.last_deleted) return { text: "Message deleted", icon: "🚫" };
  switch (r.last_kind) {
    case "image": return { text: "Photo", icon: "📷" };
    case "video": return { text: "Video", icon: "🎬" };
    case "voice": return { text: "Voice message", icon: "🎙️" };
    case "album": return { text: "Shared from gallery", icon: "🖼️" };
    case "file":  return { text: "File", icon: "📎" };
    case "gift":  return { text: "Gift", icon: "🎁" };
    default:      return { text: r.last_message ?? "Say hi 👋" };
  }
}

function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uid = user?.id ?? null;

  const [tab, setTab] = useState<Tab>("all");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [muteFilter, setMuteFilter] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Inbox (real, via RPC)
  const inboxQ = useQuery({
    queryKey: ["dm_index", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return [] as InboxRow[];
      const { data, error } = await supabase.rpc("dm_inbox", { _limit: 50, _offset: 0 });
      if (error) throw error;
      return (data ?? []) as InboxRow[];
    },
  });

  // Followers (people who follow me)
  const followersQ = useQuery({
    queryKey: ["chat-followers", uid],
    enabled: !!uid && tab === "followers",
    queryFn: async () => {
      if (!uid) return [] as PeerProfile[];
      const { data: rows, error } = await supabase
        .from("follows")
        .select("follower_id, created_at")
        .eq("following_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = (rows ?? []).map((r: any) => r.follower_id);
      if (!ids.length) return [] as PeerProfile[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code,vip_level")
        .in("id", ids);
      return (profs ?? []) as PeerProfile[];
    },
  });

  // Live rooms (Rooms tab + story ring)
  const roomsQ = useQuery({
    queryKey: ["messages-live-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_live_rooms_ranked", { _limit: 30, _offset: 0 });
      if (error) throw error;
      return (data ?? []) as LiveRoom[];
    },
    staleTime: 20_000,
  });

  // Notifications unread count
  const notifQ = useQuery({
    queryKey: ["msg-notif-count", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null);
      return count ?? 0;
    },
    staleTime: 15_000,
  });

  // Realtime: keep everything live
  useEffect(() => {
    if (!uid) return;
    const chSent = supabase.channel(`msg-sent-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `sender_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["dm_index", uid] }))
      .subscribe();
    const chRecv = supabase.channel(`msg-recv-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["dm_index", uid] }))
      .subscribe();
    const chFollow = supabase.channel(`msg-follows-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["chat-followers", uid] }))
      .subscribe();
    const chNotif = supabase.channel(`msg-notif-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["msg-notif-count", uid] }))
      .subscribe();
    const chRooms = supabase.channel(`msg-rooms`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" },
        () => qc.invalidateQueries({ queryKey: ["messages-live-rooms"] }))
      .subscribe();
    return () => {
      void supabase.removeChannel(chSent);
      void supabase.removeChannel(chRecv);
      void supabase.removeChannel(chFollow);
      void supabase.removeChannel(chNotif);
      void supabase.removeChannel(chRooms);
    };
  }, [uid, qc]);

  const inboxList = useMemo(() => {
    const list = (inboxQ.data ?? []).slice().sort((a, b) =>
      b.last_created_at.localeCompare(a.last_created_at),
    );
    let filtered = list;
    if (query) {
      filtered = filtered.filter((r) => {
        const name = (r.peer_username ?? "").toLowerCase();
        const code = (r.peer_user_code ?? "").toLowerCase();
        const msg  = (r.last_message ?? "").toLowerCase();
        return name.includes(query) || code.includes(query) || msg.includes(query);
      });
    }
    if (muteFilter) filtered = filtered.filter((r) => r.unread > 0);
    return filtered;
  }, [inboxQ.data, query, muteFilter]);

  const unreadTotal = useMemo(
    () => (inboxQ.data ?? []).reduce((n, r) => n + (r.unread || 0), 0),
    [inboxQ.data],
  );

  const unreadList = useMemo(() => inboxList.filter((r) => r.unread > 0), [inboxList]);

  const filteredRooms = useMemo(() => {
    const rows = roomsQ.data ?? [];
    if (!query) return rows;
    return rows.filter((r) =>
      (r.title ?? "").toLowerCase().includes(query) ||
      (r.host_username ?? "").toLowerCase().includes(query),
    );
  }, [roomsQ.data, query]);

  const filteredFollowers = useMemo(() => {
    const rows = followersQ.data ?? [];
    if (!query) return rows;
    return rows.filter((p) =>
      (p.username ?? "").toLowerCase().includes(query) ||
      (p.user_code ?? "").toLowerCase().includes(query),
    );
  }, [followersQ.data, query]);

  const liveRing = roomsQ.data ?? [];

  if (!user) {
    return (
      <>
        <div className="min-h-dvh bg-[#07030f] pb-24 pt-6 text-white" style={BODY}>
          <div className="px-6 pt-16 text-center">
            <MessageSquarePlus className="mx-auto h-10 w-10 text-white/50" />
            <p className="mt-3 text-sm text-white/60">Sign in to chat with friends</p>
            <Link
              to="/auth"
              className="mt-4 inline-flex rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-2 text-xs font-bold text-white shadow-[0_0_30px_rgba(217,70,239,0.5)]"
            >
              Sign in
            </Link>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      {/* Ambient neon background */}
      <div className="relative min-h-dvh bg-[#07030f] pb-28 text-white" style={BODY}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/25 blur-[110px]" />
          <div className="absolute -right-20 top-40 h-72 w-72 rounded-full bg-purple-600/25 blur-[110px]" />
          <div className="absolute left-1/3 top-[45%] h-64 w-64 rounded-full bg-pink-500/15 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-[520px] px-4 pt-4">
          {/* HEADER */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 bg-clip-text text-2xl leading-none tracking-tight text-transparent"
                style={HEADING}
              >
                Jalwa
              </span>
              <span className="hidden text-[9px] font-semibold tracking-[0.25em] text-white/50 sm:inline">
                LIVE YOUR MOMENT
              </span>
            </div>
            <h1 className="absolute left-1/2 -translate-x-1/2 text-lg" style={HEADING}>
              Messages
            </h1>
            <div className="flex items-center gap-2">
              <IconBtn ariaLabel="New chat" badge={notifQ.data ?? 0}>
                <MessageSquarePlus className="h-4 w-4" />
              </IconBtn>
              <IconBtn ariaLabel="Compose">
                <PencilLine className="h-4 w-4" />
              </IconBtn>
            </div>
          </header>

          {/* SEARCH */}
          <div className="mt-5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search users, chats, rooms…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur-md focus:border-fuchsia-400/60 focus:shadow-[0_0_25px_rgba(217,70,239,0.25)]"
              />
            </div>
            <button
              onClick={() => setMuteFilter((v) => !v)}
              className={classNames(
                "grid h-11 w-11 place-items-center rounded-2xl border backdrop-blur-md",
                muteFilter
                  ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.35)]"
                  : "border-white/10 bg-white/[0.04] text-white/70",
              )}
              aria-label="Filter unread"
              title={muteFilter ? "Showing unread only" : "Filter unread"}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          {/* STORY / LIVE RING */}
          <div className="mt-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-start gap-4 pb-2">
              <StoryTile
                label="Add Story"
                onClick={() => toast.message("Stories coming soon ✨")}
                addBadge
              />
              <StoryTile
                label="My Story"
                avatar={(user.user_metadata as any)?.avatar_url ?? null}
                username={(user.user_metadata as any)?.username ?? "Me"}
                ringClass="from-amber-300 via-yellow-500 to-amber-600"
              />
              {liveRing.slice(0, 12).map((r) => (
                <Link
                  key={r.id}
                  to="/room/$roomId"
                  params={{ roomId: r.id }}
                  className="shrink-0"
                >
                  <StoryTile
                    label={r.host_username ?? "Host"}
                    avatar={r.host_avatar}
                    username={r.host_username ?? ""}
                    live
                    ringClass="from-pink-500 via-fuchsia-500 to-purple-600"
                  />
                </Link>
              ))}
            </div>
          </div>

          {/* TABS */}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabPill active={tab === "all"} onClick={() => setTab("all")} icon={<MessageSquarePlus className="h-3.5 w-3.5" />} label="All Chats" />
            <TabPill active={tab === "unread"} onClick={() => setTab("unread")} icon={<Bell className="h-3.5 w-3.5" />} label="Unread" count={unreadTotal} />
            <TabPill active={tab === "followers"} onClick={() => setTab("followers")} icon={<Users className="h-3.5 w-3.5" />} label="Followers" count={followersQ.data?.length ?? 0} />
            <TabPill active={tab === "rooms"} onClick={() => setTab("rooms")} icon={<Home className="h-3.5 w-3.5" />} label="Rooms" count={roomsQ.data?.length ?? 0} />
          </div>

          {/* CONTENT */}
          <div className="mt-4 space-y-2.5">
            {tab === "all" && (
              <InboxList
                loading={inboxQ.isLoading}
                rows={inboxList}
                emptyTitle="No conversations yet"
                emptyHint="Follow someone or open a live room to start chatting."
              />
            )}
            {tab === "unread" && (
              <InboxList
                loading={inboxQ.isLoading}
                rows={unreadList}
                emptyTitle="You're all caught up"
                emptyHint="No unread messages right now."
              />
            )}
            {tab === "followers" && (
              <FollowersList loading={followersQ.isLoading} rows={filteredFollowers} />
            )}
            {tab === "rooms" && (
              <RoomsList loading={roomsQ.isLoading} rows={filteredRooms} />
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}

/* ---------- reusable pieces ---------- */

function IconBtn({
  children, ariaLabel, badge,
}: { children: React.ReactNode; ariaLabel: string; badge?: number }) {
  return (
    <button
      aria-label={ariaLabel}
      className="relative grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 backdrop-blur-md transition hover:border-fuchsia-400/50 hover:text-white"
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 px-1 text-[9px] font-black text-white shadow-[0_0_10px_rgba(244,63,94,0.6)]">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function TabPill({
  active, onClick, label, count, icon,
}: {
  active: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "relative flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition",
        active
          ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-500/25 to-purple-600/25 text-white shadow-[0_0_25px_rgba(217,70,239,0.35)]"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:text-white",
      )}
    >
      {icon}
      <span>{label}</span>
      {!!count && count > 0 && (
        <span className={classNames(
          "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black",
          active ? "bg-white/90 text-fuchsia-700" : "bg-rose-500 text-white",
        )}>
          {count > 99 ? "99+" : count}
        </span>
      )}
      {active && (
        <span className="pointer-events-none absolute inset-x-4 -bottom-[3px] h-[2px] rounded-full bg-gradient-to-r from-pink-400 to-purple-500 shadow-[0_0_10px_rgba(217,70,239,0.9)]" />
      )}
    </button>
  );
}

function StoryTile({
  label, avatar, username, live, addBadge, ringClass, onClick,
}: {
  label: string;
  avatar?: string | null;
  username?: string;
  live?: boolean;
  addBadge?: boolean;
  ringClass?: string;
  onClick?: () => void;
}) {
  const initial = (username ?? label).trim().slice(0, 1).toUpperCase() || "?";
  return (
    <button
      onClick={onClick}
      className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
      type="button"
    >
      <span className={classNames(
        "relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br p-[2px]",
        ringClass ?? "from-white/30 via-white/10 to-white/30",
      )}>
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#120820]">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : addBadge ? (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 text-white/80">
              <UserPlus className="h-6 w-6" />
            </span>
          ) : (
            <span className="text-lg font-bold text-white/80" style={HEADING}>{initial}</span>
          )}
        </span>
        {addBadge && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-[11px] font-black text-white shadow-[0_0_10px_rgba(217,70,239,0.7)]">
            +
          </span>
        )}
        {live && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white shadow-[0_0_10px_rgba(236,72,153,0.7)]">
            LIVE
          </span>
        )}
        {!live && !addBadge && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#07030f] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
        )}
      </span>
      <span className="w-16 truncate text-[10px] font-medium text-white/75">{label}</span>
    </button>
  );
}

/* ---------- inbox / lists ---------- */

function EmptyBlock({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-md">
      <Sparkles className="mx-auto h-8 w-8 text-fuchsia-300/70" />
      <p className="mt-3 text-sm font-semibold text-white/90" style={HEADING}>{title}</p>
      <p className="mt-1 text-xs text-white/50">{hint}</p>
    </div>
  );
}

function InboxList({
  loading, rows, emptyTitle, emptyHint,
}: {
  loading: boolean;
  rows: InboxRow[];
  emptyTitle: string;
  emptyHint: string;
}) {
  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }
  if (!rows.length) return <EmptyBlock title={emptyTitle} hint={emptyHint} />;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <InboxRowCard key={r.peer_id} row={r} />
      ))}
    </ul>
  );
}

function InboxRowCard({ row }: { row: InboxRow }) {
  const p = previewText(row);
  const initial = (row.peer_username ?? "?").slice(0, 1).toUpperCase();
  const vip = row.peer_vip_level ?? 0;
  return (
    <li>
      <Link
        to="/messages/$peerId"
        params={{ peerId: row.peer_id }}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md transition hover:border-fuchsia-400/50 hover:bg-white/[0.06] hover:shadow-[0_0_25px_rgba(217,70,239,0.15)]"
      >
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500/60 to-purple-600/60 p-[2px]">
          <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#120820] font-bold text-white/80">
            {row.peer_avatar
              ? <img src={row.peer_avatar} alt="" className="h-full w-full object-cover" />
              : initial}
          </span>
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#07030f] bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-white" style={HEADING}>
              {row.peer_username ?? "user"}
            </p>
            {vip >= 5 && <Crown className="h-3.5 w-3.5 text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.7)]" />}
            <BadgeCheck className="h-3.5 w-3.5 text-fuchsia-300" />
          </div>
          <p className="mt-0.5 truncate text-xs text-white/60">
            {p.icon ? <span className="mr-1">{p.icon}</span> : null}{p.text}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-medium text-white/50">{timeAgo(row.last_created_at)}</span>
          {row.unread > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 px-1.5 text-[10px] font-black text-white shadow-[0_0_10px_rgba(217,70,239,0.7)]">
              {row.unread > 99 ? "99+" : row.unread}
            </span>
          ) : (
            <BellOff className="h-3.5 w-3.5 text-white/25" />
          )}
        </div>
      </Link>
    </li>
  );
}

function FollowersList({ loading, rows }: { loading: boolean; rows: PeerProfile[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const followBack = useMutation({
    mutationFn: async (peerId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id, following_id: peerId,
      });
      if (error && !/duplicate/i.test(error.message)) throw error;
    },
    onSuccess: () => {
      toast.success("Following");
      qc.invalidateQueries({ queryKey: ["chat-following", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }
  if (!rows.length)
    return <EmptyBlock title="No followers yet" hint="Go live or send gifts to grow your fans." />;
  return (
    <ul className="space-y-2.5">
      {rows.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md"
        >
          <Link
            to="/u/$userId"
            params={{ userId: p.id }}
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-500/60 to-purple-600/60 p-[2px]"
          >
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#120820] font-bold text-white/80">
              {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : (p.username ?? "?").slice(0, 1).toUpperCase()}
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white" style={HEADING}>{p.username ?? "user"}</p>
            <p className="truncate text-[10px] text-white/50">ID {p.user_code ?? "—"}</p>
          </div>
          <Link
            to="/messages/$peerId"
            params={{ peerId: p.id }}
            className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1.5 text-[11px] font-bold text-fuchsia-200"
          >
            Chat
          </Link>
          <button
            onClick={() => followBack.mutate(p.id)}
            className="rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_0_15px_rgba(217,70,239,0.4)]"
          >
            Follow
          </button>
        </li>
      ))}
    </ul>
  );
}

function RoomsList({ loading, rows }: { loading: boolean; rows: LiveRoom[] }) {
  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }
  if (!rows.length)
    return <EmptyBlock title="No live rooms" hint="Check back soon or start your own room." />;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            to="/room/$roomId"
            params={{ roomId: r.id }}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md transition hover:border-fuchsia-400/50 hover:shadow-[0_0_25px_rgba(217,70,239,0.15)]"
          >
            <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/60 to-purple-600/60">
              {r.cover_url
                ? <img src={r.cover_url} alt="" className="h-full w-full object-cover" />
                : r.host_avatar
                  ? <img src={r.host_avatar} alt="" className="h-full w-full object-cover" />
                  : <Home className="h-5 w-5 text-white/80" />}
              <span className="absolute -top-1 left-1 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white shadow-[0_0_8px_rgba(236,72,153,0.7)]">
                LIVE
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white" style={HEADING}>
                {r.title ?? r.host_username ?? "Live Room"}
              </p>
              <p className="truncate text-[11px] text-white/55">
                Host {r.host_username ?? "—"} · {r.room_type ?? "room"}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/85">
                👥 {r.viewer_count ?? 0}
              </span>
              <span className="mt-1 text-[10px] font-semibold text-fuchsia-300">Join →</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
