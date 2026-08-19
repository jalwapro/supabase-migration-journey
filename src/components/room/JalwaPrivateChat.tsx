import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Phone, Search, Send, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function preview(row: InboxRow) {
  if (row.last_deleted) return "Message deleted";
  if (row.last_kind === "image") return "📷 Photo";
  if (row.last_kind === "video") return "🎬 Video";
  if (row.last_kind === "voice") return "🎙️ Voice message";
  if (row.last_kind === "file") return "📎 File";
  if (row.last_kind === "album") return "🖼️ Shared from gallery";
  return row.last_message ?? "Say hi 👋";
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) return <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-full border border-black/15 object-cover" />;
  return <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/20 bg-white text-[12px] font-black text-black">{name.slice(0, 1).toUpperCase()}</div>;
}

export function JalwaPrivateChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const selected = useMemo(() => inbox.find((r) => r.peer_id === selectedId) ?? inbox[0] ?? null, [inbox, selectedId]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((r) => (r.peer_username ?? "").toLowerCase().includes(q) || (r.peer_user_code ?? "").toLowerCase().includes(q));
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
    setSelectedId((current) => current && rows.some((r) => r.peer_id === current) ? current : rows[0]?.peer_id ?? null);
  };

  useEffect(() => {
    if (!user) return;
    void loadInbox();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`room-private-chat:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const dm = payload.new as DM;
          const sender = inbox.find((r) => r.peer_id === dm.sender_id);
          setMessages((current) => current.some((m) => m.id === dm.id) ? current : current.concat(dm));
          void loadInbox();
          const name = sender?.peer_username || "New user";
          if (!open || selectedId !== dm.sender_id) {
            toast(`New private message from ${name}`, { description: dm.message || "New private message" });
          }
          if (open && selectedId === dm.sender_id) {
            const now = new Date().toISOString();
            void supabase.from("direct_messages").update({ read_at: now, delivered_at: now }).eq("id", dm.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const dm = payload.new as DM;
          setMessages((current) => current.map((m) => m.id === dm.id ? { ...m, ...dm } : m));
          void loadInbox();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
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
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${selected.peer_id}),and(sender_id.eq.${selected.peer_id},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      setMessages((data ?? []) as DM[]);
      const now = new Date().toISOString();
      await supabase.from("direct_messages").update({ read_at: now, delivered_at: now }).eq("sender_id", selected.peer_id).eq("recipient_id", user.id).is("read_at", null);
      void loadInbox();
    })();
    return () => { cancelled = true; };
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
      toast.error(error.message.includes("row-level") ? "Friends banne ke baad hi DM bhej sakte ho" : error.message);
      return;
    }
    if (data) setMessages((current) => current.some((m) => m.id === data.id) ? current : current.concat(data as DM));
    void loadInbox();
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-[2147482500] bg-black/45 p-3 sm:p-5" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Private Chat" className="mx-auto flex h-[min(82vh,720px)] w-full max-w-[920px] overflow-hidden rounded-[24px] border border-black/20 bg-white text-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <aside className="flex w-[38%] min-w-[128px] flex-col border-r border-black/15 bg-white">
        <div className="flex h-[58px] items-center justify-between border-b border-black/15 px-3 sm:px-4"><div className="text-[15px] font-black sm:text-[18px]">Private Chat</div><button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-black/5"><X className="h-5 w-5" /></button></div>
        <div className="border-b border-black/10 p-2 sm:p-3"><div className="flex items-center gap-2 rounded-full border border-black/20 px-3 py-2"><Search className="h-4 w-4 shrink-0" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-black/45 sm:text-[12px]" /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? <div className="p-5 text-center text-[11px] text-black/50">No private messages yet.</div> : filtered.map((r) => <button key={r.peer_id} onClick={() => setSelectedId(r.peer_id)} className={`flex w-full items-center gap-2 border-b border-black/10 px-2 py-3 text-left sm:gap-3 sm:px-3 ${selected?.peer_id === r.peer_id ? "bg-black/[0.045]" : "hover:bg-black/[0.025]"}`}>
            <Avatar name={r.peer_username ?? "User"} src={r.peer_avatar} />
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-black sm:text-[13px]">{r.peer_username ?? "User"}</span><span className="shrink-0 text-[8px] text-black/55 sm:text-[10px]">{timeLabel(r.last_created_at)}</span></div><div className="mt-0.5 flex items-center justify-between gap-1"><span className="truncate text-[9px] text-black/60 sm:text-[11px]">{preview(r)}</span>{r.unread > 0 ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[8px] font-black text-white">{r.unread > 99 ? "99+" : r.unread}</span> : null}</div></div>
          </button>)}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {selected ? <>
          <header className="flex h-[58px] items-center gap-2 border-b border-black/15 px-3 sm:gap-3 sm:px-5"><Avatar name={selected.peer_username ?? "User"} src={selected.peer_avatar}/><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-black sm:text-[15px]">{selected.peer_username ?? "User"}</div><div className="text-[9px] text-black/55 sm:text-[11px]">Private conversation</div></div><button aria-label="Call" className="rounded-full p-2 hover:bg-black/5"><Phone className="h-5 w-5"/></button><button aria-label="More" className="rounded-full p-2 hover:bg-black/5"><MoreHorizontal className="h-5 w-5"/></button></header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:space-y-4 sm:px-5 sm:py-5">{messages.filter((m) => !m.deleted_at).map((m) => <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl border border-black/20 px-3 py-2 text-[11px] leading-relaxed sm:text-[13px] ${m.sender_id === user?.id ? "rounded-br-sm bg-black text-white" : "rounded-bl-sm bg-white text-black"}`}><div>{m.kind === "text" ? m.message : `${m.kind} message`}</div><div className={`mt-1 text-right text-[8px] ${m.sender_id === user?.id ? "text-white/60" : "text-black/45"}`}>{timeLabel(m.created_at)}{m.sender_id === user?.id ? "  ✓✓" : ""}</div></div></div>)}</div>
          <div className="border-t border-black/15 p-2 sm:p-3"><div className="flex items-center gap-2"><div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-black/25 px-3 py-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(); }} placeholder="Type a private message..." className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-black/45 sm:text-[12px]"/><button aria-label="Emoji" className="rounded-full p-1 hover:bg-black/5"><Smile className="h-5 w-5"/></button></div><button onClick={() => void sendMessage()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black bg-black text-white active:scale-95"><Send className="h-4 w-4" /></button></div></div>
        </> : <div className="grid flex-1 place-items-center p-8 text-center text-sm text-black/50">Your real private messages will appear here.</div>}
      </main>
    </section>
  </div>;
}
