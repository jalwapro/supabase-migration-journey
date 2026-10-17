import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, Send, Smile, X, Trash2, MessageCircle, CheckCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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

type DM = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  kind: string;
  read_at: string | null;
  delivered_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

const SELECT_COLS = "id,sender_id,recipient_id,message,kind,read_at,delivered_at,deleted_at,created_at";

function timeLabel(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function preview(r: InboxRow) {
  if (r.last_deleted) return "Message deleted";
  if (r.last_kind === "image") return "📷 Photo";
  if (r.last_kind === "video") return "🎬 Video";
  if (r.last_kind === "voice") return "🎙️ Voice message";
  if (r.last_kind === "file") return "📎 File";
  if (r.last_kind === "album") return "🖼️ Shared from gallery";
  return r.last_message ?? "Say hi 👋";
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? (
    <img
      src={src}
      alt=""
      className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover shadow-md"
    />
  ) : (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-pink-500 to-violet-600 text-xs font-black text-white shadow-md">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/**
 * Voice Room Private Chat Sheet.
 * Designed to match GiftSheet's layout:
 * - Docked cleanly at the bottom over the room footer
 * - Compact height (h-[340px]) keeping the Room Header and Upper 4 Seats fully visible
 * - Clean slide-up animation and dark backdrop
 */
export function JalwaPrivateChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(true);

  const selected = useMemo(
    () => inbox.find((r) => r.peer_id === selectedId) ?? inbox[0] ?? null,
    [inbox, selectedId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? inbox.filter(
          (r) =>
            (r.peer_username ?? "").toLowerCase().includes(q) ||
            (r.peer_user_code ?? "").toLowerCase().includes(q)
        )
      : inbox;
  }, [inbox, search]);

  const loadInbox = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("dm_inbox", { _limit: 50, _offset: 0 });
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as InboxRow[];
    setInbox(rows);
    setSelectedId((c) => (c && rows.some((r) => r.peer_id === c) ? c : rows[0]?.peer_id ?? null));

    const unread = rows.reduce((n, r) => n + (Number(r.unread) || 0), 0);
    const button = document.querySelector('[aria-label="Private Chat"]');
    if (button) {
      button.setAttribute("data-private-unread", String(unread));
      button.classList.add("relative");
      let badge = button.querySelector("[data-private-chat-badge]") as HTMLElement | null;
      if (unread > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.setAttribute("data-private-chat-badge", "true");
          badge.className =
            "absolute -right-1 -top-1 z-10 grid min-h-4 min-w-4 place-items-center rounded-full border border-slate-950 bg-red-500 px-1 text-[8px] font-black leading-none text-white shadow-lg";
          button.appendChild(badge);
        }
        badge.textContent = unread > 99 ? "99+" : String(unread);
      } else {
        badge?.remove();
      }
    }
  };

  useEffect(() => {
    if (user) void loadInbox();
  }, [user]);

  useEffect(() => {
    if (open) {
      setMobileListOpen(!selectedId);
    }
  }, [open, selectedId]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`room-private-chat:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const dm = payload.new as DM;
          const sender = inbox.find((r) => r.peer_id === dm.sender_id);
          setMessages((c) => (c.some((m) => m.id === dm.id) ? c : c.concat(dm)));
          void loadInbox();
          if (!open || selectedId !== dm.sender_id) {
            toast(`New private message from ${sender?.peer_username || "New user"}`, {
              description: dm.message || "New private message",
            });
          }
          if (open && selectedId === dm.sender_id) {
            const now = new Date().toISOString();
            void supabase.from("direct_messages").update({ read_at: now, delivered_at: now }).eq("id", dm.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const dm = payload.new as DM;
          setMessages((c) => c.map((m) => (m.id === dm.id ? { ...m, ...dm } : m)));
          void loadInbox();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, open, selectedId, inbox]);

  useEffect(() => {
    if (!user || !selected) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select(SELECT_COLS)
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${selected.peer_id}),and(sender_id.eq.${selected.peer_id},recipient_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      setMessages((data ?? []) as DM[]);
      const now = new Date().toISOString();
      await supabase
        .from("direct_messages")
        .update({ read_at: now, delivered_at: now })
        .eq("sender_id", selected.peer_id)
        .eq("recipient_id", user.id)
        .is("read_at", null);
      void loadInbox();
    })();
    return () => {
      cancelled = true;
    };
  }, [user, selected?.peer_id]);

  const sendMessage = async () => {
    const value = draft.trim();
    if (!value || !user || !selected) return;
    setDraft("");
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: user.id, recipient_id: selected.peer_id, kind: "text", message: value })
      .select(SELECT_COLS)
      .single();
    if (error) {
      setDraft(value);
      toast.error(
        error.message.includes("row-level") ? "Friends banne ke baad hi DM bhej sakte ho" : error.message
      );
      return;
    }
    if (data) setMessages((c) => (c.some((m) => m.id === data.id) ? c : c.concat(data as DM)));
    void loadInbox();
  };

  const clearChat = async () => {
    if (!user || !selected || clearBusy) return;
    const confirmed = window.confirm(
      `Clear the complete private chat with ${selected.peer_username ?? "this user"}?\n\nThis permanently removes the conversation for both participants and cannot be undone.`
    );
    if (!confirmed) return;
    setClearBusy(true);
    setMenuOpen(false);
    const { data, error } = await supabase.rpc("clear_dm_conversation", { _peer_id: selected.peer_id });
    setClearBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages([]);
    setInbox((c) => c.filter((r) => r.peer_id !== selected.peer_id));
    setSelectedId(null);
    setMobileListOpen(true);
    toast.success(`${Number(data ?? 0)} message(s) cleared`);
    void loadInbox();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/50 p-0 transition-opacity"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Private Chat"
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg h-[340px] flex-row overflow-hidden rounded-t-[24px] border border-white/10 bg-[#121212]/95 backdrop-blur-xl text-white shadow-2xl animate-in slide-in-from-bottom duration-200"
      >
        {/* Conversations list sidebar */}
        <aside
          className={cn(
            "h-full min-h-0 flex-col overflow-hidden bg-black/20 text-white sm:flex sm:w-[40%] sm:border-r sm:border-white/10",
            mobileListOpen ? "flex w-full" : "hidden"
          )}
        >
          {/* Header */}
          <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-gradient-to-r from-pink-400 to-violet-500 bg-clip-text text-transparent">
                Jalwa
              </span>
              <span className="text-[11px] font-black text-white">Private Chat</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="shrink-0 p-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/40"
              />
            </div>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                <MessageCircle className="mb-2 h-7 w-7 text-white/30" />
                <div className="text-xs font-semibold text-white">No private messages yet</div>
                <div className="mt-0.5 text-[10px] text-white/40">Conversations with friends appear here.</div>
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.peer_id}
                  onClick={() => {
                    setSelectedId(r.peer_id);
                    setMobileListOpen(false);
                  }}
                  className={`mb-1.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                    selected?.peer_id === r.peer_id
                      ? "bg-pink-500/15 ring-1 ring-pink-500/60"
                      : "hover:bg-white/[0.06]"
                  }`}
                >
                  <Avatar name={r.peer_username ?? "User"} src={r.peer_avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-extrabold text-white">
                        {r.peer_username ?? "User"}
                      </span>
                      <span className="shrink-0 text-[9px] text-white/60">
                        {timeLabel(r.last_created_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] text-white/70">{preview(r)}</span>
                      {r.unread > 0 ? (
                        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-pink-500 px-1 text-[8px] font-black text-white shadow-sm">
                          {r.unread > 99 ? "99+" : r.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Conversation messages main area */}
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col bg-[#121212]",
            mobileListOpen ? "hidden sm:flex" : "flex w-full"
          )}
        >
          {selected ? (
            <>
              {/* Chat Header */}
              <header className="flex h-[44px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 shadow-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label="Back to conversations"
                    onClick={() => setMobileListOpen(true)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/15 transition sm:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <Avatar name={selected.peer_username ?? "User"} src={selected.peer_avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-black text-white">
                      {selected.peer_username ?? "User"}
                    </div>
                    <div className="text-[9px] text-white/45">
                      {selected.peer_user_code ? `ID ${selected.peer_user_code}` : "Private conversation"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="Chat options"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/15 transition"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] p-1 shadow-2xl">
                        <button
                          disabled={clearBusy}
                          onClick={() => void clearChat()}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-red-400 hover:bg-red-500/15 disabled:opacity-50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {clearBusy ? "Clearing..." : "Clear Chat"}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </header>

              {/* Messages Body */}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-black/20 px-3 py-2.5 text-white [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {messages.filter((m) => !m.deleted_at).length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-white">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-pink-500/20 text-pink-400">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div className="mt-2 text-xs font-black text-white">Start a private conversation</div>
                    <div className="mt-0.5 text-[10px] text-white/50">
                      Send a message to {selected.peer_username ?? "this user"}
                    </div>
                  </div>
                ) : (
                  messages
                    .filter((m) => !m.deleted_at)
                    .map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-[11px] font-medium leading-relaxed shadow-sm ${
                            m.sender_id === user?.id
                              ? "rounded-br-md bg-gradient-to-r from-pink-500 to-violet-600 text-white"
                              : "rounded-bl-md border border-white/10 bg-white/[0.08] text-white"
                          }`}
                        >
                          <div>{m.kind === "text" ? m.message : `${m.kind} message`}</div>
                          <div className="mt-0.5 flex items-center justify-end gap-1 text-[8px] text-white/50">
                            {timeLabel(m.created_at)}
                            {m.sender_id === user?.id ? <CheckCheck className="h-2.5 w-2.5 text-pink-200" /> : null}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-white/10 bg-black/40 px-3 py-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] p-1 shadow-sm focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500/30">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void sendMessage();
                    }}
                    placeholder="Write a private message..."
                    className="min-w-0 flex-1 bg-transparent px-2.5 text-[11px] font-medium text-white outline-none placeholder:text-white/40"
                  />
                  <button
                    type="button"
                    aria-label="Emoji"
                    className="grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 transition"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    aria-label="Send"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md transition hover:scale-105 active:scale-95"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-[#121212] p-4 text-center text-white">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-white/5 text-pink-400">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div className="mt-2 text-xs font-black text-white">Private Messages</div>
              <div className="mt-0.5 text-[10px] text-white/50">Select a conversation to start chatting.</div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
