import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages/$peerId")({
  component: DmThread,
});

type DM = {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  read_at: string | null;
  created_at: string;
};

function DmThread() {
  const { peerId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<DM[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const peer = useQuery({
    queryKey: ["profile", peerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code")
        .eq("id", peerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Load history + mark read
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancel) return;
      if (error) { toast.error(error.message); return; }
      setMessages((data ?? []) as DM[]);
      // Mark incoming as read
      await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", peerId)
        .eq("receiver_id", user.id)
        .is("read_at", null);
      qc.invalidateQueries({ queryKey: ["dm_index", user.id] });
    })();
    return () => { cancel = true; };
  }, [user, peerId, qc]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm-${user.id}-${peerId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "direct_messages",
      }, (payload) => {
        const m = payload.new as DM;
        const pair =
          (m.sender_id === user.id && m.receiver_id === peerId) ||
          (m.sender_id === peerId && m.receiver_id === user.id);
        if (!pair) return;
        setMessages((prev) => [...prev, m]);
        if (m.receiver_id === user.id) {
          void supabase
            .from("direct_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", m.id);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, peerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!user) return;
    const v = text.trim();
    if (!v) return;
    setText("");
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: peerId,
      text: v,
    });
    if (error) {
      if (error.message.includes("row-level")) {
        toast.error("You must be friends to DM this user");
      } else {
        toast.error(error.message);
      }
      setText(v);
    }
  }

  if (!user) return null;

  return (
    <AppShell
      showHeader={false}
    >
      <div className="flex h-[100dvh] flex-col">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-3 py-3 backdrop-blur-xl"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button
            onClick={() => nav({ to: "/messages" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Link to="/messages" className="flex min-w-0 flex-1 items-center gap-2">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
              {peer.data?.avatar ? (
                <img src={peer.data.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (peer.data?.username ?? "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">@{peer.data?.username ?? "user"}</p>
              <p className="text-[10px] text-muted-foreground">ID {peer.data?.user_code ?? "—"}</p>
            </div>
          </Link>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {peer.isLoading && (
            <div className="pt-6 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {messages.length === 0 && !peer.isLoading && (
            <p className="pt-8 text-center text-xs text-muted-foreground">
              Send a message to start the conversation
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm"
                  }`}
                >
                  {m.text}
                  <p className={`mt-0.5 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="sticky bottom-0 border-t border-border bg-background/90 px-3 py-2 backdrop-blur-xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]"
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
