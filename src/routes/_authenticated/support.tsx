import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Loader2, Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

type Msg = {
  id: string;
  body: string;
  sender_kind: "user" | "agent";
  created_at: string;
};

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const conv = useQuery({
    enabled: !!user,
    queryKey: ["support-conv", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_support_conversation");
      if (error) throw error;
      return data as string;
    },
  });

  const conversationId = conv.data ?? null;

  const messages = useQuery({
    enabled: !!conversationId,
    queryKey: ["support-msgs", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id,body,sender_kind,created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`support:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["support-msgs", conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.data]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!conversationId || !user) return;
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_kind: "user",
        body,
      });
      if (error) throw error;
      // reset agent-unread on user reply
      await supabase
        .from("support_conversations")
        .update({ unread_for_user: 0 })
        .eq("id", conversationId);
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["support-msgs", conversationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    send.mutate(body);
  };

  const tickets = useQuery({
    enabled: !!user,
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id,subject,status,admin_reply,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const s = subject.trim();
      const d = detail.trim();
      const { error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject: s, message: d, status: "open" });
      if (error) throw error;
      if (conversationId) {
        await supabase.from("support_messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          sender_kind: "user",
          body: `🎫 New ticket — ${s}\n${d}`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Ticket created");
      setTicketOpen(false);
      setSubject("");
      setDetail("");
      qc.invalidateQueries({ queryKey: ["support-tickets", user?.id] });
      qc.invalidateQueries({ queryKey: ["support-msgs", conversationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <>
      <AppShell title="Customer Support" subtitle="Chat with our team">
        <div className="flex h-[calc(100dvh-140px)] flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setTicketOpen(true)}
              className="rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
            >
              + New Ticket
            </button>
            <span className="text-[11px] text-muted-foreground">
              {(tickets.data ?? []).length} ticket{(tickets.data ?? []).length === 1 ? "" : "s"}
            </span>
          </div>

          {(tickets.data ?? []).length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto border-b border-border px-3 py-2">
              {tickets.data?.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-card/60 px-2 py-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate">{t.subject}</b>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        t.status === "open"
                          ? "bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  {t.admin_reply && (
                    <p className="mt-0.5 text-muted-foreground">Reply: {t.admin_reply}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {ticketOpen && (
            <div
              data-jalwa-overlay
              className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5"
              onClick={() => setTicketOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-border bg-card p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 font-bold">New Support Ticket</p>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="mb-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none"
                />
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Describe your issue…"
                  rows={4}
                  className="mb-3 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketOpen(false)}
                    className="rounded-full px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={createTicket.isPending || !subject.trim() || !detail.trim()}
                    onClick={() => createTicket.mutate()}
                    className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {createTicket.isPending ? "Sending…" : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {conv.isLoading || messages.isLoading ? (
            <div className="grid flex-1 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-4 pt-3 pb-2">
              {(messages.data ?? []).length === 0 && (
                <div className="grid place-items-center py-16 text-center">
                  <LifeBuoy className="mb-2 h-10 w-10 text-[color:var(--primary)]" />
                  <p className="font-bold">How can we help?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Send us a message and a support agent will reply here.
                  </p>
                </div>
              )}
              {messages.data?.map((m) => {
                const mine = m.sender_kind === "user";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        mine
                          ? "bg-[color:var(--primary)] text-primary-foreground"
                          : "border border-border bg-card text-card-foreground"
                      }`}
                    >
                      {m.body}
                      <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-border bg-background/95 px-3 py-2 backdrop-blur"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
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
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
