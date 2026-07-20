import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/support-chat")({
  component: SupportChatAdmin,
});

type Conv = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_agent: number;
  user: { username: string | null; avatar: string | null; user_code: string | null } | null;
};

type Msg = {
  id: string;
  body: string;
  sender_kind: "user" | "agent";
  created_at: string;
};

function SupportChatAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const inbox = useQuery({
    queryKey: ["admin-support-inbox"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select(
          "id,user_id,status,last_message_at,last_message_preview,unread_for_agent,user:profiles!support_conversations_user_id_fkey(username,avatar,user_code)"
        )
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Conv[];
    },
  });

  const messages = useQuery({
    enabled: !!active,
    queryKey: ["admin-support-msgs", active],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id,body,sender_kind,created_at")
        .eq("conversation_id", active!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    if (!active) return;
    const ch = supabase
      .channel(`admin-support:${active}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${active}` },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-support-msgs", active] });
          qc.invalidateQueries({ queryKey: ["admin-support-inbox"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, qc]);

  useEffect(() => {
    if (!active) return;
    // clear unread on open
    void supabase
      .from("support_conversations")
      .update({ unread_for_agent: 0, assigned_agent: user?.id ?? null })
      .eq("id", active);
  }, [active, user?.id]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.data]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!active || !user) return;
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: active,
        sender_id: user.id,
        sender_kind: "agent",
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-support-msgs", active] });
      qc.invalidateQueries({ queryKey: ["admin-support-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const { error } = await supabase
        .from("support_conversations")
        .update({ status: "closed" })
        .eq("id", active);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket closed");
      qc.invalidateQueries({ queryKey: ["admin-support-inbox"] });
    },
  });

  const conv = inbox.data?.find((c) => c.id === active) ?? null;

  return (
    <>
      <AdminPageHeader title="Support Chat" subtitle="Live conversations with users" />
      <div className="grid gap-3 md:grid-cols-[320px_1fr]">
        {/* Inbox */}
        <div className="glass max-h-[70vh] overflow-y-auto rounded-2xl p-2">
          {inbox.isLoading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (inbox.data ?? []).length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No conversations yet</p>
          ) : (
            (inbox.data ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                  active === c.id ? "bg-primary/15" : "hover:bg-card/60"
                }`}
              >
                <div className="grid h-10 w-10 shrink-0 overflow-hidden rounded-full bg-card">
                  {c.user?.avatar ? (
                    <img src={c.user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-bold">
                      {(c.user?.username ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{c.user?.username ?? "User"}</p>
                    {c.status === "closed" && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase">closed</span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{c.last_message_preview ?? "…"}</p>
                </div>
                {c.unread_for_agent > 0 && (
                  <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[color:var(--primary)] px-1 text-[10px] font-bold text-primary-foreground">
                    {c.unread_for_agent}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="glass flex h-[70vh] flex-col rounded-2xl">
          {!active ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select a conversation</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border p-3">
                <div>
                  <p className="font-bold">{conv?.user?.username ?? "User"}</p>
                  <p className="text-[10px] text-muted-foreground">ID {conv?.user?.user_code ?? conv?.user_id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={() => close.mutate()}
                  disabled={close.isPending || conv?.status === "closed"}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Close
                </button>
              </div>
              <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-3">
                {messages.data?.map((m) => {
                  const agent = m.sender_kind === "agent";
                  return (
                    <div key={m.id} className={`flex ${agent ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                        agent
                          ? "bg-[color:var(--primary)] text-primary-foreground"
                          : "border border-border bg-card text-card-foreground"
                      }`}>
                        {m.body}
                        <p className={`mt-1 text-[10px] ${agent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); const b = text.trim(); if (b) send.mutate(b); }}
                className="flex items-center gap-2 border-t border-border p-2"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Reply as agent…"
                  className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={send.isPending || !text.trim()}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--primary)] text-primary-foreground disabled:opacity-60"
                >
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
