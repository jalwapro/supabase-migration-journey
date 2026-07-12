import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle, Search, UserPlus, UserMinus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

type PeerProfile = {
  id: string;
  username: string | null;
  avatar: string | null;
  user_code?: string | null;
};

type LastMsg = {
  peer_id: string;
  text: string;
  created_at: string;
  unread: number;
};

function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"chats" | "friends" | "add">("chats");
  const uid = user?.id ?? null;

  // People I follow (my "friends" for chat purposes)
  const following = useQuery({
    queryKey: ["chat-following", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return [] as PeerProfile[];
      const { data: rows, error } = await supabase
        .from("follows")
        .select("following_id, created_at")
        .eq("follower_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (rows ?? []).map((r: any) => r.following_id);
      if (!ids.length) return [] as PeerProfile[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code")
        .in("id", ids);
      return (profs ?? []) as PeerProfile[];
    },
  });

  // DM inbox — all conversations
  const inbox = useQuery({
    queryKey: ["dm_index", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return { list: [], peers: new Map<string, PeerProfile>() };
      const { data, error } = await supabase
        .from("direct_messages")
        .select("sender_id,recipient_id,message,kind,created_at,read_at,deleted_at")
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const map = new Map<string, LastMsg>();
      for (const m of data ?? []) {
        const peer = m.sender_id === uid ? m.recipient_id : m.sender_id;
        const preview =
          m.deleted_at ? "🚫 Message deleted"
          : m.kind === "image" ? "📷 Photo"
          : m.kind === "video" ? "🎬 Video"
          : m.kind === "voice" ? "🎙️ Voice message"
          : m.kind === "album" ? "🖼️ Shared from gallery"
          : m.kind === "file" ? "📎 File"
          : (m.message ?? "");
        const existing = map.get(peer);
        if (!existing) {
          map.set(peer, {
            peer_id: peer,
            text: preview,
            created_at: m.created_at,
            unread: m.recipient_id === uid && !m.read_at ? 1 : 0,
          });
        } else if (m.recipient_id === uid && !m.read_at) {
          existing.unread += 1;
        }
      }
      const list = Array.from(map.values());
      const ids = list.map((m) => m.peer_id);
      if (!ids.length) return { list, peers: new Map<string, PeerProfile>() };
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code")
        .in("id", ids);
      const peers = new Map<string, PeerProfile>(
        (profs ?? []).map((p: any) => [p.id, p]),
      );
      return { list, peers };
    },
  });

  // Realtime — invalidate on DM or follow change. DM sender/recipient filters
  // stay on separate channels so both directions keep the inbox live.
  useEffect(() => {
    if (!uid) return;
    const sentCh = supabase
      .channel(`chat-index-sent-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `sender_id=eq.${uid}` }, () => {
        qc.invalidateQueries({ queryKey: ["dm_index", uid] });
      })
      .subscribe();
    const receivedCh = supabase
      .channel(`chat-index-received-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${uid}` }, () => {
        qc.invalidateQueries({ queryKey: ["dm_index", uid] });
      })
      .subscribe();
    const followsCh = supabase
      .channel(`chat-index-follows-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${uid}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-following", uid] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(sentCh);
      void supabase.removeChannel(receivedCh);
      void supabase.removeChannel(followsCh);
    };
  }, [uid, qc]);

  if (!user) {
    return (
      <>
        <AppShell title="Messages">
          <div className="px-6 pt-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Sign in to chat with friends</p>
            <Link to="/auth" className="glow-4d mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground">Sign in</Link>
          </div>
        </AppShell>
        <BottomNav />
      </>
    );
  }

  const chatList = (inbox.data?.list ?? []).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const peers = inbox.data?.peers ?? new Map<string, PeerProfile>();

  return (
    <>
      <AppShell title="Messages" subtitle="Friends & DMs">
        <div className="px-4 pt-3">
          <div className="mb-4 flex gap-1 rounded-full bg-card/60 p-1">
            {(["chats", "friends", "add"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-1.5 text-xs font-bold capitalize ${
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "chats" && `Chats${chatList.length ? ` (${chatList.length})` : ""}`}
                {t === "friends" && `Friends${(following.data?.length ?? 0) > 0 ? ` (${following.data!.length})` : ""}`}
                {t === "add" && "Add"}
              </button>
            ))}
          </div>

          {tab === "chats" && (
            <ChatsList
              list={chatList}
              peers={peers}
              loading={inbox.isLoading}
              onGoFriends={() => setTab("friends")}
            />
          )}
          {tab === "friends" && (
            <FriendsList
              friends={following.data ?? []}
              loading={following.isLoading}
              onGoAdd={() => setTab("add")}
            />
          )}
          {tab === "add" && <AddFriend />}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function ChatsList({
  list, peers, loading, onGoFriends,
}: {
  list: LastMsg[];
  peers: Map<string, PeerProfile>;
  loading: boolean;
  onGoFriends: () => void;
}) {
  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="py-10 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No chats yet.</p>
        <p className="text-xs text-muted-foreground">Say hi to a friend to start a conversation.</p>
        <button
          onClick={onGoFriends}
          className="mt-4 rounded-full bg-[color:var(--primary)]/20 px-4 py-2 text-[11px] font-bold text-[color:var(--primary)]"
        >
          View friends
        </button>
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {list.map((m) => {
        const p = peers.get(m.peer_id);
        return (
          <li key={m.peer_id}>
            <Link
              to="/messages/$peerId"
              params={{ peerId: m.peer_id }}
              className="flex items-center gap-3 rounded-2xl p-2 hover:bg-card/60"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 font-bold">
                {p?.avatar ? (
                  <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  (p?.username ?? "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm">{p?.username ?? "user"}</p>
                <p className="truncate text-xs text-muted-foreground">{m.text || "Say hi 👋"}</p>
              </div>
              {m.unread ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--primary)] px-1.5 text-[10px] font-black text-primary-foreground">
                  {m.unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FriendsList({
  friends, loading, onGoAdd,
}: {
  friends: PeerProfile[];
  loading: boolean;
  onGoAdd: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const unfollow = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["chat-following", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (friends.length === 0) {
    return (
      <div className="py-10 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">You haven't added anyone yet.</p>
        <button
          onClick={onGoAdd}
          className="mt-4 rounded-full bg-[color:var(--primary)] px-5 py-2 text-xs font-bold text-primary-foreground"
        >
          Find people
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {friends.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-2">
          <Link
            to="/messages/$peerId"
            params={{ peerId: p.id }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 font-bold">
              {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : (p.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.username ?? "user"}</p>
              <p className="truncate text-[10px] text-muted-foreground">ID {p.user_code ?? "—"}</p>
            </div>
          </Link>
          <Link
            to="/messages/$peerId"
            params={{ peerId: p.id }}
            className="rounded-full bg-[color:var(--primary)]/20 px-3 py-1.5 text-[11px] font-bold text-[color:var(--primary)]"
          >
            Chat
          </Link>
          <button
            onClick={() => unfollow.mutate(p.id)}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground"
            aria-label="Remove"
          >
            <UserMinus className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AddFriend() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PeerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  async function doSearch() {
    if (!q.trim() || !user) return;
    setSearching(true);
    const term = q.trim().replace(/^@/, "");
    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,avatar,user_code")
      .or(`username.ilike.%${term}%,user_code.eq.${term}`)
      .neq("id", user.id)
      .limit(20);
    if (error) {
      setSearching(false);
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as PeerProfile[];
    setResults(rows);
    // Which of these am I already following?
    if (rows.length) {
      const { data: fol } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", rows.map((r) => r.id));
      setFollowingIds(new Set((fol ?? []).map((f: any) => f.following_id)));
    } else {
      setFollowingIds(new Set());
    }
    setSearching(false);
  }

  const follow = useMutation({
    mutationFn: async (peerId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: peerId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, peerId) => {
      toast.success("Added");
      setFollowingIds((s) => new Set(s).add(peerId));
      qc.invalidateQueries({ queryKey: ["chat-following", user?.id] });
      qc.invalidateQueries({ queryKey: ["me-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search @username or ID"
            className="w-full rounded-full border border-border bg-card/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--primary)]"
          />
        </div>
        <button
          onClick={doSearch}
          className="glow-4d rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find"}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {results.length === 0 && !searching && (
          <p className="pt-6 text-center text-xs text-muted-foreground">
            Search by username or 6-digit ID
          </p>
        )}
        {results.map((p) => {
          const isFollowing = followingIds.has(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 p-2">
              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
                {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : (p.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.username ?? "user"}</p>
                <p className="truncate text-[10px] text-muted-foreground">ID {p.user_code ?? "—"}</p>
              </div>
              <Link
                to="/messages/$peerId"
                params={{ peerId: p.id }}
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground"
              >
                Chat
              </Link>
              {isFollowing ? (
                <span className="rounded-full bg-[color:var(--primary)]/10 px-3 py-1.5 text-[11px] font-bold text-[color:var(--primary)]">
                  Added
                </span>
              ) : (
                <button
                  onClick={() => follow.mutate(p.id)}
                  disabled={follow.isPending}
                  className="flex items-center gap-1 rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                >
                  <UserPlus className="h-3 w-3" /> Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
