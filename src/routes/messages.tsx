import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle, Search, UserPlus, Check, X, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

type Friendship = {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  peer: { id: string; username: string | null; avatar: string | null } | null;
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
  const [tab, setTab] = useState<"chats" | "requests" | "add">("chats");

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

  const friends = useQuery({
    queryKey: ["friends", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("requester_id,addressee_id,status");
      if (error) throw error;
      const rows = data ?? [];
      const peerIds = rows.map((r) =>
        r.requester_id === user.id ? r.addressee_id : r.requester_id,
      );
      if (peerIds.length === 0) return [] as Friendship[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar")
        .in("id", peerIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        peer: byId.get(r.requester_id === user.id ? r.addressee_id : r.requester_id) ?? null,
      })) as Friendship[];
    },
  });

  const lastMessages = useQuery({
    queryKey: ["dm_index", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("sender_id,receiver_id,text,created_at,read_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const map = new Map<string, LastMsg>();
      for (const m of data ?? []) {
        const peer = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const existing = map.get(peer);
        if (!existing) {
          map.set(peer, {
            peer_id: peer,
            text: m.text,
            created_at: m.created_at,
            unread: m.receiver_id === user.id && !m.read_at ? 1 : 0,
          });
        } else if (m.receiver_id === user.id && !m.read_at) {
          existing.unread += 1;
        }
      }
      return Array.from(map.values());
    },
  });

  // Realtime — invalidate on new DM or friendship change
  useEffect(() => {
    const ch = supabase
      .channel(`dm-index-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "direct_messages",
      }, () => {
        qc.invalidateQueries({ queryKey: ["dm_index", user.id] });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "friendships",
      }, () => {
        qc.invalidateQueries({ queryKey: ["friends", user.id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user.id, qc]);

  const accepted = (friends.data ?? []).filter((f) => f.status === "accepted");
  const incoming = (friends.data ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user.id,
  );
  const outgoing = (friends.data ?? []).filter(
    (f) => f.status === "pending" && f.requester_id === user.id,
  );

  const lastByPeer = new Map((lastMessages.data ?? []).map((m) => [m.peer_id, m]));
  const chatList = accepted
    .map((f) => ({ friend: f, last: lastByPeer.get(f.peer?.id ?? "") }))
    .sort((a, b) => {
      const ta = a.last?.created_at ?? "";
      const tb = b.last?.created_at ?? "";
      return tb.localeCompare(ta);
    });

  return (
    <>
      <AppShell title="Messages" subtitle="Friends & DMs">
        <div className="px-4 pt-3">
          <div className="mb-4 flex gap-1 rounded-full bg-card/60 p-1">
            {(["chats", "requests", "add"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-1.5 text-xs font-bold capitalize ${
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "chats" && "Chats"}
                {t === "requests" && (
                  <>Requests{incoming.length > 0 && (
                    <span className="ml-1 rounded-full bg-[color:var(--destructive)] px-1.5 text-[9px]">{incoming.length}</span>
                  )}</>
                )}
                {t === "add" && "Add"}
              </button>
            ))}
          </div>

          {tab === "chats" && (
            <ChatsList list={chatList} loading={friends.isLoading} />
          )}
          {tab === "requests" && (
            <RequestsList incoming={incoming} outgoing={outgoing} />
          )}
          {tab === "add" && <AddFriend />}
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function ChatsList({
  list,
  loading,
}: {
  list: { friend: Friendship; last?: LastMsg }[];
  loading: boolean;
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
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No chats yet.</p>
        <p className="text-xs text-muted-foreground">Add friends to start chatting.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {list.map(({ friend, last }) => {
        if (!friend.peer) return null;
        return (
          <li key={friend.peer.id}>
            <Link
              to="/messages/$peerId"
              params={{ peerId: friend.peer.id }}
              className="flex items-center gap-3 rounded-2xl p-2 hover:bg-card/60"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 font-bold">
                {friend.peer.avatar ? (
                  <img src={friend.peer.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  (friend.peer.username ?? "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm">@{friend.peer.username ?? "user"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {last?.text ?? "Say hi 👋"}
                </p>
              </div>
              {last?.unread ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--primary)] px-1.5 text-[10px] font-black text-primary-foreground">
                  {last.unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RequestsList({
  incoming,
  outgoing,
}: {
  incoming: Friendship[];
  outgoing: Friendship[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const respond = useMutation({
    mutationFn: async ({ f, accept }: { f: Friendship; accept: boolean }) => {
      if (accept) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("requester_id", f.requester_id)
          .eq("addressee_id", f.addressee_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("friendships")
          .delete()
          .eq("requester_id", f.requester_id)
          .eq("addressee_id", f.addressee_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (f: Friendship) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("requester_id", f.requester_id)
        .eq("addressee_id", f.addressee_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends", user?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Incoming ({incoming.length})
        </p>
        {incoming.length === 0 && (
          <p className="text-xs text-muted-foreground">No pending requests</p>
        )}
        <div className="space-y-2">
          {incoming.map((f) => (
            <div key={f.requester_id} className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 p-2">
              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
                {f.peer?.avatar ? <img src={f.peer.avatar} className="h-full w-full object-cover" alt="" /> : (f.peer?.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <p className="flex-1 truncate text-sm">@{f.peer?.username ?? "user"}</p>
              <button
                onClick={() => respond.mutate({ f, accept: true })}
                className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/90 text-white"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => respond.mutate({ f, accept: false })}
                className="grid h-8 w-8 place-items-center rounded-full bg-red-500/90 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Sent ({outgoing.length})
        </p>
        {outgoing.length === 0 && (
          <p className="text-xs text-muted-foreground">No outgoing requests</p>
        )}
        <div className="space-y-2">
          {outgoing.map((f) => (
            <div key={f.addressee_id} className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 p-2">
              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
                {f.peer?.avatar ? <img src={f.peer.avatar} className="h-full w-full object-cover" alt="" /> : (f.peer?.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <p className="flex-1 truncate text-sm">@{f.peer?.username ?? "user"}</p>
              <button
                onClick={() => cancel.mutate(f)}
                className="rounded-full border border-border px-3 py-1 text-[10px] font-bold text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddFriend() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string | null; avatar: string | null; user_code: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

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
    setSearching(false);
    if (error) { toast.error(error.message); return; }
    setResults(data ?? []);
  }

  const send = useMutation({
    mutationFn: async (peerId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: peerId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Friend request sent");
      qc.invalidateQueries({ queryKey: ["friends", user?.id] });
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
        {results.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 p-2">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
              {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : (p.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">@{p.username ?? "user"}</p>
              <p className="truncate text-[10px] text-muted-foreground">ID {p.user_code ?? "—"}</p>
            </div>
            <button
              onClick={() => send.mutate(p.id)}
              disabled={send.isPending}
              className="flex items-center gap-1 rounded-full bg-[color:var(--primary)]/20 px-3 py-1.5 text-[11px] font-bold text-[color:var(--primary)] disabled:opacity-50"
            >
              <UserPlus className="h-3 w-3" /> Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
